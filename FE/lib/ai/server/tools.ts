/**
 * 도구 레지스트리와 안전장치. **모델이 부를 수 있는 도구는 전부 여기를 거친다.**
 *
 * 사내 데이터 도구·외부 앱(MCP)은 아직 없다. 지금 있는 것은 도구를 안전하게 실행하는 틀이다.
 *
 * ── 안전장치 ────────────────────────────────────────────────────────────────
 * 1. 승인 게이트 — `needsApproval` 도구는 실행하지 않고 감사 기록에 `proposed` 로 남긴 뒤 화면에 승인 카드를
 *    띄운다. 사용자가 승인하면 서버가 **자기 기록의 입력으로** 실행한다. 클라이언트가 입력을 바꿔 보낼 수 없다.
 * 2. 호출 횟수 — 한 턴에 `MAX_TOOL_STEPS` 단계까지(`stopWhen`). 도구가 도구를 부르는 무한 루프를 막는다.
 * 3. 시간 — 도구마다 `timeoutMs`. 넘기면 실패로 기록하고 모델에는 실패했다고 알린다.
 * 4. 크기 — 도구 출력은 `MAX_OUTPUT_CHARS` 로 자른다. 외부 앱이 돌려준 대용량 본문이 문맥을 채우지 못하게.
 * 5. 감사 — 모든 호출이 `ai_tool_audit` 에 남는다(누가 · 언제 · 어느 도구 · 어떤 입력 · 결과 앞부분 · 소요).
 *
 * 외부 앱에서 읽어 온 내용은 데이터다. 시스템 프롬프트가 도구 출력 안의 지시를 따르지 말라고 명시하고,
 * 쓰기 성격의 도구는 전부 승인 게이트 뒤에 둔다.
 *
 * ── 데모 도구 ───────────────────────────────────────────────────────────────
 * `AI_DEMO_TOOLS=1` 일 때만 두 개가 켜진다. 승인이 필요한 것 하나(`draft_note`)와 필요 없는 것 하나(`now`).
 * 실제 부작용은 없다 — 안전장치가 화면까지 이어지는지 확인하는 용도다. 운영에서는 켜지 않는다.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { AiPrincipal } from "./auth";
import { withTenant, type Db } from "./db";

export const MAX_TOOL_STEPS = 6;
const MAX_OUTPUT_CHARS = 4_000;
const DEFAULT_TIMEOUT_MS = 15_000;
/** 감사 기록에 남기는 출력 앞부분 */
const AUDIT_PREVIEW_CHARS = 500;

export interface AiToolContext {
  principal: AiPrincipal;
  conversationId: string;
}

export interface AiToolSpec<I> {
  name: string;
  /** 승인 카드에 보이는 사람 이름 */
  label: string;
  description: string;
  inputSchema: z.ZodType<I>;
  /** 되돌리기 어려운 동작이면 true. 모델은 제안만 하고 사용자가 결정한다 */
  needsApproval: boolean;
  timeoutMs?: number;
  execute: (input: I, ctx: AiToolContext) => Promise<unknown>;
}

/** 화면 승인 카드에 실어 보내는 값 */
export interface ApprovalRequest {
  approvalId: string;
  toolName: string;
  label: string;
  input: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 레지스트리는 입력 타입이 도구마다 다르다
const registry = new Map<string, AiToolSpec<any>>();

export function registerTool<I>(spec: AiToolSpec<I>) {
  registry.set(spec.name, spec);
}

export function getToolSpec(name: string): AiToolSpec<unknown> | undefined {
  return registry.get(name);
}

/* ─────────────────────────── 감사 기록 ─────────────────────────── */

type AuditStatus = "proposed" | "approved" | "denied" | "executed" | "failed";

async function audit(
  db: Db,
  row: {
    approvalId?: string;
    conversationId: string;
    userId: string;
    toolName: string;
    input: unknown;
    status: AuditStatus;
    outputPreview?: string;
    error?: string;
    durationMs?: number;
  },
) {
  await db.query(
    `INSERT INTO ai_tool_audit
       (approval_id, conversation_id, user_id, tool_name, input, status, output_preview, error, duration_ms)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)`,
    [
      row.approvalId ?? null,
      row.conversationId,
      row.userId,
      row.toolName,
      JSON.stringify(row.input ?? null),
      row.status,
      row.outputPreview ?? null,
      row.error ?? null,
      row.durationMs ?? null,
    ],
  );
}

interface AuditRow {
  approval_id: string;
  conversation_id: string;
  user_id: string;
  tool_name: string;
  input: unknown;
  status: AuditStatus;
}

/* ─────────────────────────── 실행 ─────────────────────────── */

function preview(v: unknown): string {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > AUDIT_PREVIEW_CHARS ? `${s.slice(0, AUDIT_PREVIEW_CHARS)}…` : s;
}

/** 모델에 돌려주는 출력. 크기를 자르고, 잘렸다는 사실을 남긴다 */
function capOutput(v: unknown): unknown {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (s.length <= MAX_OUTPUT_CHARS) return v;
  return { truncated: true, preview: s.slice(0, MAX_OUTPUT_CHARS) };
}

function withTimeout<T>(p: Promise<T>, ms: number, name: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${name} 이(가) ${ms / 1000}초 안에 끝나지 않았어요`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * 도구를 실제로 실행하고 감사 기록을 남긴다. 승인 게이트를 이미 지난 호출과 승인이 필요 없는 호출이 쓴다.
 */
export async function runTool(
  spec: AiToolSpec<unknown>,
  input: unknown,
  ctx: AiToolContext,
  approvalId?: string,
): Promise<{ ok: true; output: unknown } | { ok: false; error: string }> {
  const started = Date.now();
  const base = {
    approvalId,
    conversationId: ctx.conversationId,
    userId: ctx.principal.userId,
    toolName: spec.name,
    input,
  };
  try {
    const output = await withTimeout(spec.execute(input, ctx), spec.timeoutMs ?? DEFAULT_TIMEOUT_MS, spec.label);
    await withTenant(ctx.principal.schemaName, async (db) => {
      if (approvalId) {
        await db.query(
          `UPDATE ai_tool_audit SET status = 'executed', output_preview = $2, duration_ms = $3 WHERE approval_id = $1`,
          [approvalId, preview(output), Date.now() - started],
        );
      } else {
        await audit(db, { ...base, status: "executed", outputPreview: preview(output), durationMs: Date.now() - started });
      }
    });
    return { ok: true, output: capOutput(output) };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[ai-tool] ${spec.name} 실패`, e);
    await withTenant(ctx.principal.schemaName, async (db) => {
      if (approvalId) {
        await db.query(
          `UPDATE ai_tool_audit SET status = 'failed', error = $2, duration_ms = $3 WHERE approval_id = $1`,
          [approvalId, error, Date.now() - started],
        );
      } else {
        await audit(db, { ...base, status: "failed", error, durationMs: Date.now() - started });
      }
    }).catch((err) => console.error("[ai-tool] 감사 기록 실패", err));
    return { ok: false, error };
  }
}

/**
 * `streamText` 에 넘길 도구 집합. 승인이 필요한 도구는 실행 대신 승인 요청을 기록하고 모델에는
 * "승인 대기" 를 돌려준다 — 모델은 그 사실을 사용자에게 알리는 것으로 턴을 마친다.
 *
 * @param onApproval 승인 요청이 생길 때마다 불린다. 호출부가 화면에 `data-approval` 파트를 보낸다
 */
export function toolSetFor(ctx: AiToolContext, onApproval: (a: ApprovalRequest) => void): ToolSet {
  const set: ToolSet = {};
  for (const spec of registry.values()) {
    set[spec.name] = tool({
      description: spec.description,
      inputSchema: spec.inputSchema,
      execute: async (input: unknown) => {
        if (spec.needsApproval) {
          const approvalId = randomUUID();
          await withTenant(ctx.principal.schemaName, (db) =>
            audit(db, {
              approvalId,
              conversationId: ctx.conversationId,
              userId: ctx.principal.userId,
              toolName: spec.name,
              input,
              status: "proposed",
            }),
          );
          onApproval({ approvalId, toolName: spec.name, label: spec.label, input });
          return {
            status: "approval_required",
            message:
              "이 도구는 사용자 승인이 필요합니다. 아직 실행되지 않았습니다. 무엇을 실행하려는지 짧게 설명하고 승인을 기다리세요.",
          };
        }
        const r = await runTool(spec, input, ctx);
        return r.ok ? r.output : { status: "failed", error: r.error };
      },
    });
  }
  return set;
}

/**
 * 화면에서 돌아온 승인·거절. 감사 기록의 `proposed` 행을 찾아 결정을 남기고, 승인이면 **기록된 입력으로** 실행한다.
 * 본인 대화의 요청만 처리한다(user_id · conversation_id 확인).
 */
export async function decideApproval(
  ctx: AiToolContext,
  approvalId: string,
  approved: boolean,
): Promise<
  | { kind: "not_found" }
  | { kind: "denied"; toolName: string; label: string }
  | { kind: "executed"; toolName: string; label: string; input: unknown; output: unknown }
  | { kind: "failed"; toolName: string; label: string; input: unknown; error: string }
> {
  const row = await withTenant(ctx.principal.schemaName, async (db) => {
    const { rows } = await db.query<AuditRow>(
      `SELECT approval_id, conversation_id, user_id, tool_name, input, status
         FROM ai_tool_audit
        WHERE approval_id = $1 AND user_id = $2 AND conversation_id = $3 AND status = 'proposed'`,
      [approvalId, ctx.principal.userId, ctx.conversationId],
    );
    const r = rows[0];
    if (!r) return null;
    await db.query(`UPDATE ai_tool_audit SET status = $2, decided_at = now() WHERE approval_id = $1`, [
      approvalId,
      approved ? "approved" : "denied",
    ]);
    return r;
  });
  if (!row) return { kind: "not_found" };
  const spec = registry.get(row.tool_name);
  const label = spec?.label ?? row.tool_name;
  if (!approved) return { kind: "denied", toolName: row.tool_name, label };
  if (!spec) return { kind: "failed", toolName: row.tool_name, label, input: row.input, error: "지금은 쓸 수 없는 도구예요" };
  const r = await runTool(spec, row.input, ctx, approvalId);
  return r.ok
    ? { kind: "executed", toolName: spec.name, label, input: row.input, output: r.output }
    : { kind: "failed", toolName: spec.name, label, input: row.input, error: r.error };
}

export function hasTools(): boolean {
  return registry.size > 0;
}

/* ─────────────────────────── 데모 도구 ─────────────────────────── */

if (process.env.AI_DEMO_TOOLS === "1") {
  registerTool({
    name: "now",
    label: "현재 시각 조회",
    description: "지금 시각(Asia/Seoul)을 돌려준다. 날짜·요일·시간 계산이 필요할 때 부른다.",
    inputSchema: z.object({}),
    needsApproval: false,
    execute: async () => ({
      iso: new Date().toISOString(),
      local: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
    }),
  });
  registerTool({
    name: "draft_note",
    label: "업무 메모 남기기",
    description:
      "사용자를 대신해 업무 메모를 남긴다. 기록이 남는 동작이므로 사용자 승인이 필요하다. title 과 body 를 채워 부른다. " +
      "메모는 이 회사의 AI 도구 실행 기록(감사 로그)에 저장되며, 결과의 where 가 저장 위치다.",
    inputSchema: z.object({
      title: z.string().min(1).max(80).describe("메모 제목"),
      body: z.string().min(1).max(2000).describe("메모 본문"),
    }),
    needsApproval: true,
    execute: async (input) => ({
      saved: true,
      where: "AI 도구 실행 기록(감사 로그)",
      title: input.title,
      length: input.body.length,
      savedAt: new Date().toISOString(),
    }),
  });
  console.info("[ai-tool] 데모 도구 켜짐: now, draft_note");
}
