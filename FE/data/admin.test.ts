/**
 * `data/admin.ts` 순수 로직 검증.
 *
 * Node v24 내장 `node --test`로 돌린다 — 타입 스트립이 기본이라 `.ts`를 그대로 실행한다.
 * 테스트 프레임워크를 새로 넣지 않는 이유는 `CLAUDE.md` 의존성 규칙이다.
 *
 * 실행: cd FE && npm test
 *
 * 참고: 실행 시 MODULE_TYPELESS_PACKAGE_JSON 경고가 stderr에 나온다. 무해하다 —
 * `FE/package.json`에 `"type": "module"`을 넣으면 사라지지만 Next 빌드에 영향을 줄 수 있어
 * 건드리지 않는다. 테스트 통과 여부는 종료 코드로 판단한다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ADMIN_WORKSPACES,
  BILLING_TONE,
  LIMIT_WARN_PCT,
  billingState,
  estimateAmount,
  isValidBizNumber,
  isValidSlug,
  pendingTasks,
  storagePct,
  type TaskKind,
} from "./admin.ts";

/* ───────────── 기준선: 더미 데이터가 기대한 모양인지 ───────────── */

test("워크스페이스 더미가 비어 있지 않고 slug가 유일하다", () => {
  assert.ok(ADMIN_WORKSPACES.length > 0);
  const slugs = ADMIN_WORKSPACES.map((w) => w.slug);
  assert.equal(new Set(slugs).size, slugs.length, "slug가 중복됐다");
});

test("더미의 사업자등록번호가 전부 체크섬을 통과한다", () => {
  for (const w of ADMIN_WORKSPACES) {
    assert.ok(isValidBizNumber(w.bizNumber), `${w.company}: ${w.bizNumber}`);
  }
});

test("더미의 slug가 전부 slug 규칙을 통과한다", () => {
  for (const w of ADMIN_WORKSPACES) {
    assert.ok(isValidSlug(w.slug), w.slug);
  }
});

/* ───────────── storagePct ───────────── */

test("storagePct는 0~100 범위이고 한도 0이면 0이다", () => {
  for (const w of ADMIN_WORKSPACES) {
    const pct = storagePct(w);
    assert.ok(pct >= 0 && pct <= 100, `${w.slug}: ${pct}`);
    if (w.usage.storageLimitGb === 0) assert.equal(pct, 0);
  }
});

test("storagePct는 사용량/한도를 반올림한 값이다", () => {
  const w = ADMIN_WORKSPACES.find((x) => x.usage.storageLimitGb > 0);
  assert.ok(w, "한도가 있는 워크스페이스가 더미에 없다");
  const expected = Math.min(
    100,
    Math.round((w.usage.storageGb / w.usage.storageLimitGb) * 100),
  );
  assert.equal(storagePct(w), expected);
});

/* ───────────── estimateAmount ───────────── */

test("estimateAmount는 양수를 돌려준다", () => {
  for (const w of ADMIN_WORKSPACES) {
    assert.ok(estimateAmount(w) > 0, w.slug);
  }
});

/* ───────────── pendingTasks 기준선 ───────────── */

test("pendingTasks는 신호 4종만 만들고 그룹 순서를 지킨다", () => {
  const ORDER: TaskKind[] = ["integration", "link", "overdue", "limit"];
  const tasks = pendingTasks();
  assert.ok(tasks.length > 0, "더미에 손볼 것이 하나도 없다");

  for (const t of tasks) assert.ok(ORDER.includes(t.kind), t.kind);

  // 같은 kind가 흩어져 있지 않고 ORDER 순서대로 뭉쳐 있어야 한다
  const seen = tasks.map((t) => ORDER.indexOf(t.kind));
  for (let i = 1; i < seen.length; i++) {
    assert.ok(seen[i] >= seen[i - 1], `그룹 순서가 깨졌다: ${tasks[i].kind}`);
  }
});

test("연동 실패 신호는 authFail 시스템 수와 개수가 같다", () => {
  const expected = ADMIN_WORKSPACES.reduce(
    (n, w) => n + w.systems.filter((s) => s.state === "authFail").length,
    0,
  );
  assert.equal(pendingTasks().filter((t) => t.kind === "integration").length, expected);
});

test("링크 미개봉 신호는 invited + 링크 미개봉인 곳만이다", () => {
  const expected = ADMIN_WORKSPACES.filter(
    (w) => w.status === "invited" && !w.linkOpened,
  ).length;
  assert.equal(pendingTasks().filter((t) => t.kind === "link").length, expected);
});

test("미수금 신호는 중지된 곳도 포함한다", () => {
  const expected = ADMIN_WORKSPACES.filter((w) =>
    w.invoices.some((i) => i.state === "overdue"),
  ).length;
  assert.equal(pendingTasks().filter((t) => t.kind === "overdue").length, expected);
});

test("한도 임박 신호는 중지된 곳을 제외하고 기준치 이상만이다", () => {
  const expected = ADMIN_WORKSPACES.filter(
    (w) => w.status !== "suspended" && storagePct(w) >= LIMIT_WARN_PCT,
  ).length;
  assert.equal(pendingTasks().filter((t) => t.kind === "limit").length, expected);
});

test("pendingTasks는 넘긴 목록만 본다", () => {
  assert.deepEqual(pendingTasks([]), []);
});

/* ───────────── billingState (Task 5에서 data/admin.ts로 이관) ───────────── */

test("billingState는 미수금이 있으면 overdue다", () => {
  const w = ADMIN_WORKSPACES.find((x) => x.invoices.some((i) => i.state === "overdue"));
  assert.ok(w, "미수금이 있는 워크스페이스가 더미에 없다");
  assert.equal(billingState(w), "overdue");
});

test("billingState는 미수금이 없으면 due다", () => {
  const w = ADMIN_WORKSPACES.find(
    (x) => x.invoices.length > 0 && !x.invoices.some((i) => i.state === "overdue"),
  );
  assert.ok(w, "미수금 없는 청구 내역을 가진 워크스페이스가 더미에 없다");
  assert.equal(billingState(w), "due");
});

test("billingState는 청구 내역이 없어도 due다", () => {
  const empty = { ...ADMIN_WORKSPACES[0], invoices: [] };
  assert.equal(billingState(empty), "due");
});

test("BILLING_TONE은 BillingState 3종을 모두 덮는다", () => {
  assert.deepEqual(Object.keys(BILLING_TONE).sort(), ["due", "overdue", "paid"]);
});
