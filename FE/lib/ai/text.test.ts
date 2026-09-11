/**
 * 임베딩 머리말과 재랭킹 응답 파싱 검증. 실행: cd FE && npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { embedInput, parseRanking } from "./text.ts";

test("임베딩 머리말 — 쪽이 있으면 쪽까지, 없으면 문서 이름만", () => {
  assert.equal(
    embedInput("작업표준서.pdf", { page: 12, content: "온도는 180±5℃ 로 유지한다" }),
    "작업표준서.pdf · 12쪽\n온도는 180±5℃ 로 유지한다",
  );
  assert.equal(embedInput("메모.docx", { content: "본문" }), "메모.docx\n본문");
});

test("재랭킹 파싱 — 번호만 뽑고 순서를 지킨다", () => {
  assert.deepEqual(parseRanking("3, 1, 7", 8), [3, 1, 7]);
  assert.deepEqual(parseRanking("3, 1, 7 번이 관련 있습니다", 8), [3, 1, 7]);
});

test("재랭킹 파싱 — 범위 밖과 중복은 버린다", () => {
  assert.deepEqual(parseRanking("2, 99, 2, 0, 5", 8), [2, 5]);
  assert.deepEqual(parseRanking("", 8), []);
  // 고를 것이 없다고 답하면 빈 목록이다 — 부르는 쪽이 검색 순서로 되돌린다
  assert.deepEqual(parseRanking("없습니다", 8), []);
});
