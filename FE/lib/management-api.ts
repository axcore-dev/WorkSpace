import { apiDelete, apiGet, apiPostAuthed } from "@/lib/api";
import type { MonthlyPl, Org, PayrollRun, Voucher } from "@/data/pages/management";

/**
 * 경영지원(인사 · 급여 · 회계) API. 회사를 고른 토큰이어야 하고, 탭 권한이 없거나 회사가 탭을 끄면 403 이 온다.
 * 상태 전이가 어긋나면 409(`PAYROLL_STATE` · `VOUCHER_STATE`) — 화면은 message 를 그대로 띄운다.
 */
const BASE = "/api/workspace/management";
const must = <T,>(v: T | null) => v as T;
const seg = encodeURIComponent;

export interface AccountingDto {
  vouchers: Voucher[];
  monthly: MonthlyPl[];
}

export const getOrg = async () => must(await apiGet<Org>(`${BASE}/org`));

export const getPayroll = async () => (await apiGet<PayrollRun[]>(`${BASE}/payroll`)) ?? [];
export const createPayrollRun = async (name: string, payDate: string) =>
  must(await apiPostAuthed<PayrollRun>(`${BASE}/payroll`, { name, payDate }));
export const deletePayrollRun = (id: string) => apiDelete<void>(`${BASE}/payroll/${seg(id)}`);
export const createPayrollVoucher = (id: string) => apiPostAuthed<PayrollRun>(`${BASE}/payroll/${seg(id)}/voucher`);
export const markPayrollPaid = (id: string) => apiPostAuthed<PayrollRun>(`${BASE}/payroll/${seg(id)}/paid`);
export const recalcPayroll = (id: string) => apiPostAuthed<PayrollRun>(`${BASE}/payroll/${seg(id)}/recalc`);

export const getAccounting = async () => must(await apiGet<AccountingDto>(`${BASE}/accounting`));
export const approveVoucher = (no: string) => apiPostAuthed<Voucher>(`${BASE}/accounting/vouchers/${seg(no)}/approve`);
export const rejectVoucher = (no: string, reason?: string) =>
  apiPostAuthed<Voucher>(`${BASE}/accounting/vouchers/${seg(no)}/reject`, { reason: reason ?? null });
