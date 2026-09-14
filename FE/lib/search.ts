/**
 * 목록 검색 — 재고·물류 다섯 표(발주 · 이력 · 재고 · 품목 · 거래처)가 같은 규칙으로 걸러진다.
 *
 * 탭마다 `s.toLowerCase().includes(q)` 를 따로 쓰던 때의 문제: 「GUIDE POST」처럼 두 단어를 한 문자열로 비교해 0건,
 * 「PO 2607」은 하이픈이 달라 0건, 발주 표는 품명을 보지 않았다. 규칙은 하나다 —
 *
 * - 검색어는 공백으로 나눈 **토큰 AND**: 「볼트 M8」 = 「볼트」도 있고 「M8」도 있는 행
 * - 토큰과 필드는 **정규화**해 비교: 소문자, 공백 · 하이픈 · 밑줄 · 점 · 가운뎃점 제거 → 「PO 2607」 ≈ 「po-2607-0021」, 「guidepost」 ≈ 「GUIDE POST」
 * - 토큰 하나는 어느 한 필드에만 맞아도 된다(품명에 「볼트」, 규격에 「M8」)
 *
 * 이 파일은 import 를 갖지 않는다 — `node --test` 가 타입 스트립으로 그대로 실행한다.
 */

/** 비교용 정규화 — 대소문자 · 띄어쓰기 · 구분 기호 차이를 지운다 */
export function normalizeForSearch(s: string): string {
  return s.toLowerCase().replace(/[\s\-_.·]/g, "");
}

/** 검색어를 토큰으로 — 빈 토큰은 버린다. 검색어가 비면 `[]`(= 전부 통과) */
export function searchTokens(query: string): string[] {
  return query
    .split(/\s+/)
    .map(normalizeForSearch)
    .filter((t) => t !== "");
}

/**
 * 행이 검색어에 맞는가. `fields` 는 그 행에서 검색 대상이 되는 문자열들(빈 값 · null 은 무시).
 *
 * ```ts
 * matchesQuery("guide post", ["GUIDE POST 외 2", "POWERTEC"]) // true
 * matchesQuery("PO 2607", ["PO-2607-0021"])                   // true
 * matchesQuery("볼트 M8", ["볼트", "M8"])                      // true — 토큰마다 다른 필드
 * matchesQuery("볼트 M10", ["볼트", "M8"])                     // false
 * ```
 */
export function matchesQuery(query: string, fields: (string | null | undefined)[]): boolean {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return true;
  const hay = fields.filter((f): f is string => typeof f === "string" && f !== "").map(normalizeForSearch);
  return tokens.every((t) => hay.some((h) => h.includes(t)));
}
