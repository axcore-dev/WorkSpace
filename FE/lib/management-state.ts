import type { ChartSpec, Tone } from "../data/types";
import type { MonthlyPl, Org, PayrollRun, PayrollStatus, Voucher, VoucherLine, VoucherStatus } from "../data/pages/management";
import { CHART } from "./palette.ts";

/**
 * 경영지원 작업대 공유 상태의 모양과 순수 파생 함수.
 * React 없이 두는 이유: `data/management.test.ts`가 node --test로 검증한다.
 * 상태 변경(전표 만들기 · 지급 완료 · 승인 …)은 서버가 한다 — 여기엔 리듀서가 없고, 서버 응답을 다시 받아 넣는다.
 */

export type WorkbenchTab = "hr" | "payroll" | "accounting";

export interface ManagementState {
  org: Org;
  runs: PayrollRun[];
  vouchers: Voucher[];
  monthly: MonthlyPl[];
  /** 작업대별 좌측 선택 — 없으면 defaultSelection */
  selection: Partial<Record<WorkbenchTab, string>>;
}

/** 서버에 보내는 동작. 성공하면 급여 · 회계를 다시 받는다. */
export type ManagementAction =
  | { type: "createVoucher"; runId: string }
  | { type: "markPaid"; runId: string }
  | { type: "recalc"; runId: string }
  | { type: "deleteRun"; runId: string }
  | { type: "createRun"; name: string; payDate: string }
  | { type: "approve"; no: string }
  | { type: "reject"; no: string; reason?: string };

/** 회계 마스터의 요약 항목 id */
export const SUMMARY_ID = "summary";
/** 인사 마스터의 회사(맨 위) 항목 id */
export const HR_COMPANY_ID = "company";

/** 오늘 YYYY-MM-DD — 브라우저 시간대 기준 */
export function todayIso(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** 위저드 미리보기 — 서버가 만드는 급여 전표와 같은 분개 3행 */
export function payrollLines(run: PayrollRun): VoucherLine[] {
  return [
    { account: "급여", debit: run.gross, memo: `${run.headcount}명` },
    { account: "예수금", credit: run.deduction, memo: "4대보험 · 소득세" },
    { account: "보통예금", credit: run.net, memo: "실지급" },
  ];
}

export function pendingCounts(state: Pick<ManagementState, "runs" | "vouchers">): { payroll: number; accounting: number } {
  return {
    payroll: state.runs.filter((r) => r.status !== "지급 완료").length,
    accounting: state.vouchers.filter((v) => v.status === "검토중").length,
  };
}

export function defaultSelection(state: Pick<ManagementState, "runs" | "vouchers">): Record<WorkbenchTab, string> {
  const run = state.runs.find((r) => r.status !== "지급 완료") ?? state.runs[0];
  const voucher = state.vouchers.find((v) => v.status === "검토중");
  return { payroll: run?.id ?? "", accounting: voucher?.no ?? SUMMARY_ID, hr: HR_COMPANY_ID };
}

/* ── 월별 손익 ── */

export interface PlSummary {
  /** "2026년 8월" */
  label: string;
  /** 억 단위, 소수 1자리 */
  sales: number;
  cost: number;
  profit: number;
  prevProfit: number;
}

const eok = (won: number) => Number((won / 100_000_000).toFixed(1));

/** 마지막 달의 손익 요약. 달이 없으면 null */
export function plSummary(monthly: MonthlyPl[]): PlSummary | null {
  if (monthly.length === 0) return null;
  const last = monthly[monthly.length - 1];
  const prev = monthly[monthly.length - 2];
  const profit = (m: MonthlyPl) => eok(m.sales - m.cost);
  return {
    label: `${last.month.slice(0, 4)}년 ${Number(last.month.slice(5, 7))}월`,
    sales: eok(last.sales),
    cost: eok(last.cost),
    profit: profit(last),
    prevProfit: prev ? profit(prev) : 0,
  };
}

/** 월별 손익 막대 차트 — 억 단위 */
export function monthlyChart(monthly: MonthlyPl[]): ChartSpec {
  return {
    type: "bar",
    title: "월별 손익 요약",
    valueUnit: "억",
    compact: true,
    labels: monthly.map((m) => `${Number(m.month.slice(5, 7))}월`),
    series: [
      { name: "매출", color: CHART.primary, values: monthly.map((m) => eok(m.sales)) },
      { name: "매입·비용", color: CHART.neutral, values: monthly.map((m) => eok(m.cost)) },
    ],
  };
}

/* ── 표기 헬퍼 ── */

/** 421,800,000원 · 음수는 U+2212 */
export function formatWon(n: number): string {
  const s = Math.abs(n).toLocaleString("ko-KR");
  return `${n < 0 ? "−" : ""}${s}원`;
}

/** 4.2억원 — 요약 행에서만 */
export function formatEok(n: number): string {
  const e = n / 100_000_000;
  const sign = e > 0 ? "+" : e < 0 ? "−" : "";
  return `${sign}${Math.abs(e).toFixed(1)}억원`;
}

/** to − from 일수 (YYYY-MM-DD, UTC 정오 기준으로 시간대 영향 제거) */
export function daysBetween(from: string, to: string): number {
  const at = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), 12);
  return Math.round((at(to) - at(from)) / 86_400_000);
}

/** D-18 · 오늘 · 5일 지남 */
export function ddayLabel(target: string, today: string): string {
  const d = daysBetween(today, target);
  if (d === 0) return "오늘";
  return d > 0 ? `D-${d}` : `${-d}일 지남`;
}

export function weekdayKo(iso: string): string {
  return ["일", "월", "화", "수", "목", "금", "토"][new Date(`${iso}T12:00:00Z`).getUTCDay()];
}

export function payrollTone(status: PayrollStatus): Tone {
  return status === "지급 완료" ? "green" : status === "전표 반려" ? "red" : status === "전표 생성" ? "slate" : "amber";
}

export function voucherTone(status: VoucherStatus): Tone {
  return status === "승인" ? "green" : status === "반려" ? "red" : "amber";
}
