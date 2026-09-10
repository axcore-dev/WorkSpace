import type { ModulePageData } from "../types";

/**
 * 경영지원 화면의 타입과 구성. 데이터는 `GET /api/workspace/management/org · /payroll · /accounting`
 * (`lib/management-api.ts`)에서 오고, 상태 변경은 `components/management/management-provider.tsx`가 POST 한다.
 * 시연 데이터는 `INFRA/seed/seed-demo-management.sh`가 데모 회사 DB에 넣는다 — 이 파일에 값은 없다.
 *
 * 상태 문자열(처리 대기 …)은 BE 열거형(`PayrollStatus` · `VoucherStatus` · `VoucherKind`)의 표기와 같아야 한다.
 *
 * `@/` 별칭을 쓰지 않는 이유: `data/management.test.ts`가 node --test로 이 파일을 import한다.
 */

/* ── 인사 — 조직도. 부서가 팀이고 본부는 "본사" 한 층이다 ── */

export interface Team {
  name: string;
  /** 소유자 → 관리자 → 이름순 첫 사람. 없으면 "—" */
  head: string;
  size: number;
}
export interface Division {
  name: string;
  teams: Team[];
}
export interface OrgMember {
  name: string;
  /** 직급 이름 */
  rank: string;
  email: string;
  /** 이 회사에 합류한 날 YYYY-MM-DD */
  joined: string;
}
export interface Org {
  company: string;
  divisions: Division[];
  /** 팀 이름 → 구성원 */
  members: Record<string, OrgMember[]>;
}

/* ── 급여 ── */

export type PayrollStatus = "처리 대기" | "전표 생성" | "전표 반려" | "지급 완료";

export interface PayrollItem {
  label: string;
  /** 공제는 음수 */
  amount: number;
  note: string;
}

export interface PayrollRun {
  id: string;
  name: string;
  headcount: number;
  /** 지급 예정일 YYYY-MM-DD */
  payDate: string;
  gross: number;
  deduction: number;
  net: number;
  /** 양수 합 = gross, 음수 합 = −deduction */
  items: PayrollItem[];
  status: PayrollStatus;
  voucherNo?: string | null;
  paidAt?: string | null;
}

/* ── 회계 ── */

export type VoucherStatus = "검토중" | "승인" | "반려";

export interface VoucherLine {
  account: string;
  debit?: number | null;
  credit?: number | null;
  memo: string;
}

export interface Voucher {
  no: string;
  date: string;
  kind: "매입" | "매출" | "급여";
  counterparty: string;
  summary: string;
  amount: number;
  vat?: number | null;
  account: string;
  owner: string;
  status: VoucherStatus;
  /** 차변 합 = 대변 합 */
  lines: VoucherLine[];
  purchase?: { item: string; code: string; qty: number; unit: string; unitPrice: number } | null;
  /** 급여 전표면 원 회차 */
  runId?: string | null;
  rejectReason?: string | null;
}

/** 월별 손익 — month 는 그 달 1일(YYYY-MM-DD), 금액은 원 */
export interface MonthlyPl {
  month: string;
  sales: number;
  cost: number;
}

/** 화면 구성 — 세 탭 전부 전용 작업대. KPI 행 없음, 기본 탭은 마감이 가까운 급여 */
export const PAGE: ModulePageData = {
  stats: [],
  defaultTabId: "payroll",
  tabs: [
    { id: "hr", label: "인사 관리", custom: "hr-workbench" },
    { id: "payroll", label: "급여 관리", custom: "payroll-workbench" },
    { id: "accounting", label: "회계 관리", custom: "accounting-workbench" },
  ],
};
