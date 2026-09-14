/**
 * `data/ko.ts` 조사 선택 검증.
 *
 * 실행: cd FE && npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { josa, withJosa } from "./ko.ts";

test("받침이 없으면 「를」", () => {
  assert.equal(josa("생산본부", "을/를"), "를");
});

test("받침이 있으면 「을」", () => {
  assert.equal(josa("공장장", "을/를"), "을");
});

test("ㄹ 받침은 「로」다", () => {
  // 「서울으로」가 아니라 「서울로」
  assert.equal(josa("서울", "로/으로"), "로");
  assert.equal(josa("관리자", "로/으로"), "로");
  assert.equal(josa("생산기술팀", "로/으로"), "으로");
});

test("영문·숫자로 끝나면 받침 없음으로 친다", () => {
  // 읽는 사람마다 발음이 달라 둘 중 하나는 골라야 한다 — 어색함이 덜한 쪽
  assert.equal(josa("MES", "을/를"), "를");
  assert.equal(josa("1공장 MES", "을/를"), "를");
  assert.equal(josa("2026", "로/으로"), "로");
});

test("빈 문자열도 터지지 않는다", () => {
  assert.equal(josa("", "을/를"), "를");
  assert.equal(josa("   ", "로/으로"), "로");
});

test("앞뒤 공백은 무시한다", () => {
  assert.equal(josa("  공장장  ", "을/를"), "을");
});

test("withJosa는 이름과 조사를 붙인다", () => {
  assert.equal(withJosa("생산본부", "을/를"), "생산본부를");
  assert.equal(withJosa("공장장", "을/를"), "공장장을");
});

test("은/는 — 받침 있으면 「은」, 없으면 「는」", () => {
  // 발주서 편집기: 서식에 안 찍히는 열 이름 뒤 — 「단위는」 · 「가공 요청은」 · 「호칭 · 단위는」(마지막 글자 기준)
  assert.equal(withJosa("단위", "은/는"), "단위는");
  assert.equal(withJosa("가공 요청", "은/는"), "가공 요청은");
  assert.equal(withJosa("호칭 · 단위", "은/는"), "호칭 · 단위는");
});
