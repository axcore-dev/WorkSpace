/**
 * `lib/management-state.ts` 순수 파생 함수 검증. 데이터는 서버에서 오므로 여기선 작은 고정값만 쓴다.
 * 실행: cd FE && npm test   (node --test, 타입 스트립 — `@/` 별칭 import 금지)
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { MonthlyPl, PayrollRun, Voucher } from "./pages/management.ts";
import {
  HR_COMPANY_ID,
  SUMMARY_ID,
  ddayLabel,
  defaultSelection,
  formatWon,
  monthlyChart,
  nextVoucherNo,
  pendingCounts,
  plSummary,
  todayIso,
  voucherFromRun,
  weekdayKo,
} from "../lib/management-state.ts";

const run = (id: string, status: PayrollRun["status"]): PayrollRun => ({
  id,
  name: `${id.slice(0, 4)}년 ${Number(id.slice(5, 7))}월 정기급여`,
  headcount: 6,
  payDate: `${id}-25`,
  gross: 19_800_000,
  deduction: 2_730_000,
  net: 17_070_000,
  items: [],
  status,
});
const voucher = (no: string, status: Voucher["status"], runId?: string): Voucher => ({
  no,
  date: "2026-09-01",
  kind: runId ? "급여" : "매입",
  counterparty: "-",
  summary: "-",
  amount: 1,
  account: "-",
  owner: "-",
  status,
  lines: [],
  runId,
});

test("전표 번호 — 그 달 최대 + 1, 달이 바뀌면 001", () => {
  const vs = [voucher("V-2609-001", "승인"), voucher("V-2609-003", "승인"), voucher("V-2608-089", "승인")];
  assert.equal(nextVoucherNo(vs, "2026-09-10"), "V-2609-004");
  assert.equal(nextVoucherNo(vs, "2026-10-01"), "V-2610-001");
  assert.equal(nextVoucherNo([], "2026-08-01"), "V-2608-001");
});

test("급여 전표 미리보기 — 차변 합 = 대변 합 = 총액", () => {
  const v = voucherFromRun(run("2026-09", "처리 대기"), [], "2026-09-10", "김한결");
  assert.equal(v.kind, "급여");
  assert.equal(v.status, "검토중");
  assert.equal(v.runId, "2026-09");
  const debit = v.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const credit = v.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  assert.equal(debit, 19_800_000);
  assert.equal(credit, 19_800_000);
});

test("대기 건수와 기본 선택", () => {
  const state = {
    runs: [run("2026-09", "처리 대기"), run("2026-08", "지급 완료")],
    vouchers: [voucher("V-2609-001", "검토중"), voucher("V-2608-001", "승인", "2026-08")],
  };
  assert.deepEqual(pendingCounts(state), { payroll: 1, accounting: 1 });
  assert.deepEqual(defaultSelection(state), { payroll: "2026-09", accounting: "V-2609-001", hr: HR_COMPANY_ID });
  // 검토중이 없으면 회계는 요약, 처리할 회차가 없으면 첫 회차
  const done = { runs: [run("2026-08", "지급 완료")], vouchers: [voucher("V-2608-001", "승인")] };
  assert.deepEqual(defaultSelection(done), { payroll: "2026-08", accounting: SUMMARY_ID, hr: HR_COMPANY_ID });
  assert.deepEqual(defaultSelection({ runs: [], vouchers: [] }), { payroll: "", accounting: SUMMARY_ID, hr: HR_COMPANY_ID });
});

test("월별 손익 — 억 단위 요약과 차트", () => {
  const monthly: MonthlyPl[] = [
    { month: "2026-07-01", sales: 206_000_000, cost: 181_000_000 },
    { month: "2026-08-01", sales: 224_000_000, cost: 206_000_000 },
  ];
  assert.deepEqual(plSummary(monthly), { label: "2026년 8월", sales: 2.2, cost: 2.1, profit: 0.2, prevProfit: 0.3 });
  assert.equal(plSummary([]), null);
  const chart = monthlyChart(monthly);
  assert.deepEqual(chart.labels, ["7월", "8월"]);
  assert.deepEqual(chart.series?.map((s) => s.values), [[2.1, 2.2], [1.8, 2.1]]);
});

test("표기 — D-day · 요일 · 원 · 오늘", () => {
  assert.equal(ddayLabel("2026-07-24", "2026-07-06"), "D-18");
  assert.equal(ddayLabel("2026-07-06", "2026-07-06"), "오늘");
  assert.equal(ddayLabel("2026-07-01", "2026-07-06"), "5일 지남");
  assert.equal(weekdayKo("2026-07-24"), "금");
  assert.equal(formatWon(421_800_000), "421,800,000원");
  assert.equal(formatWon(-31_900_000), "−31,900,000원");
  assert.equal(todayIso(new Date(2026, 8, 10, 23, 30)), "2026-09-10");
});
