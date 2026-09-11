/**
 * 표 셀의 위계 (DESIGN.md 「위계 — 무엇을 덜 보이게 할지」).
 *
 * 색·굵기는 열 위치가 아니라 의미가 정한다 — 강조는 지금 행동할 값, 내림은 끝난 것·0·정상.
 * 순수 함수라 `node --test`로 검증한다 (`lib/emphasis.test.ts`).
 */
export type Emphasis = "em" | "base" | "down" | "faint";
/** 행 단위 — `down` 끝난 행(정상 · 완료), `faint` 지나간 행(입고 완료처럼 더 볼 일이 없는 것) */
export type RowEmphasis = "down" | "faint";

export const EMPHASIS_CLASS: Record<Emphasis, string> = {
  em: "text-slate-900 font-semibold",
  base: "text-slate-600",
  // slate-500 이 데이터 텍스트의 하한(4.76:1)이다 — 셀 단위로는 더 옅게 내리지 않는다
  down: "text-slate-500",
  // 예외 — 지나간 행(입고 완료)만. 읽어야 하는 정보가 아니라 지워지지 않았다는 표시라 하한 밖(slate-400)을 허용한다 (2026-09-11)
  faint: "text-slate-400",
};

/** 셀 하나의 단 — 행 지정이 열 지정을 덮는다(끝난 행은 셀 전부 같은 회색). 미지정 열은 기본. */
export function cellEmphasis(col: Emphasis | undefined, row?: RowEmphasis | false): Emphasis {
  if (row) return row;
  return col ?? "base";
}
