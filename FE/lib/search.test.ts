/**
 * `lib/search.ts` 검색 규칙 검증.
 *
 * 실행: cd FE && npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { matchesQuery, normalizeForSearch, searchTokens } from "./search.ts";

test("빈 검색어는 전부 통과", () => {
  assert.equal(matchesQuery("", ["GUIDE POST"]), true);
  assert.equal(matchesQuery("   ", ["GUIDE POST"]), true);
  assert.deepEqual(searchTokens("  "), []);
});

test("대소문자를 가리지 않는다", () => {
  assert.equal(matchesQuery("guide", ["GUIDE POST"]), true);
  assert.equal(matchesQuery("POWERTEC", ["powertec"]), true);
});

test("두 단어는 토큰 AND — 순서 · 띄어쓰기 무관", () => {
  assert.equal(matchesQuery("GUIDE POST", ["GUIDE POST 외 2", "POWERTEC"]), true);
  assert.equal(matchesQuery("post guide", ["GUIDE POST"]), true);
  assert.equal(matchesQuery("guidepost", ["GUIDE POST"]), true);
  assert.equal(matchesQuery("GUIDE PIN", ["GUIDE POST"]), false);
});

test("토큰마다 다른 필드에 맞아도 된다", () => {
  assert.equal(matchesQuery("볼트 M8", ["볼트", "M8", "EA"]), true);
  assert.equal(matchesQuery("볼트 M10", ["볼트", "M8", "EA"]), false);
});

test("하이픈 · 점 · 가운뎃점 차이를 지운다", () => {
  assert.equal(matchesQuery("PO 2607", ["PO-2607-0021"]), true);
  assert.equal(matchesQuery("po-2607-0021", ["PO 2607 0021"]), true);
  assert.equal(matchesQuery("26MSX S03", ["26MSX-S03 OP20"]), true);
  assert.equal(normalizeForSearch("A · B-c.d_e"), "abcde");
});

test("빈 필드 · null 은 무시한다", () => {
  assert.equal(matchesQuery("x", ["", null, undefined]), false);
  assert.equal(matchesQuery("x", ["", "X"]), true);
});
