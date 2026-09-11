/**
 * 표 셀의 위계 세 단 (DESIGN.md 「위계 — 무엇을 덜 보이게 할지」).
 *
 * 색·굵기는 열 위치가 아니라 의미가 정한다 — 강조는 지금 행동할 값, 내림은 끝난 것·0·정상.
 * 순수 함수라 `node --test`로 검증한다 (`lib/emphasis.test.ts`).
 */
export type Emphasis = "em" | "base" | "down";

export const EMPHASIS_CLASS: Record<Emphasis, string> = {
  em: "text-slate-900 font-semibold",
  base: "text-slate-600",
  // slate-500 이 데이터 텍스트의 하한(4.76:1)이다 — 더 옅게 내리지 않는다
  down: "text-slate-500",
};

/** 셀 하나의 단 — 행이 내림이면 열 지정을 덮는다(끝난 행은 셀 전부 회색). 미지정 열은 기본. */
export function cellEmphasis(col: Emphasis | undefined, rowDown: boolean): Emphasis {
  if (rowDown) return "down";
  return col ?? "base";
}
