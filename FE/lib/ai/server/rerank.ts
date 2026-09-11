/**
 * 재랭킹 — 후보 조각을 모델이 한 번 훑어 질문에 실제로 답하는 것만 남긴다.
 *
 * 벡터·전문 검색·부분 일치는 "주제가 비슷한 것" 을 잘 찾는다. 그런데 상위 후보 중 정말 근거가 되는 것은 보통 두세
 * 개다. 나머지는 같은 문서의 다른 대목이거나 같은 낱말이 나오는 다른 얘기다. 그 구분은 질문과 조각을 함께 읽어야
 * 되는 일이라 검색 점수로는 안 된다.
 *
 * 전용 리랭커 모델을 붙이면 더 정확하지만 업체가 하나 늘어난다. 지금은 쓰고 있는 대화 모델에게 점수만 매기게 한다 —
 * 호출 한 번, 출력은 숫자 목록뿐이다.
 *
 * <b>실패하면 원래 순서를 그대로 돌려준다.</b> 재랭킹은 순서를 다듬는 것이지 검색의 전제가 아니다.
 */
import "server-only";
import { generateText } from "ai";
import { parseRanking } from "@/lib/ai/text";
import { chatModel, providerOptions } from "./models";
import type { ChunkHit } from "./sources";

/** 조각 하나를 모델에게 보일 때의 길이 — 앞부분이면 관련 여부를 가리기에 충분하다 */
const PREVIEW = 400;
/** 이 수보다 후보가 적으면 부르지 않는다. 어차피 다 넣을 것이라 점수가 필요 없다 */
const MIN_CANDIDATES = 3;

/**
 * @param hits 검색이 합쳐 준 후보(상위부터)
 * @param keep 남길 개수
 * @returns 관련도 높은 순서로 정렬해 `keep` 개. 모델이 없거나 실패하면 `hits` 의 앞에서 `keep` 개
 */
export async function rerank(question: string, hits: ChunkHit[], keep: number): Promise<ChunkHit[]> {
  if (hits.length <= Math.max(keep, MIN_CANDIDATES)) return hits.slice(0, keep);

  const model = chatModel();
  if (!model) return hits.slice(0, keep);

  const list = hits
    .map((h, i) => `[${i + 1}] ${h.doc_name}${h.page ? ` ${h.page}쪽` : ""}\n${h.content.slice(0, PREVIEW)}`)
    .join("\n\n");

  try {
    const { text } = await generateText({
      model,
      instructions:
        "질문에 답하는 데 실제로 쓸 수 있는 조각을 고릅니다. 주제가 비슷하기만 한 조각은 제외합니다. " +
        "고른 조각의 번호만 관련도가 높은 순서로, 쉼표로 이어 출력합니다. 설명을 붙이지 않습니다. " +
        "쓸 만한 조각이 하나도 없으면 아무것도 출력하지 않습니다.",
      prompt: `질문: ${question}\n\n조각 목록:\n${list}\n\n번호:`,
      maxOutputTokens: 100,
      providerOptions: providerOptions("low"),
    });
    const picked = parseRanking(text, hits.length);
    // 모델이 아무것도 못 고르면 검색 순서를 믿는다 — 근거 없음 판정은 유사도 문턱이 따로 한다
    if (picked.length === 0) return hits.slice(0, keep);
    return picked.slice(0, keep).map((n) => hits[n - 1]);
  } catch (e) {
    console.warn("[ai-rerank] 재랭킹 실패, 검색 순서를 그대로 쓴다", e);
    return hits.slice(0, keep);
  }
}
