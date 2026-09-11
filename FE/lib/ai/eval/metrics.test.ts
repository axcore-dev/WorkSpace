/**
 * 검색 품질 지표 검증. 실행: cd FE && npm test (node --test, 타입 스트립 — `@/` 별칭 import 금지)
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  formatSummary,
  recallAt,
  reciprocalRank,
  refusedCorrectly,
  summarize,
  type CaseResult,
} from "./metrics.ts";

const hit: CaseResult = { q: "단가", expected: ["매입.xlsx"], retrieved: ["작업표준.pdf", "매입.xlsx"] };
const miss: CaseResult = { q: "주기", expected: ["설비.pdf"], retrieved: ["매입.xlsx"] };
const first: CaseResult = { q: "규정", expected: ["취업규칙.pdf"], retrieved: ["취업규칙.pdf", "매입.xlsx"] };
const refusedOk: CaseResult = { q: "점심 뭐 먹지", expected: [], retrieved: [] };
const refusedBad: CaseResult = { q: "점심 뭐 먹지", expected: [], retrieved: ["매입.xlsx"] };

test("재현율 — 상위 k 안에 정답 문서가 있으면 1", () => {
  assert.equal(recallAt(hit, 8), 1);
  assert.equal(recallAt(miss, 8), 0);
  // k 를 좁히면 2등은 밖으로 나간다
  assert.equal(recallAt(hit, 1), 0);
  // 근거가 없어야 하는 질문은 재현율의 대상이 아니다
  assert.equal(recallAt(refusedOk, 8), null);
});

test("MRR — 정답이 처음 나온 등수의 역수", () => {
  assert.equal(reciprocalRank(first, 8), 1);
  assert.equal(reciprocalRank(hit, 8), 0.5);
  assert.equal(reciprocalRank(miss, 8), 0);
  assert.equal(reciprocalRank(refusedOk, 8), null);
});

test("거절 — 근거가 없어야 하는 질문에 아무것도 안 가져왔는가", () => {
  assert.equal(refusedCorrectly(refusedOk), true);
  assert.equal(refusedCorrectly(refusedBad), false);
  assert.equal(refusedCorrectly(hit), null);
});

test("요약 — 두 종류의 질문을 섞어도 각자의 모수로 센다", () => {
  const s = summarize([first, hit, miss, refusedOk, refusedBad], 8);
  assert.equal(s.positives, 3);
  assert.equal(s.negatives, 2);
  assert.equal(s.recall, 2 / 3);
  assert.equal(s.mrr, (1 + 0.5 + 0) / 3);
  assert.equal(s.refusal, 0.5);
});

test("요약 — 근거 없는 질문이 하나도 없으면 거절 지표는 null", () => {
  const s = summarize([first], 8);
  assert.equal(s.refusal, null);
  assert.equal(s.recall, 1);
  assert.match(formatSummary(s, 8), /재현율@8 100\.0% · MRR 1\.000 · 거절 —/);
});

test("요약 — 빈 목록에서도 터지지 않는다", () => {
  const s = summarize([], 8);
  assert.deepEqual(s, { positives: 0, negatives: 0, recall: 0, mrr: 0, refusal: null });
});
