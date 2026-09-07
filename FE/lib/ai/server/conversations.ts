/**
 * 대화 저장소 — 테넌트 스키마의 `ai_conversations` · `ai_messages`.
 *
 * 소스 문서 저장소와 같은 규칙이다. 모든 조회에 `owner_user_id = 요청자` 가 붙고, 메시지는 대화를 거쳐서만
 * 닿는다(대화 소유를 먼저 확인). 스키마는 `withTenant` 가 잡아 주므로 테이블 이름만 쓴다.
 *
 * `meta` 는 화면 부가 정보(`ChatMessage` 에서 role·text·rating 을 뺀 나머지)를 그대로 JSON 으로 둔다.
 * 모델 히스토리는 `text` 만 쓴다 — 도구 행이나 출처 스니펫을 모델에 다시 넣을 이유가 없다.
 */
import "server-only";
import type { ChatMessage } from "@/data/chat";
import type { Db } from "./db";

export interface ConversationRow {
  id: string;
  owner_user_id: string;
  title: string;
  selected_sources: string[];
  created_at: Date;
  updated_at: Date;
  last_message_at: Date | null;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  seq: number;
  role: "user" | "assistant";
  text: string;
  meta: Record<string, unknown>;
  rating: "up" | "down" | null;
  created_at: Date;
}

/** 화면이 보는 대화 요약 */
export interface ConversationSummary {
  id: string;
  title: string;
  selectedSources: string[];
  lastMessageAt: string | null;
  createdAt: string;
}

export const TITLE_MAX = 120;

export function toSummary(r: ConversationRow): ConversationSummary {
  return {
    id: r.id,
    title: r.title,
    selectedSources: r.selected_sources ?? [],
    lastMessageAt: r.last_message_at ? r.last_message_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
  };
}

/** 저장된 행 → 화면 메시지. `seq` 를 실어 보내 편집·재시도·평가가 서버 행을 가리킬 수 있게 한다 */
export function toChatMessageRow(r: MessageRow): ChatMessage {
  const meta = r.meta as Partial<ChatMessage>;
  return {
    ...meta,
    role: r.role === "user" ? "user" : "ai",
    text: r.text,
    rating: r.rating ?? undefined,
    seq: r.seq,
  };
}

/** 첫 질문에서 제목을 만든다 — 화면이 하던 규칙(18자 + …)과 같다 */
export function titleFrom(question: string): string {
  const q = question.trim().replace(/\s+/g, " ");
  return q.length > 18 ? `${q.slice(0, 18)}…` : q || "새 대화";
}

export async function createConversation(
  db: Db,
  ownerUserId: string,
  init: { title?: string; selectedSources?: string[] },
): Promise<ConversationRow> {
  const { rows } = await db.query<ConversationRow>(
    `INSERT INTO ai_conversations (owner_user_id, title, selected_sources)
     VALUES ($1, $2, $3) RETURNING *`,
    [ownerUserId, (init.title ?? "새 대화").slice(0, TITLE_MAX), init.selectedSources ?? []],
  );
  return rows[0];
}

export async function listConversations(db: Db, ownerUserId: string): Promise<ConversationRow[]> {
  const { rows } = await db.query<ConversationRow>(
    `SELECT * FROM ai_conversations WHERE owner_user_id = $1
      ORDER BY last_message_at DESC NULLS LAST, created_at DESC`,
    [ownerUserId],
  );
  return rows;
}

export async function findConversation(
  db: Db,
  ownerUserId: string,
  id: string,
): Promise<ConversationRow | null> {
  const { rows } = await db.query<ConversationRow>(
    `SELECT * FROM ai_conversations WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, id],
  );
  return rows[0] ?? null;
}

export async function updateConversation(
  db: Db,
  ownerUserId: string,
  id: string,
  patch: { title?: string; selectedSources?: string[] },
): Promise<ConversationRow | null> {
  const { rows } = await db.query<ConversationRow>(
    `UPDATE ai_conversations
        SET title = COALESCE($3, title),
            selected_sources = COALESCE($4, selected_sources),
            updated_at = now()
      WHERE owner_user_id = $1 AND id = $2
      RETURNING *`,
    [ownerUserId, id, patch.title?.slice(0, TITLE_MAX) ?? null, patch.selectedSources ?? null],
  );
  return rows[0] ?? null;
}

export async function deleteConversation(db: Db, ownerUserId: string, id: string): Promise<boolean> {
  const { rowCount } = await db.query(
    `DELETE FROM ai_conversations WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, id],
  );
  return (rowCount ?? 0) > 0;
}

/** 대화의 메시지 전부, 순번 순. 대화 소유는 호출부가 `findConversation` 으로 먼저 확인한다 */
export async function listMessages(db: Db, conversationId: string): Promise<MessageRow[]> {
  const { rows } = await db.query<MessageRow>(
    `SELECT * FROM ai_messages WHERE conversation_id = $1 ORDER BY seq ASC`,
    [conversationId],
  );
  return rows;
}

/**
 * 메시지 추가. 순번은 같은 트랜잭션에서 `MAX(seq)+1` 로 정한다 — 같은 대화에 동시에 두 턴이 들어오는 일은
 * 화면이 막고 있고(답변 중 전송 불가), 유니크 인덱스가 최후의 보루다.
 */
export async function appendMessage(
  db: Db,
  conversationId: string,
  msg: { role: "user" | "assistant"; text: string; meta?: Record<string, unknown> },
): Promise<MessageRow> {
  const { rows } = await db.query<MessageRow>(
    `INSERT INTO ai_messages (conversation_id, seq, role, text, meta)
     SELECT $1, COALESCE(MAX(seq), 0) + 1, $2, $3, $4 FROM ai_messages WHERE conversation_id = $1
     RETURNING *`,
    [conversationId, msg.role, msg.text, JSON.stringify(msg.meta ?? {})],
  );
  await db.query(
    `UPDATE ai_conversations SET last_message_at = now(), updated_at = now() WHERE id = $1`,
    [conversationId],
  );
  return rows[0];
}

/** `seq` 이상을 지운다 — 사용자 메시지 편집·답변 다시 시도 */
export async function deleteMessagesFrom(db: Db, conversationId: string, seq: number) {
  await db.query(`DELETE FROM ai_messages WHERE conversation_id = $1 AND seq >= $2`, [
    conversationId,
    seq,
  ]);
}

export async function patchMessageMeta(
  db: Db,
  conversationId: string,
  seq: number,
  patch: Record<string, unknown>,
) {
  await db.query(
    `UPDATE ai_messages SET meta = meta || $3::jsonb WHERE conversation_id = $1 AND seq = $2`,
    [conversationId, seq, JSON.stringify(patch)],
  );
}

export async function setRating(
  db: Db,
  conversationId: string,
  seq: number,
  rating: "up" | "down" | null,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE ai_messages SET rating = $3 WHERE conversation_id = $1 AND seq = $2 AND role = 'assistant'`,
    [conversationId, seq, rating],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * 모델에 넣을 히스토리. 최근 것부터 거슬러 올라가며 글자 예산 안에 드는 만큼만 고른다.
 *
 * 턴 수 상한과 글자 예산을 둘 다 두는 이유: 짧은 턴이 많으면 턴 수가, 긴 답변 몇 개면 글자 수가 먼저 찬다.
 * 잘려 나간 앞부분은 모델이 모른다 — 요약해 넣는 것은 다음 단계다.
 */
export function historyForModel(
  rows: MessageRow[],
  opts: { maxTurns?: number; maxChars?: number } = {},
): { role: "user" | "assistant"; content: string }[] {
  const maxMessages = (opts.maxTurns ?? 12) * 2;
  const maxChars = opts.maxChars ?? 16_000;
  const picked: MessageRow[] = [];
  let chars = 0;
  for (let i = rows.length - 1; i >= 0 && picked.length < maxMessages; i--) {
    const r = rows[i];
    if (!r.text.trim()) continue;
    if (chars + r.text.length > maxChars && picked.length > 0) break;
    picked.push(r);
    chars += r.text.length;
  }
  picked.reverse();
  // 첫 메시지가 assistant 면 앞의 user 가 잘린 것이다. 모델은 user 로 시작하는 쪽이 안정적이라 하나 뺀다
  if (picked[0]?.role === "assistant") picked.shift();
  return picked.map((r) => ({
    role: r.role,
    content: r.role === "assistant" ? r.text + toolRecord(r.meta) : r.text,
  }));
}

/**
 * 답변에 딸린 도구 기록을 히스토리에 덧붙인다.
 *
 * 본문(text)만 넣으면 모델은 "메모를 저장했습니다" 라는 자기 문장만 보고, 정말 실행됐는지는 모른다. 그래서 다음 턴에
 * "어디에 저장했어?" 라고 물으면 실행 여부를 의심하고 도구를 다시 부른다. 실행된 도구와 결과, 승인 요청의 결정을
 * 짧게 남겨 두면 모델이 사실로 다룬다. 출력은 앞부분만 — 히스토리 예산을 도구 결과가 다 먹으면 안 된다.
 */
function toolRecord(meta: Record<string, unknown>): string {
  const m = meta as Partial<ChatMessage>;
  const lines: string[] = [];
  for (const row of m.process?.trace ?? []) {
    if (row.output !== undefined) {
      lines.push(`- ${row.text}: 실행됨 → ${row.output.replace(/\s+/g, " ").slice(0, 300)}`);
    } else if (row.result && /실패/.test(row.text)) {
      lines.push(`- ${row.text}: ${row.result}`);
    }
  }
  for (const a of m.approvals ?? []) {
    lines.push(
      `- ${a.label}(${a.toolName}): 승인 요청 → ${
        a.decision === "approved" ? "승인됨(그 다음 턴에서 실행)" : a.decision === "denied" ? "거절됨(실행 안 함)" : "결정 대기 중(실행 안 됨)"
      }`,
    );
  }
  return lines.length ? `\n\n[도구 기록]\n${lines.join("\n")}` : "";
}
