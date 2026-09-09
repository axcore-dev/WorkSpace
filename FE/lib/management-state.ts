import type { Member, Tone } from "../data/types";
import type { PayrollRun, PayrollStatus, Voucher, VoucherStatus } from "../data/pages/management";

/**
 * 경영지원 작업대 공유 상태 — 순수 리듀서.
 * React 없이 두는 이유: `data/management.test.ts`가 node --test로 검증한다.
 * 부제·목록 배지·헤더 상태·배너·탭 간 연계가 전부 이 한 벌에서 파생된다(상태 두 벌 금지).
 */

export type WorkbenchTab = "hr" | "payroll" | "accounting";

export interface ManagementState {
  runs: PayrollRun[];
  vouchers: Voucher[];
  members: Record<string, Member[]>;
  /** 작업대별 좌측 선택 — 없으면 defaultSelection */
  selection: Partial<Record<WorkbenchTab, string>>;
}

export type ManagementAction =
  | { type: "createVoucher"; runId: string; date: string; author: string }
  | { type: "markPaid"; runId: string; date: string }
  | { type: "recalc"; runId: string }
  | { type: "deleteRun"; runId: string }
  | { type: "createRun"; name: string; payDate: string }
  | { type: "approve"; no: string }
  | { type: "reject"; no: string; reason?: string }
  | { type: "addMember"; team: string; member: Member }
  | { type: "select"; tab: WorkbenchTab; id: string };

/** 회계 마스터의 요약 항목 id */
export const SUMMARY_ID = "summary";
/** 인사 기본 선택 팀 (역할→팀 매핑은 후속) */
export const HR_DEFAULT_TEAM = "인사총무팀";

export function nextVoucherNo(vouchers: Voucher[], date: string): string {
  const prefix = `V-${date.slice(2, 4)}${date.slice(5, 7)}-`;
  const max = vouchers
    .filter((v) => v.no.startsWith(prefix))
    .reduce((m, v) => Math.max(m, Number(v.no.slice(prefix.length))), 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export function voucherFromRun(run: PayrollRun, vouchers: Voucher[], date: string, author: string): Voucher {
  return {
    no: nextVoucherNo(vouchers, date),
    date,
    kind: "급여",
    counterparty: "임직원",
    summary: `${run.name} (${run.headcount}명)`,
    amount: run.gross,
    account: "급여",
    owner: author,
    status: "검토중",
    runId: run.id,
    lines: [
      { account: "급여", debit: run.gross, memo: `${run.headcount}명` },
      { account: "예수금", credit: run.deduction, memo: "4대보험 · 소득세" },
      { account: "보통예금", credit: run.net, memo: "실지급" },
    ],
  };
}

export function pendingCounts(state: ManagementState): { payroll: number; accounting: number } {
  return {
    payroll: state.runs.filter((r) => r.status !== "지급 완료").length,
    accounting: state.vouchers.filter((v) => v.status === "검토중").length,
  };
}

export function defaultSelection(state: ManagementState): Record<WorkbenchTab, string> {
  const run = state.runs.find((r) => r.status !== "지급 완료") ?? state.runs[0];
  const voucher = state.vouchers.find((v) => v.status === "검토중");
  return { payroll: run?.id ?? "", accounting: voucher?.no ?? SUMMARY_ID, hr: HR_DEFAULT_TEAM };
}

const patchRun = (runs: PayrollRun[], id: string, patch: (r: PayrollRun) => PayrollRun) =>
  runs.map((r) => (r.id === id ? patch(r) : r));
const patchVoucher = (vouchers: Voucher[], no: string, patch: (v: Voucher) => Voucher) =>
  vouchers.map((v) => (v.no === no ? patch(v) : v));

export function reduce(state: ManagementState, action: ManagementAction): ManagementState {
  switch (action.type) {
    case "createVoucher": {
      const run = state.runs.find((r) => r.id === action.runId);
      if (!run || run.status !== "처리 대기") return state;
      const voucher = voucherFromRun(run, state.vouchers, action.date, action.author);
      return {
        ...state,
        runs: patchRun(state.runs, run.id, (r) => ({ ...r, status: "전표 생성", voucherNo: voucher.no })),
        vouchers: [voucher, ...state.vouchers],
      };
    }
    case "markPaid":
      return {
        ...state,
        runs: patchRun(state.runs, action.runId, (r) =>
          r.status === "전표 생성" ? { ...r, status: "지급 완료", paidAt: action.date } : r,
        ),
      };
    case "recalc":
      return {
        ...state,
        runs: patchRun(state.runs, action.runId, (r) =>
          r.status === "전표 반려" ? { ...r, status: "처리 대기", voucherNo: undefined } : r,
        ),
      };
    case "deleteRun": {
      const run = state.runs.find((r) => r.id === action.runId);
      if (!run || run.status !== "처리 대기") return state;
      const { payroll, ...rest } = state.selection;
      return {
        ...state,
        runs: state.runs.filter((r) => r.id !== action.runId),
        selection: payroll === action.runId ? rest : state.selection,
      };
    }
    case "createRun": {
      const template = state.runs.find((r) => r.name.includes("정기급여")) ?? state.runs[0];
      if (!template) return state;
      const base = action.payDate.slice(0, 7);
      let id = base;
      for (let n = 2; state.runs.some((r) => r.id === id); n++) id = `${base}-${n}`;
      const run: PayrollRun = {
        ...template,
        id,
        name: action.name,
        payDate: action.payDate,
        status: "처리 대기",
        voucherNo: undefined,
        paidAt: undefined,
      };
      return { ...state, runs: [run, ...state.runs], selection: { ...state.selection, payroll: id } };
    }
    case "approve":
      return {
        ...state,
        vouchers: patchVoucher(state.vouchers, action.no, (v) => (v.status === "검토중" ? { ...v, status: "승인" } : v)),
      };
    case "reject": {
      const voucher = state.vouchers.find((v) => v.no === action.no);
      if (!voucher || voucher.status !== "검토중") return state;
      return {
        ...state,
        vouchers: patchVoucher(state.vouchers, action.no, (v) => ({ ...v, status: "반려", rejectReason: action.reason?.trim() || undefined })),
        runs: voucher.runId ? patchRun(state.runs, voucher.runId, (r) => ({ ...r, status: "전표 반려" })) : state.runs,
      };
    }
    case "addMember":
      return {
        ...state,
        members: { ...state.members, [action.team]: [...(state.members[action.team] ?? []), action.member] },
      };
    case "select":
      return { ...state, selection: { ...state.selection, [action.tab]: action.id } };
  }
}

/* ── 표기 헬퍼 ── */

/** 421,800,000원 · 음수는 U+2212 */
export function formatWon(n: number): string {
  const s = Math.abs(n).toLocaleString("ko-KR");
  return `${n < 0 ? "−" : ""}${s}원`;
}

/** 4.2억원 — 요약 행에서만 */
export function formatEok(n: number): string {
  const eok = n / 100_000_000;
  const sign = eok > 0 ? "+" : eok < 0 ? "−" : "";
  return `${sign}${Math.abs(eok).toFixed(1)}억원`;
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
