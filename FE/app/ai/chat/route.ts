/**
 * ⚠️ AI-MOCK — BE 연동 시 삭제 대상 ⚠️
 *
 * `POST /ai/chat` 대본 스트림. BE(Spring)에 같은 계약의 엔드포인트가 생기면 이 폴더째 지운다
 * (지우는 순서는 `../_mock/scenarios.ts` 헤더 참고).
 *
 * **여기에 프롬프트도 tool 정의도 두지 않는다.** 모델 호출은 BE 가 한다. 이 라우트가 하는 일은
 * 대본(`_mock/scenarios.ts`)을 AI SDK 의 UI Message Stream 프로토콜로 인코딩하는 것뿐이고,
 * 그래서 BE 는 이 파일을 와이어 포맷의 참고 구현으로 쓸 수 있다.
 *
 * ── BE 가 맞춰야 할 것 ──────────────────────────────────────────────────────
 * 응답 헤더 (`createUIMessageStreamResponse` 가 붙여 준다):
 *   Content-Type: text/event-stream / Cache-Control: no-cache / Connection: keep-alive
 *   x-vercel-ai-ui-message-stream: v1   ← 없으면 useChat 이 스트림으로 안 본다
 *   X-Accel-Buffering: no               ← nginx. 다만 프록시 설정에도 넣어 뒀다(단일 실패점 회피)
 *
 * 본문은 `event:` 없이 `data: {json}\n\n` 한 줄씩이고 `data: [DONE]\n\n` 으로 끝난다.
 * 파트 종류는 `@/lib/ai/ui-messages` 를 그대로 따른다.
 */
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { z } from "zod";
import { SKILL_LIB, type ChatMessage, type TraceStep } from "@/data/chat";
import type { AnswerMeta, AxpUIMessage } from "@/lib/ai/ui-messages";
import {
  REPLY_ROUTES,
  SCRIPTED_CALENDAR_REPLY,
  SCRIPTED_REPLIES,
} from "../_mock/scenarios";

/** 추론 문구 사이 간격 — 너무 빠르면 문구가 읽히지 않는다 */
const LABEL_MS = 550;
/** 도구 행이 하나씩 드러나는 간격 */
const TRACE_MS = 450;
/** 본문 조각 — 2글자씩 흘린다 (화면의 타자 효과와 같은 속도) */
const DELTA_CHARS = 2;
const DELTA_MS = 18;

/**
 * 요청 본문 검증 — 외부 입력이라 통과시키기 전에 형태를 확인한다.
 *
 * 화면이 보내는 파트 전부를 검증하지 않는다. 이 라우트가 실제로 읽는 것은 텍스트 파트뿐이고,
 * 나머지는 `passthrough` 로 흘려보낸다 — 안 읽는 값을 검증해 봐야 계약만 굳는다.
 */
const bodySchema = z.object({
  conversationId: z.number().finite(),
  sources: z.array(z.string()).max(50).default([]),
  skills: z.array(z.string()).max(20).default([]),
  action: z.object({ type: z.literal("approve-proposal") }).optional(),
  message: z.object({
    parts: z.array(
      z.looseObject({ type: z.string(), text: z.string().optional() }),
    ),
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

/** 질문 키워드로 대본을 고른다 — 실제 BE는 여기서 LLM을 부른다 */
function pickReply(q: string, approving: boolean): ChatMessage {
  if (approving) return SCRIPTED_REPLIES[2];
  if (/캘린더|일정|스케줄/.test(q)) return SCRIPTED_CALENDAR_REPLY;
  if (/발주서|OCR|주문서/i.test(q)) return SCRIPTED_REPLIES[1];
  const hit = REPLY_ROUTES.find((r) => r.pattern.test(q));
  return SCRIPTED_REPLIES[hit?.index ?? 0];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { code: "VALIDATION_FAILED", message: "요청 형태가 올바르지 않아요" },
      { status: 400 },
    );
  }
  const body = parsed.data;
  const question = userText(body.message.parts);
  if (question.length > MAX_MESSAGE) {
    return Response.json(
      { code: "VALIDATION_FAILED", message: "질문이 너무 길어요" },
      { status: 400 },
    );
  }

  const reply = pickReply(question, body.action?.type === "approve-proposal");
  const startedAt = Date.now();

  // 스킬이 물려 있으면 도구 행 맨 앞에 한 줄 끼운다 — 요청이 서버까지 닿았는지 눈으로 확인된다
  const skillNames = body.skills
    .map((id) => SKILL_LIB.find((s) => s.id === id)?.name)
    .filter((n) => n !== undefined);
  const rows: TraceStep[] = [
    ...(skillNames.length
      ? [{ icon: "model" as const, text: `스킬 적용 — ${skillNames.join(", ")}` }]
      : []),
    ...(reply.process?.trace ?? []),
  ];

  const stream = createUIMessageStream<AxpUIMessage>({
    // 기본값은 오류 문구를 감춘다. 대본 라우트라 감출 내부 정보가 없고, 화면이 그대로 띄운다.
    onError: () => "답변을 받지 못했어요",
    async execute({ writer }) {
      const textId = "t0";
      writer.write({ type: "start" });
      writer.write({ type: "start-step" });

      for (const text of reply.reasoning ?? []) {
        if (req.signal.aborted) return;
        writer.write({ type: "data-label", data: { text } });
        await sleep(LABEL_MS);
      }
      for (const row of rows) {
        if (req.signal.aborted) return;
        writer.write({ type: "data-trace", data: row });
        await sleep(TRACE_MS);
      }

      writer.write({ type: "text-start", id: textId });
      for (let i = 0; i < reply.text.length; i += DELTA_CHARS) {
        if (req.signal.aborted) return;
        writer.write({
          type: "text-delta",
          id: textId,
          delta: reply.text.slice(i, i + DELTA_CHARS),
        });
        await sleep(DELTA_MS);
      }
      writer.write({ type: "text-end", id: textId });

      // 본문 외 나머지. 답이 굳은 뒤에 한 번만 보낸다.
      // trace 는 여기 넣지 않는다 — 방금 흘린 data-trace 와 두 벌이 되고, 어긋나면 화면이 흔들린다.
      const answer: AnswerMeta = {
        sources: reply.sources,
        consulted: reply.process?.sources,
        tools: reply.process?.tools,
        summary: reply.process?.summary,
        ocrProposal: reply.ocrProposal,
        cta: reply.cta,
        attachment: reply.attachment,
      };
      writer.write({ type: "data-answer", data: answer });

      writer.write({ type: "finish-step" });
      writer.write({
        type: "finish",
        messageMetadata: { durationMs: Date.now() - startedAt },
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
