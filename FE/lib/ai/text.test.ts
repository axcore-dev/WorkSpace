/**
 * 임베딩 머리말과 재랭킹 응답 파싱 검증. 실행: cd FE && npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { embedInput, parseRanking, sampleText } from "./text.ts";

test("임베딩 머리말 — 쪽이 있으면 쪽까지, 없으면 문서 이름만", () => {
  assert.equal(
    embedInput("작업표준서.pdf", { page: 12, content: "온도는 180±5℃ 로 유지한다" }),
    "작업표준서.pdf · 12쪽\n온도는 180±5℃ 로 유지한다",
  );
  assert.equal(embedInput("메모.docx", { content: "본문" }), "메모.docx\n본문");
});

test("표본 — 한도까지만 이어 붙이고 마지막 조각은 잘라 담는다", () => {
  const chunks = [{ content: "가".repeat(6) }, { content: "나".repeat(6) }, { content: "다".repeat(6) }];
  // 한도는 본문 길이에만 건다 — 사이에 들어가는 빈 줄은 세지 않는다(분류·요약이 쓰던 그대로).
  // 그래서 한도 10 이면 본문 10자 + 구분자 2자가 된다. 셋째 조각은 한도를 넘겨 담기지 않는다
  assert.equal(sampleText(chunks, 10), "가".repeat(6) + "\n\n" + "나".repeat(4));
  assert.equal(sampleText(chunks, 6), "가".repeat(6));
  assert.equal(sampleText([], 100), "");
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
