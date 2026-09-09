/**
 * `toChatMessage` · `turnOf` — 파트를 화면 모양으로 접는 규칙. 서버도 저장할 때 같은 함수를 쓴다.
 *
 * 실행: cd FE && npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { toChatMessage, turnOf, type AxpUIMessage } from "./ui-messages.ts";

const msg = (parts: AxpUIMessage["parts"], metadata?: AxpUIMessage["metadata"]): AxpUIMessage => ({
  id: "m1",
  role: "assistant",
  parts,
  metadata,
});

test("본문 조각·문구·행·부가 정보를 한 메시지로 접는다", () => {
  const m = toChatMessage(
    msg(
      [
        { type: "data-turn", data: { conversationId: "c", userSeq: 3, assistantSeq: 4, title: "t" } },
        { type: "data-label", data: { text: "찾고 있어요" } },
        { type: "data-trace", data: { icon: "doc", text: "검색", result: "2개" } },
        { type: "text", text: "안녕" },
        { type: "text", text: "하세요" },
        { type: "data-approval", data: { approvalId: "a1", toolName: "x", label: "X", input: {} } },
        { type: "data-answer", data: { tools: ["RAG 검색"], consulted: ["a.pdf"], summary: "요약" } },
      ],
      { durationMs: 1200 },
    ),
  );
  assert.equal(m.role, "ai");
  assert.equal(m.text, "안녕하세요");
  assert.equal(m.seq, 4);
  assert.deepEqual(m.reasoning, ["찾고 있어요"]);
  assert.equal(m.durationMs, 1200);
  assert.equal(m.approvals?.[0].approvalId, "a1");
  assert.deepEqual(m.process, {
    sources: ["a.pdf"],
    tools: ["RAG 검색"],
    trace: [{ icon: "doc", text: "검색", result: "2개" }],
    summary: "요약",
  });
});

test("도구 파트는 상태에 따라 행이 된다", () => {
  const m = toChatMessage(
    msg([
      { type: "tool-gmail_search", toolCallId: "1", state: "output-available", input: { q: "a" }, output: { n: 1 } },
      { type: "tool-gmail_read", toolCallId: "2", state: "output-error", input: {}, errorText: "권한 없음" },
      { type: "tool-gmail_list", toolCallId: "3", state: "input-available", input: {} },
    ] as AxpUIMessage["parts"]),
  );
  assert.deepEqual(
    m.process?.trace?.map((r) => [r.text, r.result]),
    [
      ["gmail_search", undefined],
      ["gmail_read 실패", "권한 없음"],
      ["gmail_list 실행 중", undefined],
    ],
  );
});

test("보여줄 것이 없으면 process 를 만들지 않는다", () => {
  const m = toChatMessage(msg([{ type: "text", text: "네" }]));
  assert.equal(m.process, undefined);
  assert.equal(m.reasoning, undefined);
  assert.equal(m.approvals, undefined);
});

test("turnOf 는 data-turn 만 뽑는다", () => {
  const turn = { conversationId: "c", userSeq: 1, assistantSeq: 2, title: "t" };
  assert.deepEqual(turnOf(msg([{ type: "text", text: "x" }, { type: "data-turn", data: turn }])), turn);
  assert.equal(turnOf(msg([{ type: "text", text: "x" }])), undefined);
});
