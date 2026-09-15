/**
 * 숫자 표기 (DESIGN.md 「숫자 표기」).
 *
 * 쉼표는 세는 값(수량 · 재고 · 안전 재고 · 부족 · 증감)에만 붙인다. 코드 · 관리번호 · 규격 글자 · 날짜 · 입력 칸 · CSV 에는 쓰지 않는다 —
 * CSV 에 쉼표가 들어가면 엑셀이 숫자를 글자로 읽는다.
 */
export const formatQty = (n: number) => n.toLocaleString("ko-KR");

/** 증감 — `+1,200` · `-2` · `0`. 표의 숫자라 ASCII `-` 그대로(복사해 엑셀에 붙여도 숫자로 읽힌다) */
export const formatDelta = (n: number) => (n > 0 ? `+${formatQty(n)}` : formatQty(n));

/** 이력 일시 — 오늘은 `14:20`, 이전은 `06.30 14:20`. 날짜 형식은 앱 전체 `MM.DD` (입력 `2026-06-30T14:20`) */
export const formatStamp = (at: string, today: string) => (at.slice(0, 10) === today ? at.slice(11, 16) : `${at.slice(5, 10).replace("-", ".")} ${at.slice(11, 16)}`);
