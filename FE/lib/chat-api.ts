/**
 * AI대화 BE API 클라이언트 — 화면이 BE와 닿는 유일한 자리다.
 *
 * BE(Spring, :8080)에는 아직 이 엔드포인트가 없다. 계약을 FE가 먼저 못 박아 두고 BE가 맞춘다.
 * 그동안 화면을 확인할 수 있게 같은 계약의 목업 라우트를 FE에 두었다(`app/api/ai/`, AI-MOCK).
 * 실패하면 예외를 던진다 — 화면 코드에 데모 폴백은 없다. '답변을 받지 못했어요 · 다시 시도'로 받는다.
 *
 * ── POST /api/ai/chat  (Accept: text/event-stream) ────────────────────────────
 * 요청  ChatRequest (JSON)
 * 응답  SSE. `event:` 이름과 `data:` JSON 한 덩이씩. 순서는 label/trace/delta가 섞여 오고 message로 끝난다.
 *   label    {"text": string}   헤더에 흐르는 추론 문구를 교체한다
 *   trace    TraceStep          도구 행을 하나 추가한다
 *   delta    {"text": string}   본문 조각 — 이어 붙여 실시간으로 보여준다
 *   message  ChatMessage        최종 답변. text가 비어 있으면 delta 누적본, durationMs가 없으면 요청~응답 시간을 채운다.
 *                               이 이벤트로 스트림이 끝난다
 *   error    ApiError           실패. message는 화면에 그대로 띄울 수 있는 문구
 *
 * ── POST /api/ai/sources  (multipart/form-data, 필드명 files) ───────────────
 * 응답  SourceDoc[] — 등록된 문서 메타. 이후 chat 요청의 sources에 name으로 넘긴다.
 */
import { ApiRequestError, type ApiError } from "@/lib/api";
import type {
  ChatMessage,
  OcrProposal,
  SourceDoc,
  TraceStep,
} from "@/data/chat";

/**
 * ⚠️ AI-MOCK — BE 연동 시 삭제 대상 ⚠️
 *
 * BE에 `/api/ai/*`가 아직 없어서 같은 오리진의 FE 목업 라우트(`app/api/ai/`)를 부른다.
 * BE가 준비되면 이 상수를 지우고 아래 두 fetch를 `${API_BASE}`로 되돌린 뒤
 * `app/api/ai/` 폴더를 삭제한다 (`grep -r "AI-MOCK" FE/`로 남은 자리 확인).
 * 그 전에 실제 BE로 붙여 보려면 `NEXT_PUBLIC_AI_API_BASE=http://localhost:8080`만 주면 된다.
 */
const AI_BASE = process.env.NEXT_PUBLIC_AI_API_BASE ?? "";

/** 질문이 아닌 턴 — 제안 카드 승인. 대화는 FE(localStorage)에만 있으므로 제안 내용을 통째로 넘긴다 */
export type ChatAction = { type: "approve-proposal"; proposal: OcrProposal };

export interface ChatRequest {
  conversationId: number;
  message: string;
  /** 선택된 소스 문서 이름 */
  sources: string[];
  action?: ChatAction;
}

export interface ChatStreamHandlers {
  onLabel?: (text: string) => void;
  onTrace?: (row: TraceStep) => void;
  onDelta?: (text: string) => void;
}

const UNKNOWN: ApiError = { code: "UNKNOWN", message: "답변을 받지 못했어요" };

/** SSE 본문을 (event, data) 단위로 넘긴다. 이벤트 경계는 빈 줄이다 */
async function* sseEvents(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
) {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let cut: number;
      while ((cut = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, cut);
        buf = buf.slice(cut + 2);
        let event = "message";
        const data: string[] = [];
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:"))
            data.push(line.slice(5).trimStart());
        }
        if (data.length) yield { event, data: data.join("\n") };
      }
    }
  } finally {
    if (signal?.aborted) await reader.cancel().catch(() => {});
  }
}

/**
 * 한 턴을 보내고 스트림을 끝까지 읽어 최종 답변을 돌려준다.
 * 중간 이벤트는 handlers로 흘리고, 서버가 delta 없이 message만 보내도 동작한다.
 */
export async function streamChat(
  req: ChatRequest,
  handlers: ChatStreamHandlers = {},
  signal?: AbortSignal,
): Promise<ChatMessage> {
  const startedAt = Date.now();
  const res = await fetch(`${AI_BASE}/api/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    credentials: "include",
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) {
    const parsed = (await res.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(res.status, parsed ?? UNKNOWN);
  }

  let draft = "";
  for await (const { event, data } of sseEvents(res.body, signal)) {
    const payload = JSON.parse(data) as unknown;
    switch (event) {
      case "label":
        handlers.onLabel?.((payload as { text: string }).text);
        break;
      case "trace":
        handlers.onTrace?.(payload as TraceStep);
        break;
      case "delta": {
        const t = (payload as { text: string }).text;
        draft += t;
        handlers.onDelta?.(t);
        break;
      }
      case "message": {
        const msg = payload as ChatMessage;
        return {
          ...msg,
          role: "ai",
          text: msg.text || draft,
          durationMs: msg.durationMs ?? Date.now() - startedAt,
        };
      }
      case "error":
        throw new ApiRequestError(res.status, (payload as ApiError) ?? UNKNOWN);
    }
  }
  throw new ApiRequestError(res.status, {
    code: "INCOMPLETE",
    message: "답변이 도중에 끊겼어요",
  });
}

/** 소스 문서 업로드 — 등록된 메타를 돌려준다 */
export async function uploadSources(files: File[]): Promise<SourceDoc[]> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const res = await fetch(`${AI_BASE}/api/ai/sources`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const parsed = (await res.json().catch(() => null)) as unknown;
  if (!res.ok)
    throw new ApiRequestError(
      res.status,
      (parsed as ApiError | null) ?? UNKNOWN,
    );
  return parsed as SourceDoc[];
}
