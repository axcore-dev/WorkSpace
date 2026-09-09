/**
 * `useChat` 이 쓰는 전송 계층.
 *
 * 같은 오리진의 Next Route Handler(`app/ai/chat`)를 부른다. 그 라우트가 곧 AI 서버다 — 모델 호출·
 * 검색·스트리밍을 FE 안에서 처리하고, BE(Spring)에는 토큰 판정만 묻는다(docs/ai/ai-server.md).
 * AI 서버를 나중에 별도 인스턴스로 떼어내면 `NEXT_PUBLIC_AI_API_BASE` 에 그 주소를 넣는 것으로
 * 끝난다 — 프로토콜이 같으므로 화면도 `lib/ai/ui-messages.ts` 도 그대로다.
 *
 * ── 경로가 `/api/` 가 아닌 이유 ────────────────────────────────────────────
 * nginx 가 `/api/*` 를 전부 Spring 으로 보낸다(`INFRA/nginx/default.conf`). Route Handler 를
 * `app/api/` 아래에 두면 `next dev` 에서만 동작하고 배포하면 절대 안 불린다. 로컬에서 멀쩡한
 * 채로 운영에서만 깨지는 종류라 경로를 아예 분리했다.
 */
import { DefaultChatTransport } from "ai";
import { ensureAccessToken } from "@/lib/session";
import type { OcrProposal } from "@/data/chat";
import type { AxpUIMessage } from "./ui-messages";

/** 비어 있으면 같은 오리진(Next Route Handler). AI 서버를 분리 배포할 때만 값이 생긴다 */
const AI_BASE = process.env.NEXT_PUBLIC_AI_API_BASE ?? "";

const AI_PREFIX = AI_BASE ? `${AI_BASE}/ai` : "/ai";

export const CHAT_ENDPOINT = `${AI_PREFIX}/chat`;
export const SOURCES_ENDPOINT = `${AI_PREFIX}/sources`;
export const CONVERSATIONS_ENDPOINT = `${AI_PREFIX}/conversations`;

/**
 * 한 턴에 함께 보내는 화면 상태.
 *
 * transport 에 미리 심어 두지 않고 `sendMessage(msg, { body })` 로 턴마다 넘긴다 — transport 는
 * 마운트 때 한 번 만들어 두어야 하는데(렌더마다 새로 만들면 전송 도중 교체돼 스트림이 끊긴다),
 * 그러면 첫 렌더의 대화 id 가 갇혀 두 번째 턴부터 엉뚱한 대화로 나간다.
 */
export interface TurnContext {
  /** 서버 대화 id. 화면은 대화를 먼저 만들고(`createConversation`) 그 id 로 턴을 보낸다 */
  conversationId: string;
  /** 선택된 소스 문서 이름 */
  sources: string[];
  /** 이 턴에 적용할 스킬 id (`SKILL_LIB`) */
  skills: string[];
  /**
   * 이 턴에 쓸 외부 앱 slug (`CONNECTOR_LIB`). 입력창에서 켠 칩이다. 서버는 이 목록에 있는 앱의 도구만
   * 모델에 보인다 — 연결돼 있는지는 서버가 도구를 실행할 때 다시 본다.
   */
  apps?: string[];
  /**
   * 편집·다시 시도 — 이 순번 이상을 서버가 지우고 새 질문으로 다시 답한다.
   * 화면이 잘라내는 것과 서버 저장본이 같이 움직이게 하려는 것이다.
   */
  replaceFromSeq?: number;
  /**
   * 질문이 아닌 턴.
   *
   * - `approve-proposal`: 제안 카드 승인. 제안 내용은 넘기지 않는다 — 서버가 자기 저장본에서 읽어야
   *   화면에 뜬 적 없는 값을 승인시키는 길이 없다(지금은 업무 모듈 연결 전이라 안내만 돌아온다).
   * - `tool-approval`: 도구 실행 승인·거절. `approvalId` 는 서버가 발급한 값이고, 서버는 자기 감사
   *   기록의 입력으로 실행한다 — 클라이언트가 입력을 바꿔 보낼 수 없다.
   */
  action?:
    | { type: "approve-proposal"; proposal: OcrProposal }
    | { type: "tool-approval"; approvalId: string; approved: boolean };
}

export function createChatTransport() {
  return new DefaultChatTransport<AxpUIMessage>({
    api: CHAT_ENDPOINT,
    // refresh 토큰이 HttpOnly 쿠키로 오간다. 빼면 401 뒤 재발급이 안 된다.
    credentials: "include",
    headers: async (): Promise<Record<string, string>> => {
      const token = await ensureAccessToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    },

    /**
     * **마지막 사용자 메시지만 보낸다.**
     *
     * 기본 동작은 messages 배열 전체를 보내는 것인데, 그러면 클라이언트가 이전 턴의 assistant
     * 응답과 도구 결과를 위조해서 보낼 수 있다. 온톨로지 조회 결과를 가짜로 끼워 넣어 모델을
     * 유도하는 경로가 열린다 — 히스토리는 서버가 자기 저장본에서 읽어야 한다.
     *
     * 테넌트 격리 자체는 이걸로 안 뚫린다(도구가 세션에서 스키마를 다시 꺼내므로). 뚫리는 것은
     * "모델이 거짓 사실을 근거로 답한다" 쪽이다.
     *
     * 그래서 BE 연동 시 대화 영속화가 선택이 아니라 선행 조건이다. 지금은 BE 가 없어
     * 히스토리가 localStorage 에만 있고, 서버(대본 라우트)는 히스토리를 안 쓴다.
     */
    prepareSendMessagesRequest: ({ messages, body, id }) => ({
      // body 는 sendMessage 가 넘긴 TurnContext 다
      body: {
        ...body,
        chatId: id,
        message: messages[messages.length - 1],
      },
    }),
  });
}
