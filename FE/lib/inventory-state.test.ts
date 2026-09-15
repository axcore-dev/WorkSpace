import assert from "node:assert/strict";
import { test } from "node:test";
import type { Item, Movement, PurchaseOrder, Vendor } from "../data/inventory";
import { DEMO_TODAY, DOC_RULES, ITEMS, MOVEMENTS, ORDERS, SAFETY_STANDARD, STANDARDS, VENDORS } from "../data/inventory-demo.ts";
import { DRAWINGS } from "../data/drawings.ts";
import {
  bomNeeds,
  buildOrders,
  normalizeDocRules,
  draftFromBom,
  groupDraft,
  orderDocuments,
  validateDraft,
  itemUsage,
  orderGroups,
  orderStatus,
  parseItemRows,
  reduce,
  safetyOf,
  shortage,
  stockBreakdown,
  stockOf,
  toPoDrawings,
  validateDocRules,
  validateItem,
  validateVendor,
  type InventoryState,
} from "./inventory-state.ts";

const state: InventoryState = {
  drawings: DRAWINGS,
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

test("대기 — 입고가 한 건도 없으면 경과일만 말한다", () => {
  assert.deepEqual(orderStatus(order("PO-2607-0023"), VENDORS, DEMO_TODAY), { kind: "waiting", days: 3 });
});

test("리드타임 없는 거래처는 기한 넘김을 판단하지 않는다 — 대기로만", () => {
  // 신성금속 leadTimeDays null. 「도착」은 시스템이 모른다
  assert.equal(orderStatus(order("PO-2607-0025"), VENDORS, DEMO_TODAY).kind, "waiting");
});

test("부분 입고도 대기 — 잔량은 상태가 아니라 입고 막대가 말한다", () => {
  // JINYANG 리드타임 7일, 07-02 발주 → 6일. 4/7 입고
  assert.deepEqual(orderStatus(order("PO-2607-0024"), VENDORS, DEMO_TODAY), { kind: "waiting", days: 6 });
});

test("잔량 0 이거나 마감했으면 완료", () => {
  assert.equal(orderStatus(order("PO-2607-0022"), VENDORS, DEMO_TODAY).kind, "done");
  const closed: PurchaseOrder = { ...order("PO-2607-0024"), closedOn: "2026-07-07" };
  assert.equal(orderStatus(closed, VENDORS, DEMO_TODAY).kind, "done");
});

test("발주 묶음 — 같은 관리번호 · 발주일 · 도면으로 나간 발주(한 번의 발주서 작성)는 한 줄", () => {
  const groups = orderGroups(ORDERS, VENDORS, DEMO_TODAY);
  // POWERTEC + JINYANG 이 26MSX-S03 OP20 · 07-02 로 함께 나갔다
  const s03 = groups.find((g) => g.orders.some((o) => o.poNo === "PO-2607-0021"))!;
  assert.deepEqual(s03.orders.map((o) => o.poNo), ["PO-2607-0021", "PO-2607-0022"], "묶음 안은 발주번호 순(작성 때 발주처 순)");
  assert.deepEqual(s03.status, { kind: "overdue", days: 6 }, "묶음 상태는 가장 급한 발주를 따른다");
  // 같은 관리번호라도 발주일이 다르면 따로
  assert.equal(groups.filter((g) => g.orders[0].projectCode === "26MSX-S04 OP20").length, 2);
});

test("묶음 정렬은 할 일 순 — 기한 넘김 → 대기(경과일 큰 순) → 완료(최근 발주 먼저)", () => {
  const groups = orderGroups(ORDERS, VENDORS, DEMO_TODAY);
  assert.deepEqual(
    groups.map((g) => [g.status.kind, g.orders.map((o) => o.poNo).join("+")]),
    [
      ["overdue", "PO-2607-0021+PO-2607-0022"],
      ["waiting", "PO-2607-0024"],
      ["waiting", "PO-2607-0023"],
      ["waiting", "PO-2607-0025"],
      ["done", "PO-2606-0018"],
    ],
  );
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

test("발주서 편집기 — BOM 초안 · 발주처별 묶음 · 수량 0 제외 · 자체 제작은 문서 없음", () => {
  // 도면(BOM)은 제품설계에서 온다 — 소요는 BOM 수량, 재고는 매핑 품목의 현재 재고, 발주처는 그 품목의 기본 거래처
  const d = toPoDrawings(DRAWINGS).find((x) => x.code === "26PNQ-S18-10")!;
  const needs = bomNeeds(d.code, state);
  assert.deepEqual(needs.map((n) => [n.itemName, n.need, n.supplier]), [["GUIDE PIN", 16, "대성정공"], ["WEAR PLATE", 20, "대성정공"], ["GAS SPRING", 30, "한국가스스프링"]]);
  assert.deepEqual(needs.map((n) => n.stock), [stockOf("ITM-GP-0007", MOVEMENTS, STANDARDS), stockOf("ITM-WP-0004", MOVEMENTS, STANDARDS), stockOf("ITM-GS-0021", MOVEMENTS, STANDARDS)]);
  const draft = draftFromBom(d, needs, VENDORS, ITEMS, { requester: "구매 담당", orderedOn: DEMO_TODAY });
  assert.deepEqual(draft.lines.map((l) => l.qty), needs.map((n) => Math.max(0, n.need - n.stock)), "수량은 소요 − 재고");
  assert.deepEqual(draft.lines.map((l) => l.vendorId), ["v-daesung", "v-daesung", "v-kgs"]);
  assert.equal(draft.lines[0].unit, "EA", "품목 마스터에서 단위를 가져온다");

  // 한 라인은 0 으로, 한 라인은 자체 제작으로
  const edited = { ...draft, lines: [{ ...draft.lines[0], qty: 0 }, draft.lines[1], { ...draft.lines[2], vendorId: "v-inhouse", tags: ["열처리"] }] };
  const groups = groupDraft(edited);
  assert.deepEqual(groups.map((g) => [g.vendorId, g.lines.length]), [["v-daesung", 1], ["v-inhouse", 1]]);

  const orders = buildOrders(edited, ITEMS, ORDERS.length);
  assert.deepEqual(orders.map((o) => o.poNo), ["PO-2607-0007", "PO-2607-0008"]);
  assert.equal(orders[0].lines[0].itemCode, "ITM-WP-0004", "사양+규격으로 품목을 맞춘다");
  assert.equal(orders[1].lines[0].note, "열처리", "태그는 조치사항 앞에 남는다");
  assert.equal(orderStatus(orders[1], VENDORS, DEMO_TODAY).kind, "waiting", "자체 제작도 대기 — 발주처 열이 「자체 제작」을 말한다");

  const docs = orderDocuments(edited, VENDORS, DOC_RULES);
  assert.deepEqual(docs.map((x) => x.label), ["전체", "대성정공"], "전체 1장 + 거래처별. 자체 제작은 문서 없음");
  // 부품 서식(품목명 · 사양 · 규격 · 수량 · 비고) + 태그가 있어 「가공 요청」 열
  assert.deepEqual(docs[1].rows[4], ["No.", "품목명", "사양", "규격", "수량", "비고", "가공 요청"]);
  assert.equal(docs[0].rows.filter((r) => /^\d+$/.test(r[0] ?? "")).length, 2, "수량 0 라인은 빠진다");
  const material = orderDocuments({ ...edited, format: "material" }, VENDORS, DOC_RULES);
  assert.deepEqual(material[1].rows[4], ["No.", "품목명", "규격", "수량", "비고", "가공 요청"], "자재 서식에는 사양이 없다");
});

test("발주서 검증 — 수량 없음 · 발주처 없음 · 미매핑 BOM", () => {
  const poDrawings = toPoDrawings(DRAWINGS);
  // 폐기되지 않은 원본만 발주 대상이다 — 파생(가공도)은 목록에 없다
  assert.ok(poDrawings.every((x) => !x.code.includes("-P")));
  const d = poDrawings.find((x) => x.code === "26MSX-S03-20")!;
  assert.equal(d.unmapped, 1, "GAUGE 한 줄이 미매핑");
  const draft = draftFromBom(d, bomNeeds(d.code, state), VENDORS, ITEMS, { requester: "", orderedOn: DEMO_TODAY });
  assert.match(validateDraft(draft, poDrawings).unmapped, /미매핑|매핑/);
  const zero = { ...draft, drawing: "", lines: draft.lines.map((l) => ({ ...l, qty: 0 })) };
  assert.equal(validateDraft(zero, poDrawings).lines, "수량이 있는 라인이 없어요");
  const noVendor = { ...draft, drawing: "", lines: draft.lines.map((l) => ({ ...l, vendorId: "" })) };
  assert.equal(validateDraft(noVendor, poDrawings).vendor, "발주처가 빈 라인이 있어요");
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

/* ───────────── 설정 검증 ───────────── */

const gs1500 = ITEMS.find((i) => i.code === "ITM-GS-0021")!;

test("품목: 코드 중복 · 단위 변경(재고·이력 있음) · 기본 거래처 중지를 막는다", () => {
  assert.equal(validateItem({ ...gs1500 }, state, true).code, "이미 있는 코드예요");
  assert.match(validateItem({ ...gs1500, unit: "kg" }, state, false).unit, /새 품목으로 등록/);
  // 한일스프링(거래 중지)을 앞으로
  assert.match(validateItem({ ...gs1500, vendorIds: ["v-hanil", "v-kgs"] }, state, false).vendorIds, /거래 중지/);
  assert.deepEqual(validateItem({ ...gs1500, name: "GAS SPRING (신)" }, state, false), {}, "표기 변경은 통과");
  // 이력이 없는 품목은 단위를 바꿀 수 있다
  const fresh = ITEMS.find((i) => i.code === "ITM-ER-0009")!;
  assert.equal(validateItem({ ...fresh, unit: "SET" }, { ...state, movements: [], standards: [] }, false).unit, undefined);
});

test("품목 사용 여부 — 진행 중 발주 · 재고 · 이력", () => {
  const u = itemUsage("ITM-LP-0011", state); // LIFT PIN: PO-0021 · PO-0023 에 라인, 재고 0, 이력 0
  assert.deepEqual(u, { openOrders: 2, stock: 0, movements: 0 });
});

test("거래처: 이름 중복(공백·대소문자 무시) · 자체 제작 하나 · 리드타임 필수 · 이니셜 겹침은 경고만", () => {
  const base = { id: "v-new", name: "power tec", kind: "parts" as const, initial: "PT", leadTimeDays: 3, owner: "", active: true };
  const r = validateVendor(base, state, true);
  assert.equal(r.errors.name, "이미 있는 거래처예요");
  assert.match(r.warnings.initial, /이니셜이 겹쳐요/);
  assert.match(validateVendor({ ...base, name: "새공장", kind: "inhouse" }, state, true).errors.kind, /하나만/);
  assert.match(validateVendor({ ...base, name: "새공장", leadTimeDays: null }, state, true).errors.leadTimeDays, /리드타임/);
  assert.deepEqual(validateVendor({ ...base, name: "새공장", initial: "SG" }, state, true).errors, {});
});

test("거래 중지하면 그 거래처를 기본으로 쓰던 품목은 다음 거래처가 기본이 된다", () => {
  const kgs = VENDORS.find((v) => v.id === "v-kgs")!;
  const next = reduce(state, { type: "upsertVendor", vendor: { ...kgs, active: false } }, "2026-07-08T10:00", "구매 담당");
  const item = next.items.find((i) => i.code === "ITM-GS-0021")!; // [v-kgs, v-hanil]
  assert.deepEqual(item.vendorIds, ["v-hanil", "v-kgs"]);
  const only = next.items.find((i) => i.code === "ITM-GS-0014")!; // [v-kgs] 하나뿐 → 그대로
  assert.deepEqual(only.vendorIds, ["v-kgs"]);
});

test("자동 → 수동으로 바꾸면 자동값이 담당자 값으로 굳는다", () => {
  const auto: InventoryState = { ...state, standard: { method: "leadTimeAvg", avgWindowDays: 30 } };
  const next = reduce(auto, { type: "setStandard", standard: { method: "manual", avgWindowDays: 30 } }, "2026-07-08T10:00", "구매 담당");
  // GAS SPRING MH 1500: 리드타임 10 × (2/30) → 1
  assert.equal(next.standards.find((s) => s.itemCode === "ITM-GS-0021")!.safety, 1);
  // 리드타임 없는 거래처(신성금속)의 품목은 그대로(4000)
  assert.equal(next.standards.find((s) => s.itemCode === "MAT-AL-6061")!.safety, 4000);
});

test("문서 규칙: 옛 열 이름(품명 · 호칭)은 품목명 · 사양으로 읽는다 — 저장된 규칙 · 서버 기본값 호환", () => {
  const legacy = { ...DOC_RULES, formats: { material: ["품명", "규격", "수량"], parts: ["품명", "호칭", "규격", "수량", "납기"] } };
  assert.deepEqual(normalizeDocRules(legacy).formats, { material: ["품목명", "규격", "수량"], parts: ["품목명", "사양", "규격", "수량", "납기"] });
});

test("문서 규칙: 순번 조각 · 품목명/수량 열은 필수", () => {
  assert.match(validateDocRules({ ...DOC_RULES, codeSegments: ["year", "model"] }).codeSegments, /순번/);
  assert.match(validateDocRules({ ...DOC_RULES, formats: { ...DOC_RULES.formats, parts: ["규격"] } }).parts, /품목명 · 수량/);
  assert.deepEqual(validateDocRules(DOC_RULES), {});
});

test("엑셀: 코드 기준으로 갱신 · 신규 · 오류를 나눈다. 미등록 거래처는 만들지 않는다", () => {
  const rows = [
    ["품목 코드", "품목명", "사양", "규격", "단위", "분류", "거래처", "보관 위치", "상태"],
    ["ITM-GS-0021", "GAS SPRING", "MH", "1500", "", "", "한국가스스프링 · POWERTEC", "공구실 A-9", ""],
    ["ITM-NEW-0001", "새 부품", "X", "10", "EA", "금형 부품", "대성정공", "", ""],
    ["ITM-NEW-0002", "거래처 오타", "X", "10", "EA", "", "대성정곡", "", ""],
    ["ITM-GS-0021", "중복", "", "", "", "", "", "", ""],
    ["ITM-WP-0003", "WEAR PLATE", "", "", "kg", "", "", "", ""],
    ["", "코드 없음", "", "", "EA", "", "대성정공", "", ""],
    ["ITM-NEW-0003", "거래처 없음", "", "", "EA", "", "", "", ""],
  ];
  const r = parseItemRows(rows, state);
  assert.deepEqual(r.map((x) => x.status), ["update", "create", "error", "error", "error", "error", "error"]);
  assert.deepEqual(r[0].item!.vendorIds, ["v-kgs", "v-powertec"]);
  assert.equal(r[0].item!.unit, "EA", "빈 칸은 기존 값을 둔다");
  assert.equal(r[0].item!.location, "공구실 A-9");
  assert.match(r[2].reason!, /미등록 거래처: 대성정곡/);
  assert.match(r[3].reason!, /두 번/);
  assert.match(r[4].reason!, /단위를 바꿀 수 없어요/);
  assert.match(r[5].reason!, /비어 있어요/);
  assert.match(r[6].reason!, /거래처가 비어/);
  assert.equal(parseItemRows([["코드", "이름"]], state)[0].reason?.includes("머리글"), true);
});

test("품목 삭제 · 엑셀 반영(importItems)", () => {
  const del = reduce(state, { type: "deleteItem", itemCode: "ITM-ER-0009" }, "2026-07-08T10:00", "구매 담당");
  assert.equal(del.items.some((i) => i.code === "ITM-ER-0009"), false);
  assert.equal(del.standards.some((s) => s.itemCode === "ITM-ER-0009"), false);
  const imp = reduce(state, { type: "importItems", items: [{ ...gs1500, location: "A-9" }, { ...gs1500, code: "ITM-NEW-0001", name: "새 부품" }] }, "2026-07-08T10:00", "구매 담당");
  assert.equal(imp.items.length, ITEMS.length + 1);
  assert.equal(imp.items[0].code, "ITM-NEW-0001", "신규는 앞에");
  assert.equal(imp.items.find((i) => i.code === "ITM-GS-0021")!.location, "A-9");
});
