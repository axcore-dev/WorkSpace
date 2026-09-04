/**
 * AI 스트림 계약의 FE 절반.
 *
 * BE(Spring)가 나중에 이 라우트를 가져가면 **여기 정의된 파트를 그대로 내보내야 한다.** 그때
 * 고치는 파일은 `lib/ai/transport.ts`의 엔드포인트 한 줄뿐이고, 이 파일과 화면은 그대로 둔다.
 *
 * ── 왜 커스텀 SSE(`event: label` …)를 버렸나 ──────────────────────────────────
 * 직접 만든 프로토콜은 도구 호출에 상태가 없었다. 한 턴에 tool 이 6~10회 도는 화면을 그리려면
 * "입력이 흘러오는 중 / 입력 확정 / 실행 중 / 결과 도착 / 실패" 를 구분해야 하는데, 그걸
 * 이벤트 이름 다섯 개로 다시 만드는 대신 AI SDK 의 UI Message Stream 프로토콜을 쓴다.
 * `tool-*` 파트가 그 라이프사이클을 이미 갖고 있다.
 *
 * ── 파트 구성 ───────────────────────────────────────────────────────────────
 *   text            본문. text-start/delta/end 3종 세트 (이전 `delta`)
 *   tool-<name>     도구 호출. 상태 전이를 SDK 가 관리한다 (BE 연동 뒤에 실제로 흐른다)
 *   data-label      헤더에 흐르는 추론 문구. 여러 번 (이전 `label`)
 *   data-trace      도구 행 하나. 여러 번 (이전 `trace`)
 *   data-answer     본문 외 부가 정보. 턴당 한 번 (이전 `message` 스냅샷의 나머지)
 *   metadata        durationMs. finish 에 실린다
 *
 * 이전 `message` 이벤트는 없어졌다. 최종 메시지는 파트를 누적해 만들어지므로 스냅샷을 따로
 * 보내면 같은 내용이 두 벌이 되고, 둘이 어긋나면 화면이 흔들린다.
 */
import { getToolName, isToolUIPart, type UIMessage } from "ai";
import type {
  ChatMessage,
  ChatProcess,
  ChatSource,
  OcrProposal,
  TraceStep,
} from "@/data/chat";

/** 턴 단위 부가 정보. `finish` 에 실려 온다 */
export interface AxpMetadata {
  /** AI 활동 시간 — 출처 드로어 상단 "{n}s" */
  durationMs?: number;
}

/**
 * 본문·도구 행으로 표현되지 않는 나머지. 턴당 한 번 보낸다.
 *
 * 스트리밍 도중이 아니라 답이 굳은 뒤에 확정되는 것들이라 조각으로 흘리지 않는다.
 */
export interface AnswerMeta {
  /** 인용한 출처 (스니펫 포함) */
  sources?: ChatSource[];
  /** 인용까지는 안 했지만 열어 본 문서 이름 (`ChatProcess.sources`) */
  consulted?: string[];
  /** 사용한 도구 이름 — 추론 과정 접힘 상태의 한 줄 요약에 쓰인다 */
  tools?: string[];
  summary?: string;
  ocrProposal?: OcrProposal;
  cta?: { label: string; href: string };
  attachment?: string;
}

/**
 * `data-<이름>` 파트의 이름과 페이로드.
 *
 * 키 이름이 곧 와이어 포맷이다 — `label` 은 `{"type":"data-label", ...}` 로 나간다.
 * BE 가 이 이름을 그대로 써야 한다.
 */
export type AxpDataParts = {
  label: { text: string };
  trace: TraceStep;
  answer: AnswerMeta;
};

export type AxpUIMessage = UIMessage<AxpMetadata, AxpDataParts>;

/** 도구 파트 상태 → 사람이 읽는 문구. 실행 중인 행도 화면에 보여야 한다 */
function traceFromToolPart(
  name: string,
  state: string,
  input: unknown,
  output: unknown,
  errorText: string | undefined,
): TraceStep {
  const json = (v: unknown) =>
    v === undefined ? undefined : JSON.stringify(v, null, 2);
  if (state === "output-error") {
    return { icon: "model", text: `${name} 실패`, result: errorText };
  }
  if (state === "output-available") {
    return {
      icon: "model",
      text: name,
      input: json(input),
      output: json(output),
    };
  }
  // input-streaming · input-available — 아직 결과가 없다. 행은 지금 나와야 한다
  return { icon: "model", text: `${name} 실행 중`, input: json(input) };
}

/**
 * 스트리밍 중이든 끝났든 파트를 화면이 아는 모양으로 접는다.
 *
 * 화면 컴포넌트(`components/chat/*`)를 프로토콜에서 떼어 놓기 위한 자리다. 파트 구조가
 * 바뀌어도 고치는 곳이 이 함수 하나면 된다.
 */
export function toChatMessage(m: AxpUIMessage): ChatMessage {
  let text = "";
  const reasoning: string[] = [];
  const trace: TraceStep[] = [];
  let answer: AnswerMeta = {};

  for (const part of m.parts) {
    if (part.type === "text") {
      text += part.text;
    } else if (part.type === "data-label") {
      reasoning.push(part.data.text);
    } else if (part.type === "data-trace") {
      trace.push(part.data);
    } else if (part.type === "data-answer") {
      answer = part.data;
    } else if (isToolUIPart(part)) {
      trace.push(
        traceFromToolPart(
          getToolName(part),
          part.state,
          part.input,
          "output" in part ? part.output : undefined,
          "errorText" in part ? part.errorText : undefined,
        ),
      );
    }
  }

  // process 가 없으면 화면이 추론 과정 블록을 아예 안 그린다. 보여줄 게 하나라도 있을 때만 만든다.
  const hasProcess =
    trace.length > 0 ||
    (answer.consulted?.length ?? 0) > 0 ||
    (answer.tools?.length ?? 0) > 0;
  const process: ChatProcess | undefined = hasProcess
    ? {
        sources: answer.consulted ?? [],
        steps: [],
        tools: answer.tools ?? [],
        trace,
        summary: answer.summary,
      }
    : undefined;

  return {
    role: m.role === "user" ? "user" : "ai",
    text,
    sources: answer.sources,
    process,
    ocrProposal: answer.ocrProposal,
    attachment: answer.attachment,
    cta: answer.cta,
    reasoning: reasoning.length ? reasoning : undefined,
    durationMs: m.metadata?.durationMs,
  };
}
