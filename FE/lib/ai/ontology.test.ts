/**
 * 온톨로지 규칙 검증 — 권한 필터 · 파생값(현재 재고 · 미매핑 BOM) · filter · 동의어 확장. 실행: cd FE && npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { Drawing } from "../../data/drawings";
import type { Item, ItemStandard, Movement } from "../../data/inventory";
import { applyFilters, bomLines, conceptsFor, describeConcepts, expandSynonyms, ONTOLOGY, stockRows } from "./ontology.ts";

const item = (code: string, discontinued = false): Item => ({ code, name: code, spec: "", size: "", unit: "EA", category: "", vendorIds: [], location: "", discontinued });
const drawing = (code: string, rev: string, status: Drawing["status"], bom: { item: string; itemCode: string | null }[]): Drawing => ({
  code,
  rev,
  name: code,
  excel: true,
  author: "",
  updated: "2026-09-01",
  status,
  change: "",
  requester: "",
  bom: bom.map((l) => ({ item: l.item, spec: "", size: "", qty: 1, itemCode: l.itemCode })),
});

test("권한 탭이 없는 개념은 목록에 없다 — 이름조차 모델에 보이지 않는다", () => {
  assert.deepEqual(
    conceptsFor(["stock", "bom"]).map((c) => c.id),
    ["stock", "bom_line"],
  );
  assert.equal(conceptsFor([]).length, 0);
  assert.ok(describeConcepts(conceptsFor(["bom"])).includes("미매핑"));
});

test("모든 개념의 id 는 유일하고 탭은 modules.ts 의 탭 id 형태다", () => {
  const ids = ONTOLOGY.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of ONTOLOGY) assert.match(c.tab, /^[a-z]+$/);
});

test("미매핑 BOM — 지금 도면(최신 리비전 · 폐기 제외)의 줄만, itemCode 가 비면 mapped=false", () => {
  const drawings = [
    drawing("S03", "Rev.A", "승인", [{ item: "옛 줄", itemCode: null }]),
    drawing("S03", "Rev.B", "승인", [{ item: "베어링", itemCode: "PRT-1" }, { item: "볼트", itemCode: null }]),
    drawing("S09", "Rev.A", "폐기", [{ item: "폐기 줄", itemCode: null }]),
  ];
  const lines = bomLines(drawings);
  assert.deepEqual(lines.map((l) => l.item), ["베어링", "볼트"]);
  const unmapped = applyFilters(lines, [{ attr: "mapped", op: "eq", value: false }]);
  assert.deepEqual(unmapped.map((l) => [l.drawing, l.rev, l.item]), [["S03", "Rev.B", "볼트"]]);
  assert.equal(applyFilters(lines, [{ attr: "itemCode", op: "is_null" }]).length, 1);
});

test("현재 재고 — 화면과 같은 계산(기초 + 입고 − 출고 ± 조정, 불합격 제외), 단종 품목 제외", () => {
  const items = [item("A"), item("B", true)];
  const standards: ItemStandard[] = [{ itemCode: "A", baseline: 10, asOf: "2026-09-01", safety: 5 }];
  const movements: Movement[] = [
    { id: "1", at: "2026-08-30T10:00", itemCode: "A", kind: "in", qty: 100, actor: "", ref: "", note: "" }, // 기준일 전
    { id: "2", at: "2026-09-02T10:00", itemCode: "A", kind: "in", qty: 7, actor: "", ref: "", note: "", judgement: "pass" },
    { id: "3", at: "2026-09-03T10:00", itemCode: "A", kind: "in", qty: 9, actor: "", ref: "", note: "", judgement: "fail" },
    { id: "4", at: "2026-09-04T10:00", itemCode: "A", kind: "out", qty: -3, actor: "", ref: "", note: "" },
  ];
  const rows = stockRows(items, movements, standards);
  assert.deepEqual(rows.map((r) => [r.itemCode, r.stock, r.safety]), [["A", 14, 5]]);
  assert.equal(applyFilters(rows, [{ attr: "stock", op: "gt", value: 0 }]).length, 1);
});

test("filter — contains 는 대소문자 무시, 알 수 없는 op 없이 AND 로 묶인다", () => {
  const rows = [
    { code: "PRT-BRG-608", name: "베어링 608ZZ" },
    { code: "MAT-AL-6061", name: "알루미늄" },
  ];
  assert.equal(applyFilters(rows, [{ attr: "name", op: "contains", value: "608zz" }]).length, 1);
  assert.equal(applyFilters(rows, [{ attr: "code", op: "contains", value: "PRT" }, { attr: "name", op: "ne", value: "베어링 608ZZ" }]).length, 0);
  assert.equal(applyFilters(rows, undefined).length, 2);
});

test("동의어 확장 — 질문에 든 개념의 다른 말을 덧붙이고, 없는 개념은 건드리지 않는다", () => {
  const q = expandSynonyms("미매핑 제품 리스트");
  assert.ok(q.includes("품목"), q);
  assert.ok(q.includes("BOM"), q);
  assert.ok(!q.includes("급여"), q);
  assert.equal(expandSynonyms("오늘 점심 뭐 먹지?"), "오늘 점심 뭐 먹지?");
});
