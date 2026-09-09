/**
 * `data/pages/management.ts` 데이터 정합과 `lib/management-state.ts` 리듀서 검증.
 * 실행: cd FE && npm test   (node --test, 타입 스트립 — `@/` 별칭 import 금지)
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { DEMO_TODAY, HR_MEMBERS, ORG, PAYROLL_RUNS, VOUCHERS } from "./pages/management.ts";
import {
  HR_DEFAULT_TEAM,
  SUMMARY_ID,
  ddayLabel,
  defaultSelection,
  formatWon,
  nextVoucherNo,
  pendingCounts,
  reduce,
  voucherFromRun,
  weekdayKo,
  type ManagementState,
} from "../lib/management-state.ts";

const initial = (): ManagementState => ({ runs: PAYROLL_RUNS, vouchers: VOUCHERS, members: HR_MEMBERS, selection: {} });
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

test("급여 회차: 지급 항목 합 = 지급 총액 − 공제 = 실지급액", () => {
  for (const r of PAYROLL_RUNS) {
    const plus = sum(r.items.filter((i) => i.amount > 0).map((i) => i.amount));
    const minus = -sum(r.items.filter((i) => i.amount < 0).map((i) => i.amount));
    assert.equal(plus, r.gross, r.name);
    assert.equal(minus, r.deduction, r.name);
    assert.equal(r.gross - r.deduction, r.net, r.name);
  }
});

test("전표: 차변 합 = 대변 합", () => {
  for (const v of VOUCHERS) {
    const debit = sum(v.lines.map((l) => l.debit ?? 0));
    const credit = sum(v.lines.map((l) => l.credit ?? 0));
    assert.equal(debit, credit, v.no);
  }
});

test("조직도 인원 = 명단 수 = 128", () => {
  const teams = ORG.divisions.flatMap((d) => d.teams);
  assert.equal(sum(teams.map((t) => t.size)), 128);
  for (const t of teams) assert.equal(HR_MEMBERS[t.name]?.length, t.size, t.name);
});

test("전표 번호는 그 달의 최대 번호 + 1", () => {
  assert.equal(nextVoucherNo(VOUCHERS, DEMO_TODAY), "V-2607-004");
  assert.equal(nextVoucherNo([], "2026-08-03"), "V-2608-001");
});

test("급여 회차 → 전표: 분개 3행이 맞아떨어진다", () => {
  const run = PAYROLL_RUNS[0];
  const v = voucherFromRun(run, VOUCHERS, DEMO_TODAY, "박데모");
  assert.equal(v.no, "V-2607-004");
  assert.equal(v.kind, "급여");
  assert.equal(v.status, "검토중");
  assert.equal(v.runId, run.id);
  assert.equal(sum(v.lines.map((l) => l.debit ?? 0)), run.gross);
  assert.equal(sum(v.lines.map((l) => l.credit ?? 0)), run.gross);
});

test("전표 만들기 → 회차 전표 생성, 회계 검토중 +1, 급여 대기 건수는 그대로", () => {
  const s0 = initial();
  assert.deepEqual(pendingCounts(s0), { payroll: 1, accounting: 1 });
  const s1 = reduce(s0, { type: "createVoucher", runId: "2026-07", date: DEMO_TODAY, author: "박데모" });
  assert.equal(s1.runs[0].status, "전표 생성");
  assert.equal(s1.runs[0].voucherNo, "V-2607-004");
  assert.equal(s1.vouchers[0].no, "V-2607-004");
  assert.deepEqual(pendingCounts(s1), { payroll: 1, accounting: 2 });
  assert.equal(s0.runs[0].status, "처리 대기", "원본은 불변");
});

test("반려 → 회차 전표 반려, 재산출 → 처리 대기로 되돌림", () => {
  const s1 = reduce(initial(), { type: "createVoucher", runId: "2026-07", date: DEMO_TODAY, author: "박데모" });
  const s2 = reduce(s1, { type: "reject", no: "V-2607-004", reason: "수당 재확인" });
  assert.equal(s2.vouchers[0].status, "반려");
  assert.equal(s2.vouchers[0].rejectReason, "수당 재확인");
  assert.equal(s2.runs[0].status, "전표 반려");
  const s3 = reduce(s2, { type: "recalc", runId: "2026-07" });
  assert.equal(s3.runs[0].status, "처리 대기");
  assert.equal(s3.runs[0].voucherNo, undefined);
});

test("승인 → 승인, 지급 완료 → 급여 대기 0", () => {
  const s1 = reduce(initial(), { type: "createVoucher", runId: "2026-07", date: DEMO_TODAY, author: "박데모" });
  const s2 = reduce(s1, { type: "approve", no: "V-2607-004" });
  assert.equal(s2.vouchers[0].status, "승인");
  const s3 = reduce(s2, { type: "markPaid", runId: "2026-07", date: "2026-07-24" });
  assert.equal(s3.runs[0].status, "지급 완료");
  assert.equal(s3.runs[0].paidAt, "2026-07-24");
  assert.deepEqual(pendingCounts(s3), { payroll: 0, accounting: 1 });
});

test("회차 삭제는 처리 대기만, 회차 만들기는 최근 정기급여를 복제", () => {
  const s0 = initial();
  assert.equal(reduce(s0, { type: "deleteRun", runId: "2026-06" }).runs.length, 4);
  assert.equal(reduce(s0, { type: "deleteRun", runId: "2026-07" }).runs.length, 3);
  const s1 = reduce(s0, { type: "createRun", name: "2026년 8월 정기급여", payDate: "2026-08-25" });
  assert.equal(s1.runs[0].id, "2026-08");
  assert.equal(s1.runs[0].status, "처리 대기");
  assert.equal(s1.runs[0].gross, 421_800_000);
  assert.equal(s1.selection.payroll, "2026-08");
});

test("회차 만들기 id 중복 방지 — 같은 달에 여러 번 만들고 지운 뒤 다시 만들어도 겹치지 않는다", () => {
  const s0 = initial();
  const s1 = reduce(s0, { type: "createRun", name: "임시 A", payDate: "2026-07-01" });
  const idA = s1.runs[0].id;
  const s2 = reduce(s1, { type: "createRun", name: "임시 B", payDate: "2026-07-02" });
  const idB = s2.runs[0].id;
  assert.notEqual(idA, idB, "같은 달에 만든 두 회차는 id가 달라야 한다");
  assert.notEqual(idA, "2026-07");
  assert.notEqual(idB, "2026-07");

  const s3 = reduce(s2, { type: "deleteRun", runId: idA });
  const s4 = reduce(s3, { type: "createRun", name: "임시 C", payDate: "2026-07-03" });
  const idC = s4.runs[0].id;
  assert.notEqual(idC, idB, "삭제 뒤 다시 만들어도 남아있는 id와 겹치면 안 된다");
  assert.equal(s4.runs.filter((r) => r.id === idC).length, 1);
});

test("기본 선택: 대기 회차 · 검토중 전표 · 인사총무팀", () => {
  assert.deepEqual(defaultSelection(initial()), { payroll: "2026-07", accounting: "V-2607-001", hr: HR_DEFAULT_TEAM });
  const approved = reduce(initial(), { type: "approve", no: "V-2607-001" });
  assert.equal(defaultSelection(approved).accounting, SUMMARY_ID);
});

test("날짜·금액 표기", () => {
  assert.equal(ddayLabel("2026-07-24", DEMO_TODAY), "D-18");
  assert.equal(ddayLabel("2026-07-06", DEMO_TODAY), "오늘");
  assert.equal(ddayLabel("2026-07-01", DEMO_TODAY), "5일 지남");
  assert.equal(weekdayKo("2026-07-24"), "금");
  assert.equal(formatWon(421_800_000), "421,800,000원");
  assert.equal(formatWon(-31_900_000), "−31,900,000원");
});
