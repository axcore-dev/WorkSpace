/**
 * 제품설계 폴백 리듀서와 BOM 규칙. 실행: cd FE && npm test
 *
 * 지키려는 것: 서버(`DesignWriteService`)와 같은 규칙 — 리비전은 앞 리비전에서 파생된 별도 도면이고, 원본 개정이 파생의
 * 지금 리비전을 「확인 필요」로 바꾸고, 확인하면 근거 리비전이 올라가며, 자동 매핑은 호칭+규격 → 품명 순이다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { DRAWINGS } from "../data/drawings.ts";
import { ITEMS } from "../data/inventory-demo.ts";
import { autoMap, autoMapLines, bomTree, latestOf, liveLatest, parseBomRows, reduce, revisionsOf, unmappedCount, type DesignData } from "./design-state.ts";

const state: DesignData = { drawings: DRAWINGS };
const TODAY = "2026-07-08";

test("리비전마다 도면이 하나씩이고 지금 도면은 리비전이 가장 높은 것이다", () => {
  assert.deepEqual(
    revisionsOf(DRAWINGS, "26MSX-S03-20").map((d) => d.rev),
    ["Rev.C", "Rev.B", "Rev.A"],
  );
  assert.equal(latestOf(DRAWINGS, "26MSX-S03-20")!.rev, "Rev.C");
  // 옛 리비전도 자기 BOM 을 갖는다
  assert.equal(revisionsOf(DRAWINGS, "26MSX-S03-20")[2].bom[0].size, "Φ30-140L");
  const live = liveLatest(DRAWINGS);
  assert.equal(live.length, 7, "도면번호 8개 중 폐기 P0 를 뺀 지금 도면");
  assert.ok(live.every((d) => d.status !== "폐기"));
});

test("개정하면 다음 리비전 도면이 하나 더 생기고 앞 리비전은 그대로 남는다 — 파생의 지금 리비전은 확인 필요", () => {
  const next = reduce(state, { type: "revise", code: "26MSX-S03-20", change: "포켓 수정", requester: "사내 설계", excel: true, lines: [] }, TODAY, "설계");
  assert.equal(next.drawings.length, state.drawings.length + 1);
  const cur = latestOf(next.drawings, "26MSX-S03-20")!;
  assert.equal(cur.rev, "Rev.D");
  assert.equal(cur.change, "포켓 수정");
  assert.equal(cur.projectCode, "26MSX-S03 OP20", "차종 · 관리번호는 앞 리비전에서 이어 받는다");
  assert.equal(revisionsOf(next.drawings, "26MSX-S03-20")[1].rev, "Rev.C");
  assert.equal(latestOf(next.drawings, "26MSX-S03-20-P2")!.status, "확인 필요");
  assert.equal(latestOf(next.drawings, "26MSX-S03-20-P0")!.status, "폐기", "폐기된 파생은 그대로");
  assert.equal(revisionsOf(next.drawings, "26MSX-S03-20-P1")[1].status, "승인", "파생의 옛 리비전은 건드리지 않는다");
  assert.equal(latestOf(next.drawings, "26MSX-S04-20-P1")!.status, "승인", "다른 원본의 파생은 그대로");
});

test("파생의 지금 리비전이 개정을 확인하면 승인으로 돌아가고 근거 리비전이 원본의 지금 리비전이 된다", () => {
  const next = reduce(state, { type: "acknowledge", code: "26MSX-S03-20-P1" }, TODAY, "설계");
  const d = latestOf(next.drawings, "26MSX-S03-20-P1")!;
  assert.equal(d.status, "승인");
  assert.equal(d.parentRev, "Rev.C");
  assert.equal(revisionsOf(next.drawings, "26MSX-S03-20-P1")[1].parentRev, "Rev.B", "옛 리비전의 근거는 그대로");
});

test("파생 등록은 고른 리비전(없으면 지금 리비전)을 근거로 삼고, 폐기된 도면 아래에는 만들지 않는다", () => {
  const picked = reduce(
    state,
    { type: "register", drawing: { code: "26MSX-S03-20-P3", name: "하형", parent: "26MSX-S03-20", parentRev: "Rev.B", excel: false, change: "", requester: "사내 설계" }, lines: [] },
    TODAY,
    "설계",
  );
  assert.equal(latestOf(picked.drawings, "26MSX-S03-20-P3")!.parentRev, "Rev.B");
  const next = reduce(
    state,
    { type: "register", drawing: { code: "26MSX-S04-20-P2", name: "하형", parent: "26MSX-S04-20", excel: false, change: "", requester: "사내 설계" }, lines: [] },
    TODAY,
    "설계",
  );
  const d = latestOf(next.drawings, "26MSX-S04-20-P2")!;
  assert.equal(d.rev, "Rev.A");
  assert.equal(d.parentRev, "Rev.B");
  assert.equal(d.change, "최초 등록");
  assert.equal(d.author, "설계");
  const discarded = reduce(state, { type: "discard", code: "26PNQ-S18-10" }, TODAY, "설계");
  const blocked = reduce(discarded, { type: "register", drawing: { code: "X", name: "x", parent: "26PNQ-S18-10", excel: false, change: "", requester: "" }, lines: [] }, TODAY, "설계");
  assert.equal(blocked.drawings.length, discarded.drawings.length);
});

test("매핑은 그 도면 그 리비전의 그 줄만 바꾸고, 미매핑 수가 따라 준다", () => {
  const before = latestOf(state.drawings, "26MSX-S03-20")!;
  assert.equal(unmappedCount(before), 1);
  const next = reduce(state, { type: "mapBom", code: "26MSX-S03-20", rev: "Rev.C", index: 3, itemCode: "ITM-GA-0005" }, TODAY, "설계");
  const after = latestOf(next.drawings, "26MSX-S03-20")!;
  assert.equal(after.bom[3].itemCode, "ITM-GA-0005");
  assert.equal(unmappedCount(after), 0);
  assert.equal(revisionsOf(next.drawings, "26MSX-S03-20")[1].bom[3].itemCode, null, "Rev.B 는 원래대로");
  assert.equal(latestOf(next.drawings, "26MSX-S04-20")!.bom[3].itemCode, "ITM-GA-0005", "다른 도면은 원래대로");
});

test("BOM 트리는 원본의 지금 리비전마다 자기 줄과 파생(현장 제작) 줄을 묶는다", () => {
  const groups = bomTree(DRAWINGS);
  assert.deepEqual(
    groups.map((g) => `${g.drawing.code} ${g.drawing.rev}`),
    ["26MSX-S03-20 Rev.C", "26MSX-S04-20 Rev.B", "26PNQ-S16-10 Rev.D", "26PNQ-S18-10 Rev.A"],
  );
  const s03 = groups[0];
  assert.equal(s03.lines.length, 4);
  assert.deepEqual(
    s03.derived.map((l) => l.line.item),
    ["UPPER HEIGHT BLOCK", "LOWER HEIGHT BLOCK"],
    "P1 의 지금 리비전(Rev.B)과 P2 — 폐기 P0 는 없다",
  );
  assert.equal(s03.derived[0].drawing.rev, "Rev.B");
  // 검색은 줄 단위. 도면번호가 맞으면 그 도면 전부
  const q = bomTree(DRAWINGS, "height");
  assert.equal(q.length, 1);
  assert.equal(q[0].lines.length, 0);
  assert.equal(q[0].derived.length, 2);
  assert.equal(bomTree(DRAWINGS, "s18")[0].lines.length, 3);
});

test("자동 매핑은 호칭+규격을 먼저 보고 없으면 품명으로 찾는다 — 단종 품목은 건너뛴다", () => {
  assert.equal(autoMap({ item: "GUIDE POST", spec: "MYKP", size: "Φ32-140L" }, ITEMS), "ITM-GP-0032");
  // 호칭이 다르면 품명으로 — GAS SPRING 은 여러 개라 먼저 나오는 것
  assert.equal(autoMap({ item: "GAS SPRING", spec: "??", size: "??" }, ITEMS), "ITM-GS-0014");
  assert.equal(autoMap({ item: "UPPER HEIGHT BLOCK", spec: "S45C", size: "Φ40-95L" }, ITEMS), null);
  assert.equal(autoMap({ item: "END RETAINER", spec: "DP-AN", size: "16" }, ITEMS), null, "단종(ITM-ER-0009)은 안 맺는다");
  const lines = autoMapLines(
    [
      { item: "LIFT PIN", spec: "LP", size: "10-58", qty: 3, itemCode: null },
      { item: "GAUGE", spec: "HMD", size: "20*65*35t", qty: 7, itemCode: "ITM-GS-0021" },
    ],
    ITEMS,
  );
  assert.equal(lines[0].itemCode, "ITM-LP-0011");
  assert.equal(lines[1].itemCode, "ITM-GS-0021", "사람이 맺은 것은 두고");
});

test("정제 엑셀 행은 품명·수량이 있어야 하고 수량은 1 이상 정수다", () => {
  const ok = parseBomRows([
    ["품명", "호칭", "규격", "수량"],
    ["GUIDE POST", "MYKP", "Φ32-140L", "4"],
    ["", "", "", ""],
    ["SPRING-LIFT", "SWF", "12-50", "1,000"],
  ]);
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.lines.length, 2);
  assert.equal(ok.lines[1].qty, 1000);
  const bad = parseBomRows([
    ["품 명", "규격", "수 량"],
    ["GAUGE", "20*65*35t", "0"],
    ["", "x", "3"],
  ]);
  assert.equal(bad.lines.length, 0);
  assert.equal(bad.errors.length, 2);
  assert.match(parseBomRows([["이름", "개수"]]).errors[0], /품명/);
});
