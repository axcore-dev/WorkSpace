import assert from "node:assert/strict";
import { test } from "node:test";
import type { Item, Movement, PurchaseOrder, Vendor } from "../data/inventory";
import { DEMO_TODAY, DOC_RULES, ITEMS, MOVEMENTS, ORDERS, SAFETY_STANDARD, STANDARDS, VENDORS } from "../data/inventory-demo.ts";
import { orderSort, orderStatus, reduce, safetyOf, shortage, stockBreakdown, stockOf, type InventoryState } from "./inventory-state.ts";

const state: InventoryState = {
  orders: ORDERS,
  movements: MOVEMENTS,
  items: ITEMS,
  vendors: VENDORS,
  standards: STANDARDS,
  standard: SAFETY_STANDARD,
  docRules: DOC_RULES,
  today: DEMO_TODAY,
};

const order = (poNo: string) => ORDERS.find((o) => o.poNo === poNo)!;

/* ───────────── 발주 상태 ───────────── */

test("기한 넘김 — 잔량이 있고 경과일이 리드타임을 넘었다", () => {
  // POWERTEC 리드타임 5일, 07-02 발주, 오늘 07-08 → 6일
  assert.deepEqual(orderStatus(order("PO-2607-0021"), VENDORS, DEMO_TODAY), { kind: "overdue", days: 6 });
});

test("등록 전 — 입고가 한 건도 없으면 경과일만 말한다", () => {
  assert.deepEqual(orderStatus(order("PO-2607-0023"), VENDORS, DEMO_TODAY), { kind: "waiting", days: 3 });
});

test("리드타임 없는 거래처는 기한 넘김을 판단하지 않는다 — 등록 전으로만", () => {
  // 신성금속 leadTimeDays null. 「도착」은 시스템이 모른다
  assert.equal(orderStatus(order("PO-2607-0025"), VENDORS, DEMO_TODAY).kind, "waiting");
});

test("부분 입고 — 잔량을 말한다", () => {
  assert.deepEqual(orderStatus(order("PO-2607-0024"), VENDORS, DEMO_TODAY), { kind: "partial", remaining: 3 });
});

test("잔량 0 이거나 마감했으면 완료", () => {
  assert.equal(orderStatus(order("PO-2607-0022"), VENDORS, DEMO_TODAY).kind, "done");
  const closed: PurchaseOrder = { ...order("PO-2607-0024"), closedOn: "2026-07-07" };
  assert.equal(orderStatus(closed, VENDORS, DEMO_TODAY).kind, "done");
});

test("정렬은 할 일 순 — 기한 넘김 → 등록 전(경과일 큰 순) → 부분 입고 → 완료", () => {
  const kinds = orderSort(ORDERS, VENDORS, DEMO_TODAY).map((o) => orderStatus(o, VENDORS, DEMO_TODAY).kind);
  assert.deepEqual(kinds, ["overdue", "waiting", "waiting", "partial", "done", "done"]);
  const waiting = orderSort(ORDERS, VENDORS, DEMO_TODAY).filter((o) => orderStatus(o, VENDORS, DEMO_TODAY).kind === "waiting");
  // 07-05 발주(3일) 가 07-06 발주(2일) 보다 위
  assert.deepEqual(waiting.map((o) => o.poNo), ["PO-2607-0023", "PO-2607-0025"]);
});

/* ───────────── 재고 ───────────── */

test("재고 = 기초 + 입고 − 출고 + 조정", () => {
  // GAS SPRING MH 1500: 기초 29, 출고 2
  assert.deepEqual(stockBreakdown("ITM-GS-0021", MOVEMENTS, STANDARDS), { baseline: 29, in: 0, out: 2, adjust: 0, stock: 27 });
  // WEAR PLATE 28-100: 기초 16, 조정 −1
  assert.equal(stockOf("ITM-WP-0004", MOVEMENTS, STANDARDS), 15);
});

test("불합격 입고와 기준일 이전 이력은 합산하지 않는다", () => {
  const extra: Movement[] = [
    { id: "x1", at: "2026-07-01T09:00", itemCode: "ITM-GB-0004", kind: "in", qty: 5, actor: "", ref: "", note: "", judgement: "fail" },
    { id: "x2", at: "2026-05-30T09:00", itemCode: "ITM-GB-0004", kind: "in", qty: 5, actor: "", ref: "", note: "" },
  ];
  assert.equal(stockOf("ITM-GB-0004", [...MOVEMENTS, ...extra], STANDARDS), 6);
});

test("모자란 수량 — 기준 없음은 null, 기준 0 은 항상 충족", () => {
  assert.equal(shortage(27, 29), 2);
  assert.equal(shortage(35, 30), 0);
  assert.equal(shortage(0, null), null);
  assert.equal(shortage(0, 0), 0);
});

test("자동 산정은 기본 거래처 리드타임 × 일평균 출고 — 리드타임이 없으면 미설정", () => {
  const auto = { ...state, standard: { method: "leadTimeAvg" as const, avgWindowDays: 30 } };
  const gs1500 = ITEMS.find((i) => i.code === "ITM-GS-0021")!; // 한국가스스프링 10일, 30일 안 출고 2 → ceil(2/30×10) = 1
  assert.equal(safetyOf(gs1500, auto), 1);
  const al = ITEMS.find((i) => i.code === "MAT-AL-6061")!; // 신성금속 리드타임 null
  assert.equal(safetyOf(al, auto), null);
  const noOut = ITEMS.find((i) => i.code === "ITM-GP-0007")!; // 출고 0건 → 0
  assert.equal(safetyOf(noOut, auto), 0);
});

/* ───────────── 리듀서 ───────────── */

test("입고 등록 — 합격분만 잔량에서 빠지고 이력 행이 생긴다", () => {
  const next = reduce(
    state,
    { type: "receive", poNo: "PO-2607-0021", lines: [{ no: "32", received: 2, judgement: "pass" }, { no: "31", received: 1, judgement: "fail", note: "치수 불량" }], complete: false },
    "2026-07-08T10:00",
    "검사 담당",
  );
  const o = next.orders.find((x) => x.poNo === "PO-2607-0021")!;
  assert.equal(o.lines.find((l) => l.no === "32")!.received, 2);
  assert.equal(o.lines.find((l) => l.no === "31")!.received, 2, "불합격은 세지 않는다");
  assert.equal(next.movements.length, MOVEMENTS.length + 2);
  assert.equal(stockOf("ITM-LP-0011", next.movements, next.standards), 2);
  assert.equal(stockOf("ITM-SP-0001", next.movements, next.standards), 3, "불합격 1 은 재고에 없다");
  assert.equal(state.movements.length, MOVEMENTS.length, "원본은 그대로");
});

test("초과 입고는 막지 않는다 — 잔량 0, 초과분은 이력 메모에 남는다", () => {
  // PO-2607-0024 GAUGE 잔량 3 에 5 를 받는다
  const next = reduce(state, { type: "receive", poNo: "PO-2607-0024", lines: [{ no: "13", received: 5, judgement: "pass", note: "업체가 여분 동봉" }], complete: false }, "2026-07-08T10:00", "검사 담당");
  const line = next.orders.find((x) => x.poNo === "PO-2607-0024")!.lines[0];
  assert.equal(Math.max(0, line.ordered - line.received), 0);
  assert.equal(next.movements[0].note, "업체가 여분 동봉 · 초과 +2");
  assert.equal(next.movements[0].qty, 5, "실제 받은 수량이 재고에 들어간다");
});

test("발주서 위저드가 만든 발주는 목록 앞에 들어간다", () => {
  const created: PurchaseOrder = { ...order("PO-2607-0023"), poNo: "PO-2607-0099" };
  const next = reduce(state, { type: "createOrders", orders: [created] }, "2026-07-08T10:00", "구매 담당");
  assert.equal(next.orders[0].poNo, "PO-2607-0099");
  assert.equal(next.orders.length, ORDERS.length + 1);
});

test("마감하면 잔량이 남아도 완료가 된다", () => {
  const next = reduce(state, { type: "receive", poNo: "PO-2607-0024", lines: [], complete: true }, "2026-07-08T10:00", "테스터");
  assert.equal(orderStatus(next.orders.find((x) => x.poNo === "PO-2607-0024")!, VENDORS, DEMO_TODAY).kind, "done");
});

test("기초 재고 변경은 기준을 바꾸고 baseline 이력을 남긴다 — 재고에는 합산하지 않는다", () => {
  const next = reduce(state, { type: "setBaseline", itemCode: "ITM-GS-0021", baseline: 40, asOf: "2026-07-01", safety: 29 }, "2026-07-08T10:00", "테스터");
  // 07-01 이후 이력이 없으니 40 그대로
  assert.equal(stockOf("ITM-GS-0021", next.movements, next.standards), 40);
  assert.equal(next.movements[0].kind, "baseline");
  assert.equal(next.movements[0].actor, "테스터", "누가 바꿨는지 남는다");
});

test("「만들기」 거래처는 리드타임이 비어 있다", () => {
  const next = reduce(state, { type: "createVendorInline", name: " 새거래처 " }, "2026-07-08T10:00", "테스터");
  const v: Vendor = next.vendors[next.vendors.length - 1];
  assert.equal(v.name, "새거래처");
  assert.equal(v.leadTimeDays, null);
  assert.equal(v.active, true);
});

test("품목 upsert 는 코드 기준이다", () => {
  const item: Item = { ...ITEMS[0], name: "GAS SPRING (신)" };
  const next = reduce(state, { type: "upsertItem", item }, "2026-07-08T10:00", "테스터");
  assert.equal(next.items.length, ITEMS.length);
  assert.equal(next.items.find((i) => i.code === item.code)!.name, "GAS SPRING (신)");
});
