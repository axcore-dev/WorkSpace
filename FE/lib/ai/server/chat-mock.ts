/**
 * 대본(mock) 응답 — **모델 키가 없을 때의 대체 경로.**
 *
 * `ANTHROPIC_API_KEY` 가 설정되지 않은 환경(로컬 개발 · 데모)에서 화면을 눈으로 확인할 수 있게 남겨
 * 둔다. 실제 답변은 `chat-llm.ts` 가 만들고, 이 파일은 같은 와이어 포맷(UI Message Stream)으로 대본을
 * 흘리는 참고 구현이다. 인증은 이 경로도 똑같이 거친다 — 라우트가 먼저 `authenticate` 를 부른 뒤에
 * 여기로 온다.
 */
import "server-only";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { SKILL_LIB, type ChatMessage, type TraceStep } from "@/data/chat";
import type { AnswerMeta, AxpUIMessage } from "@/lib/ai/ui-messages";
import {
  REPLY_ROUTES,
  SCRIPTED_CALENDAR_REPLY,
  SCRIPTED_REPLIES,
} from "@/app/ai/_mock/scenarios";
/** 대본이 보는 턴. 저장·히스토리가 없으므로 실제 턴(`chat-llm.ts`)보다 단순하다 */
export interface Turn {
  question: string;
  sources: string[];
  skills: string[];
  approving: boolean;
}

/** 추론 문구 사이 간격 — 너무 빠르면 문구가 읽히지 않는다 */
const LABEL_MS = 550;
/** 도구 행이 하나씩 드러나는 간격 */
const TRACE_MS = 450;
/** 본문 조각 — 2글자씩 흘린다 (화면의 타자 효과와 같은 속도) */
const DELTA_CHARS = 2;
const DELTA_MS = 18;

/** 질문 키워드로 대본을 고른다 */
function pickReply(q: string, approving: boolean): ChatMessage {
  if (approving) return SCRIPTED_REPLIES[2];
  if (/캘린더|일정|스케줄/.test(q)) return SCRIPTED_CALENDAR_REPLY;
  if (/발주서|OCR|주문서/i.test(q)) return SCRIPTED_REPLIES[1];
  const hit = REPLY_ROUTES.find((r) => r.pattern.test(q));
  return SCRIPTED_REPLIES[hit?.index ?? 0];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function streamScripted(turn: Turn, signal: AbortSignal): Response {
  const reply = pickReply(turn.question, turn.approving);
  const startedAt = Date.now();

  const skillNames = turn.skills
    .map((id) => SKILL_LIB.find((s) => s.id === id)?.name)
    .filter((n) => n !== undefined);
  const rows: TraceStep[] = [
    ...(skillNames.length
      ? [{ icon: "model" as const, text: `스킬 적용 — ${skillNames.join(", ")}` }]
      : []),
    ...(reply.process?.trace ?? []),
  ];

  const stream = createUIMessageStream<AxpUIMessage>({
    onError: () => "답변을 받지 못했어요",
    async execute({ writer }) {
      const textId = "t0";
      writer.write({ type: "start" });
      writer.write({ type: "start-step" });

      for (const text of reply.reasoning ?? []) {
        if (signal.aborted) return;
        writer.write({ type: "data-label", data: { text } });
        await sleep(LABEL_MS);
      }
      for (const row of rows) {
        if (signal.aborted) return;
        writer.write({ type: "data-trace", data: row });
        await sleep(TRACE_MS);
      }

      writer.write({ type: "text-start", id: textId });
      for (let i = 0; i < reply.text.length; i += DELTA_CHARS) {
        if (signal.aborted) return;
        writer.write({
          type: "text-delta",
          id: textId,
          delta: reply.text.slice(i, i + DELTA_CHARS),
        });
        await sleep(DELTA_MS);
      }
      writer.write({ type: "text-end", id: textId });

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
