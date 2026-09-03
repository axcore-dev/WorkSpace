/**
 * ⚠️ AI-MOCK — BE 연동 시 삭제 대상 ⚠️
 *
 * `POST /api/ai/chat` SSE 목업. BE에 같은 계약의 엔드포인트가 생기면 이 폴더째 지운다
 * (지우는 순서는 `../_mock/scenarios.ts` 헤더 참고).
 *
 * 계약은 `FE/lib/chat-api.ts` 주석이 기준이다 — 이벤트 이름·페이로드를 그대로 맞춰 두었으니
 * BE는 이 라우트를 참고 구현으로 쓰면 된다.
 *   label {"text"} · trace TraceStep · delta {"text"} · message ChatMessage · error ApiError
 */
import type { ChatMessage } from "@/data/chat";
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

const MAX_MESSAGE = 4000;
const MAX_SOURCES = 50;

interface ChatBody {
  conversationId: number;
  message: string;
  sources: string[];
  action?: { type: "approve-proposal" };
}

/**
 * 요청 본문 검증 — 외부 입력이라 통과시키기 전에 형태를 확인한다.
 * zod를 쓰지 않는 이유: 목업 하나 때문에 의존성을 늘리지 않는다. BE 라우트가 생기면 같이 사라진다.
 */
function parseBody(raw: unknown): ChatBody | null {
  if (typeof raw !== "object" || raw === null) return null;
  const v = raw as Record<string, unknown>;
  if (
    typeof v.conversationId !== "number" ||
    !Number.isFinite(v.conversationId)
  )
    return null;
  if (typeof v.message !== "string" || v.message.length > MAX_MESSAGE)
    return null;
  const sources = Array.isArray(v.sources) ? v.sources : [];
  if (
    sources.length > MAX_SOURCES ||
    sources.some((s) => typeof s !== "string")
  )
    return null;
  const action =
    typeof v.action === "object" &&
    v.action !== null &&
    (v.action as Record<string, unknown>).type === "approve-proposal"
      ? ({ type: "approve-proposal" } as const)
      : undefined;
  return {
    conversationId: v.conversationId,
    message: v.message,
    sources: sources as string[],
    action,
  };
}

/** 질문 키워드로 대본을 고른다 — 실제 BE는 여기서 LLM을 부른다 */
function pickReply(body: ChatBody): ChatMessage {
  if (body.action?.type === "approve-proposal") return SCRIPTED_REPLIES[2];
  const q = body.message;
  if (/캘린더|일정|스케줄/.test(q)) return SCRIPTED_CALENDAR_REPLY;
  if (/발주서|OCR|주문서/i.test(q)) return SCRIPTED_REPLIES[1];
  const hit = REPLY_ROUTES.find((r) => r.pattern.test(q));
  return SCRIPTED_REPLIES[hit?.index ?? 0];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  const body = parseBody(await req.json().catch(() => null));
  if (!body) {
    return Response.json(
      { code: "VALIDATION_FAILED", message: "요청 형태가 올바르지 않아요" },
      { status: 400 },
    );
  }

  const reply = pickReply(body);
  const startedAt = Date.now();
  const enc = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (event: string, data: unknown) =>
        controller.enqueue(enc.encode(sse(event, data)));
      try {
        for (const text of reply.reasoning ?? []) {
          if (req.signal.aborted) break;
          push("label", { text });
          await sleep(LABEL_MS);
        }
        for (const row of reply.process?.trace ?? []) {
          if (req.signal.aborted) break;
          push("trace", row);
          await sleep(TRACE_MS);
        }
        for (
          let i = 0;
          i < reply.text.length && !req.signal.aborted;
          i += DELTA_CHARS
        ) {
          push("delta", { text: reply.text.slice(i, i + DELTA_CHARS) });
          await sleep(DELTA_MS);
        }
        push("message", { ...reply, durationMs: Date.now() - startedAt });
      } catch {
        push("error", { code: "MOCK_FAILED", message: "답변을 받지 못했어요" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      // 프록시가 스트림을 모아 두면 한 번에 도착해 타자 효과가 사라진다
      "X-Accel-Buffering": "no",
    },
  });
}
