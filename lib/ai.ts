/**
 * OpenAI 연동 스캐폴딩 (서버 전용 — 클라이언트에서 import 금지)
 *
 * 사용 준비:
 *  1. `.env.example`을 `.env.local`로 복사하고 OPENAI_API_KEY를 채운다.
 *  2. AI대화의 더미 응답(pushAi)을 `/api/chat` 호출로 교체한다.
 *
 * SDK 없이 fetch 기반이라 추가 설치 없이 동작한다.
 * (스트리밍이 필요해지면 `npm i openai` 후 이 파일만 교체하면 된다.)
 */

export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
/** 사용 모델 — 환경변수 대신 코드에서 고정 (v4: OPENAI_MODEL env 제거) */
const OPENAI_MODEL = "gpt-4.1-mini";

/** 키가 세팅됐는지 — 미설정이면 데모 더미 응답으로 폴백한다 */
export function isAiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "YOUR_OPENAI_API_KEY";
}

/** OpenAI Chat Completions 호출 (non-streaming) — opts.json이면 JSON 응답을 강제한다 */
export async function chatCompletion(messages: AiChatMessage[], opts?: { json?: boolean }): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!isAiConfigured() || !apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다. .env.local을 확인하세요.");
  }
  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      ...(opts?.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI API 오류: ${res.status}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}
