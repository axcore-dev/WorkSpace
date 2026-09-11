/**
 * AI 서버가 쓰는 순수 문자열 처리. <b>`server-only` 를 붙이지 않는다</b> — 비밀도 부수효과도 없고,
 * `node --test` 가 그대로 불러 검증할 수 있어야 하기 때문이다(서버 모듈은 불러올 수 없다).
 */

/**
 * 임베딩에 넣을 문자열 — 조각 본문 앞에 어디서 온 조각인지를 붙인다.
 *
 * 조각만 떼어 놓으면 무엇에 대한 이야기인지 사라진다. "온도는 180±5℃ 로 유지한다" 는 조각은 어느 공정의 온도인지
 * 없이는 어떤 질문에도 닿지 않는다. 문서 이름과 쪽을 붙여 두면 그만큼이 벡터에 실린다.
 *
 * 저장하는 `content` 는 머리말 없이 그대로다 — 화면 인용과 답변 근거는 본문이어야 한다.
 *
 * 절 제목까지 붙이면 더 좋지만 지금 추출기는 문서 구조를 주지 않는다(쪽 번호와 시트 순번까지다).
 */
export function embedInput(docName: string, chunk: { page?: number; content: string }): string {
  const where = chunk.page ? `${docName} · ${chunk.page}쪽` : docName;
  return `${where}\n${chunk.content}`;
}

/**
 * 재랭킹 응답 파싱 — "3, 1, 7" → [3, 1, 7].
 *
 * 모델이 번호만 뱉으라 해도 "3, 1, 7 번이 관련 있습니다" 처럼 말을 붙이거나, 없는 번호를 만들거나, 같은 번호를 두 번
 * 적기도 한다. 범위 밖과 중복은 버리고 순서는 그대로 둔다 — 그 순서가 곧 관련도다.
 */
export function parseRanking(text: string, max: number): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const m of text.matchAll(/\d+/g)) {
    const n = Number(m[0]);
    if (n >= 1 && n <= max && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}
