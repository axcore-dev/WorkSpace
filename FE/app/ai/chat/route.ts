/**
 * `POST /ai/chat` — AI 대화 스트림. **FE 안의 AI 서버다.**
 *
 * 모델 호출·검색(RAG)·스트리밍·대화 저장을 이 Next Route Handler 가 맡는다. BE(Spring)는 인증 판정
 * (`POST /api/auth/introspect`)과 업무 데이터의 원장으로 남는다. 왜 이렇게 나눴는지는
 * docs/ai/ai-server.md 참고.
 *
 * ── 순서 ────────────────────────────────────────────────────────────────────
 * 1. `authenticate` — 모든 요청이 BE 판정을 거친다. 실패하면 스트림을 열지 않고 JSON 오류로 답한다.
 * 2. 본문 검증(zod). `conversationId` 는 화면이 `POST /ai/conversations` 로 먼저 만든 값이고, 본인 것이어야 한다.
 * 3. 대화 모델 키가 있으면 실제 모델(`chat-llm`, 프로바이더는 `models.ts`), 없으면 대본(`chat-mock`).
 *    `action: tool-approval` 은 승인 턴(`runApprovalTurn`)으로 간다.
 *
 * ── 응답 헤더 (`createUIMessageStreamResponse` 가 붙여 준다) ──────────────────
 *   Content-Type: text/event-stream / Cache-Control: no-cache / Connection: keep-alive
 *   x-vercel-ai-ui-message-stream: v1   ← 없으면 useChat 이 스트림으로 안 본다
 *   X-Accel-Buffering: no               ← nginx. 다만 프록시 설정에도 넣어 뒀다(단일 실패점 회피)
 *
 * 본문은 `event:` 없이 `data: {json}\n\n` 한 줄씩이고 `data: [DONE]\n\n` 으로 끝난다.
 * 파트 종류는 `@/lib/ai/ui-messages` 를 그대로 따른다.
 */
import { z } from "zod";
import { authenticate } from "@/lib/ai/server/auth";
import { runApprovalTurn, streamAnswer, type Turn } from "@/lib/ai/server/chat-llm";
import { streamScripted } from "@/lib/ai/server/chat-mock";
import { findConversation } from "@/lib/ai/server/conversations";
import { withTenant } from "@/lib/ai/server/db";
import { handle, HttpError } from "@/lib/ai/server/http";
import { hasChatModel } from "@/lib/ai/server/models";

/**
 * 요청 본문 검증 — 외부 입력이라 통과시키기 전에 형태를 확인한다.
 *
 * 화면이 보내는 파트 전부를 검증하지 않는다. 이 라우트가 실제로 읽는 것은 텍스트 파트뿐이고,
 * 나머지는 흘려보낸다 — 안 읽는 값을 검증해 봐야 계약만 굳는다.
 */
const bodySchema = z.object({
  conversationId: z.string().uuid(),
  sources: z.array(z.string().max(200)).max(50).default([]),
  skills: z.array(z.string().max(50)).max(20).default([]),
  apps: z.array(z.string().regex(/^[a-z]{1,30}$/)).max(20).default([]),
  replaceFromSeq: z.number().int().positive().optional(),
  action: z
    .discriminatedUnion("type", [
      z.object({ type: z.literal("approve-proposal") }),
      z.object({
        type: z.literal("tool-approval"),
        approvalId: z.string().uuid(),
        approved: z.boolean(),
      }),
    ])
    .optional(),
  message: z.object({
    parts: z.array(z.looseObject({ type: z.string(), text: z.string().optional() })),
  }),
});

const MAX_MESSAGE = 4000;

/** 사용자가 실제로 친 문장. 파트가 여러 개면 이어 붙인다 */
function userText(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
}

export async function POST(req: Request) {
  return handle(async () => {
    const principal = await authenticate(req);

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_FAILED", "요청 형태가 올바르지 않아요");
    }
    const body = parsed.data;
    const question = userText(body.message.parts).trim();
    if (question.length > MAX_MESSAGE) {
      throw new HttpError(400, "VALIDATION_FAILED", "질문이 너무 길어요");
    }
    if (!question && !body.action) {
      throw new HttpError(400, "VALIDATION_FAILED", "질문이 비어 있어요");
    }

    // 대화는 본인 것이어야 한다. 남의 대화 id 를 넣어도 여기서 404 로 끝난다
    const conv = await withTenant(principal.schemaName, (db) =>
      findConversation(db, principal.userId, body.conversationId),
    );
    if (!conv) throw new HttpError(404, "NOT_FOUND", "대화를 찾을 수 없어요");

    // 도구가 BE 를 부를 때 그대로 전달한다 — introspect 처럼 사용자 토큰 + 내부 토큰 두 겹이다
    const accessToken = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

    const turn: Turn = {
      question,
      sources: body.sources,
      skills: body.skills,
      apps: body.apps,
      accessToken,
      replaceFromSeq: body.replaceFromSeq,
      action: body.action,
    };

    // 대화 모델 키가 없으면 대본. 저장은 하지 않는다 — 대본은 화면 확인용이다
    if (!hasChatModel()) {
      return streamScripted(
        { question, sources: turn.sources, skills: turn.skills, approving: body.action?.type === "approve-proposal" },
        req.signal,
      );
    }
    if (body.action?.type === "tool-approval") {
      return runApprovalTurn(principal, conv, body.action, accessToken, req.signal);
    }
    return streamAnswer(principal, conv, turn, req.signal);
  });
}
