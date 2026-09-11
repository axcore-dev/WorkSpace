/**
 * 검색어 재작성 — 이어지는 질문을 그것만 읽어도 뜻이 통하는 문장으로 바꾼다.
 *
 * "그럼 그건 얼마야?" 를 그대로 임베딩하면 아무 데도 닿지 않는다. 대화 기록은 모델에게는 전달되지만 검색에는 쓰이지
 * 않아서, 후속 질문일수록 근거를 못 찾는다. 앞선 두 턴을 함께 보고 독립적으로 읽히는 검색 문장을 만든 뒤 그것으로
 * 찾는다.
 *
 * 첫 질문(기록 없음)에는 부르지 않는다 — 바꿀 것이 없고 호출 한 번이 그대로 지연이다. 실패하거나 모델이 없으면 원래
 * 질문을 그대로 쓴다. <b>검색어를 못 만드는 것이 답을 못 하는 이유가 되면 안 된다.</b>
 */
import "server-only";
import { generateText } from "ai";
import { chatModel, providerOptions } from "./models";

/** 참고할 직전 메시지 수(2턴) */
const TURNS = 4;
/** 메시지 하나에서 볼 길이 — 앞부분이면 무엇을 얘기 중인지 알기에 충분하다 */
const PER_MESSAGE = 400;
/** 만들어진 검색어 상한 */
const MAX_QUERY = 300;

export async function searchQuery(
  history: { role: "user" | "assistant"; content: string }[],
  question: string,
): Promise<string> {
  const recent = history.slice(-TURNS);
  if (recent.length === 0 || !question.trim()) return question;

  const model = chatModel();
  if (!model) return question;

  const transcript = recent
    .map((m) => `${m.role === "user" ? "사용자" : "도우미"}: ${m.content.slice(0, PER_MESSAGE)}`)
    .join("\n");

  try {
    const { text } = await generateText({
      model,
      instructions:
        "이어지는 대화의 마지막 질문을 문서 검색어로 바꿉니다. 앞선 대화에서 가리키는 말(그것 · 거기 · 그 제품)을 실제 이름으로 풀어, " +
        "그 문장만 읽어도 무엇을 찾는지 알 수 있게 만듭니다. 한국어 한 문장으로, 설명이나 따옴표 없이 문장만 출력합니다. " +
        "이미 그 자체로 충분한 질문이면 그대로 출력합니다.",
      prompt: `이전 대화:\n${transcript}\n\n마지막 질문: ${question}\n\n검색어:`,
      maxOutputTokens: 120,
      providerOptions: providerOptions("low"),
    });
    const out = text.trim().replace(/^["'「『]|["'」』]$/g, "").slice(0, MAX_QUERY).trim();
    return out || question;
  } catch (e) {
    console.warn("[ai-query] 검색어 재작성 실패, 원 질문으로 찾는다", e);
    return question;
  }
}
