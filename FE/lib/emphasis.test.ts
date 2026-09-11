import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPHASIS_CLASS, cellEmphasis } from "./emphasis.ts";

test("미지정 열은 기본이다 — 첫 열이라고 강조되지 않는다", () => {
  assert.equal(cellEmphasis(undefined, false), "base");
});

test("열 지정은 그대로 살린다", () => {
  assert.equal(cellEmphasis("em", false), "em");
  assert.equal(cellEmphasis("down", false), "down");
});

test("행이 내림이면 열의 강조도 덮는다 — 끝난 행은 셀 전부 회색", () => {
  assert.equal(cellEmphasis("em", true), "down");
  assert.equal(cellEmphasis(undefined, true), "down");
});

test("내림의 하한은 slate-500 이고 굵기가 없다", () => {
  assert.equal(EMPHASIS_CLASS.down, "text-slate-500");
  assert.ok(!EMPHASIS_CLASS.down.includes("font-"));
  assert.ok(EMPHASIS_CLASS.em.includes("font-semibold"));
});
