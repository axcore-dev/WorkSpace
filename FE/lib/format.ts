/**
 * 숫자 표기 (DESIGN.md 「숫자 표기」).
 *
 * 쉼표는 세는 값(수량 · 재고 · 안전 재고 · 부족 · 증감)에만 붙인다. 코드 · 관리번호 · 규격 글자 · 날짜 · 입력 칸 · CSV 에는 쓰지 않는다 —
 * CSV 에 쉼표가 들어가면 엑셀이 숫자를 글자로 읽는다.
 */
export const formatQty = (n: number) => n.toLocaleString("ko-KR");

/** 증감 — `+1,200` · `-2` · `0`. 표의 숫자라 ASCII `-` 그대로(복사해 엑셀에 붙여도 숫자로 읽힌다) */
export const formatDelta = (n: number) => (n > 0 ? `+${formatQty(n)}` : formatQty(n));
