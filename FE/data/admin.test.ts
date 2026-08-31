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
  isNearLimit,
  isValidBizNumber,
  isValidSlug,
  pendingTasks,
  storagePct,
  type ExternalSystem,
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

/* ───────────── isNearLimit (요금 화면·대시보드 판정 통합) ───────────── */

test("isNearLimit은 중지된 곳을 제외하고 기준치 이상만 고른다", () => {
  for (const w of ADMIN_WORKSPACES) {
    const expected = w.status !== "suspended" && storagePct(w) >= LIMIT_WARN_PCT;
    assert.equal(isNearLimit(w), expected, w.slug);
  }
});

test("한도 임박 신호 수와 isNearLimit 집계가 일치한다", () => {
  // 대시보드 신호와 요금 화면 요약이 같은 판정을 쓰는지 고정한다.
  const signal = pendingTasks().filter((t) => t.kind === "limit").length;
  assert.equal(signal, ADMIN_WORKSPACES.filter(isNearLimit).length);
});

test("중지된 워크스페이스는 한도를 넘겨도 한도 임박이 아니다", () => {
  const base = ADMIN_WORKSPACES[0];
  const suspended = {
    ...base,
    slug: "합성-중지",
    status: "suspended" as const,
    usage: { ...base.usage, storageGb: 99, storageLimitGb: 100 },
  };
  assert.equal(storagePct(suspended), 99);
  assert.equal(isNearLimit(suspended), false);
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

test("BILLING_TONE은 상태별 색이 정확하다", () => {
  // 키 집합은 Record<BillingState,...> 타입이 이미 보장한다 — 여기서는 매핑을 본다.
  assert.equal(BILLING_TONE.paid, "green");
  assert.equal(BILLING_TONE.due, "slate");
  assert.equal(BILLING_TONE.overdue, "red", "미수금만 빨강이어야 한다");
});

/* ───────────── pendingTasks 심각도 정렬 (Task 6) ───────────── */

/** 같은 kind 끼리 묶어서 severity 배열을 뽑는다 */
function severitiesOf(kind: TaskKind) {
  return pendingTasks()
    .filter((t) => t.kind === kind)
    .map((t) => t.severity);
}

test("모든 Task가 숫자 severity를 갖는다", () => {
  for (const t of pendingTasks()) {
    assert.equal(typeof t.severity, "number", `${t.kind} ${t.company}`);
    assert.ok(Number.isFinite(t.severity), `${t.kind} ${t.company}: ${t.severity}`);
  }
});

test("각 신호 안에서 severity가 내림차순이다", () => {
  for (const kind of ["integration", "link", "overdue", "limit"] as TaskKind[]) {
    const s = severitiesOf(kind);
    for (let i = 1; i < s.length; i++) {
      assert.ok(s[i] <= s[i - 1], `${kind}: ${s[i - 1]} 다음에 ${s[i]}`);
    }
  }
});

test("미수금 severity는 청구 금액이다", () => {
  for (const t of pendingTasks().filter((x) => x.kind === "overdue")) {
    const ws = ADMIN_WORKSPACES.find((w) => w.slug === t.slug);
    assert.ok(ws);
    const overdue = ws.invoices.find((i) => i.state === "overdue");
    assert.ok(overdue);
    assert.equal(t.severity, overdue.amount);
  }
});

test("한도 임박 severity는 사용률이다", () => {
  for (const t of pendingTasks().filter((x) => x.kind === "limit")) {
    const ws = ADMIN_WORKSPACES.find((w) => w.slug === t.slug);
    assert.ok(ws);
    assert.equal(t.severity, storagePct(ws));
  }
});

test("연동 실패 severity는 그 워크스페이스의 authFail 시스템 수다", () => {
  for (const t of pendingTasks().filter((x) => x.kind === "integration")) {
    const ws = ADMIN_WORKSPACES.find((w) => w.slug === t.slug);
    assert.ok(ws);
    assert.equal(t.severity, ws.systems.filter((s) => s.state === "authFail").length);
  }
});

test("링크 미개봉은 발송일이 오래된 것이 먼저 온다", () => {
  const rows = pendingTasks().filter((t) => t.kind === "link");
  const sentAt = rows.map((t) => {
    const ws = ADMIN_WORKSPACES.find((w) => w.slug === t.slug);
    assert.ok(ws);
    return ws.linkSentAt;
  });
  for (let i = 1; i < sentAt.length; i++) {
    assert.ok(sentAt[i] >= sentAt[i - 1], `${sentAt[i - 1]} 다음에 ${sentAt[i]}`);
  }
});

test("그룹 순서는 severity 정렬 뒤에도 유지된다", () => {
  const ORDER: TaskKind[] = ["integration", "link", "overdue", "limit"];
  const seen = pendingTasks().map((t) => ORDER.indexOf(t.kind));
  for (let i = 1; i < seen.length; i++) {
    assert.ok(seen[i] >= seen[i - 1], "그룹 순서가 깨졌다");
  }
});

/* ───────────── 합성 입력으로 정렬을 실제로 검증한다 ───────────── */

/**
 * 더미 데이터에는 **미수금 1건 · 한도 1건**밖에 없다.
 * 1개짜리 배열은 항상 정렬돼 있으므로 위 「내림차순」 단정이 그 두 신호에서는
 * 절대 실패하지 않는다 — 통과해도 아무것도 증명하지 않는다.
 *
 * `pendingTasks(list)`가 목록을 인자로 받으므로, 실제 워크스페이스를 복제해
 * 값만 바꾼 합성 입력으로 정렬을 진짜로 검증한다.
 */

test("미수금은 금액이 큰 것이 먼저 온다 (합성 3건)", () => {
  const base = ADMIN_WORKSPACES.find((w) => w.invoices.some((i) => i.state === "overdue"));
  assert.ok(base, "미수금 원본이 더미에 없다");
  const overdueInvoice = base.invoices.find((i) => i.state === "overdue");
  assert.ok(overdueInvoice);

  const mk = (slug: string, amount: number) => ({
    ...base,
    slug,
    company: `합성-${slug}`,
    invoices: [{ ...overdueInvoice, amount }],
  });

  // 일부러 정렬되지 않은 순서로 넣는다
  const list = [mk("a", 1_000_000), mk("b", 9_000_000), mk("c", 5_000_000)];
  const rows = pendingTasks(list).filter((t) => t.kind === "overdue");

  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((r) => r.slug),
    ["b", "c", "a"],
    "금액 내림차순(9M, 5M, 1M)이어야 한다",
  );
});

test("한도 임박은 사용률이 높은 것이 먼저 온다 (합성 3건)", () => {
  const base = ADMIN_WORKSPACES.find(
    (w) => w.status !== "suspended" && w.usage.storageLimitGb > 0,
  );
  assert.ok(base, "한도 있는 원본이 더미에 없다");

  // 다른 신호가 섞이지 않게 systems·invoices를 비운다
  const mk = (slug: string, gb: number) => ({
    ...base,
    slug,
    company: `합성-${slug}`,
    status: "live" as const,
    systems: [],
    invoices: [],
    usage: { ...base.usage, storageGb: gb, storageLimitGb: 100 },
  });

  const list = [mk("x", 80), mk("y", 99), mk("z", 90)];
  const rows = pendingTasks(list);

  assert.equal(rows.length, 3, "한도 신호만 3건이어야 한다");
  assert.ok(rows.every((r) => r.kind === "limit"));
  assert.deepEqual(
    rows.map((r) => r.slug),
    ["y", "z", "x"],
    "사용률 내림차순(99%, 90%, 80%)이어야 한다",
  );
});

test("연동 실패는 끊긴 시스템이 많은 곳이 먼저 온다 (합성)", () => {
  const base = ADMIN_WORKSPACES[0];
  const sys = (name: string, state: "ok" | "authFail"): ExternalSystem => ({
    name,
    kind: "ERP",
    site: "본사",
    state,
    lastSync: "1일 전",
  });

  const one = {
    ...base,
    slug: "one",
    company: "합성-one",
    invoices: [],
    usage: { ...base.usage, storageGb: 0, storageLimitGb: 100 },
    systems: [sys("A1", "authFail"), sys("A2", "ok")],
  };
  const two = {
    ...base,
    slug: "two",
    company: "합성-two",
    invoices: [],
    usage: { ...base.usage, storageGb: 0, storageLimitGb: 100 },
    systems: [sys("B1", "authFail"), sys("B2", "authFail")],
  };

  // 1개 끊긴 곳을 먼저 넣어도 2개 끊긴 곳이 위로 와야 한다
  const rows = pendingTasks([one, two]).filter((t) => t.kind === "integration");
  assert.equal(rows.length, 3, "authFail 시스템 수만큼 행이 생긴다 (1 + 2)");
  assert.deepEqual(
    rows.map((r) => r.slug),
    ["two", "two", "one"],
    "2개 끊긴 곳의 행 2개가 먼저, 1개 끊긴 곳이 뒤",
  );
});

test("링크 미개봉은 발송일이 오래된 것이 먼저 온다 (합성)", () => {
  const base = ADMIN_WORKSPACES[0];
  const mk = (slug: string, sentAt: string) => ({
    ...base,
    slug,
    company: `합성-${slug}`,
    status: "invited" as const,
    linkOpened: false,
    linkSentAt: sentAt,
    systems: [],
    invoices: [],
    usage: { ...base.usage, storageGb: 0, storageLimitGb: 100 },
  });

  const rows = pendingTasks([
    mk("new", "2026-08-25"),
    mk("old", "2025-11-08"),
    mk("mid", "2026-03-14"),
  ]);

  assert.deepEqual(
    rows.map((r) => r.slug),
    ["old", "mid", "new"],
    "오래된 순(2025-11, 2026-03, 2026-08)이어야 한다",
  );
});
