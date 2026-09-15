/** 문서 내보내기 파서 — 제목 · 목록 · 표 · 굵게가 블록으로 나뉘는지. 실행: cd FE && npm test */
import { test } from "node:test";
import assert from "node:assert/strict";

import { exportFileName, inlineRuns, parseBlocks } from "./export-blocks.ts";

test("제목 · 문단 · 글머리 · 번호 · 표가 블록으로 나뉘고 표 구분선은 버린다", () => {
  const md = [
    "# 주간 보고",
    "",
    "요약 첫 줄",
    "- 항목 **하나**",
    "1. 첫째",
    "| 설비 | 분 |",
    "|---|---:|",
    "| PR-03 | 120 |",
    "## 이슈",
  ].join("\n");
  const blocks = parseBlocks(md);
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["heading", "paragraph", "bullet", "numbered", "table", "heading"],
  );
  assert.deepEqual(blocks[4], { kind: "table", rows: [["설비", "분"], ["PR-03", "120"]] });
  assert.equal((blocks[0] as { level: number }).level, 1);
  assert.equal((blocks[5] as { level: number }).level, 2);
});

test("인라인은 **굵게** 만 가르고 짝이 안 맞으면 글자로 둔다", () => {
  assert.deepEqual(inlineRuns("a **b** c"), [
    { text: "a ", bold: false },
    { text: "b", bold: true },
    { text: " c", bold: false },
  ]);
  assert.deepEqual(inlineRuns("a **b"), [{ text: "a **b", bold: false }]);
  assert.deepEqual(inlineRuns(""), [{ text: "", bold: false }]);
});

test("파일 이름 — 경로 문자를 빼고 확장자를 붙인다", () => {
  assert.equal(exportFileName("9월 2주 보고: PR-03/설비", "docx"), "9월 2주 보고 PR-03 설비.docx");
  assert.equal(exportFileName("   ", "xlsx"), "문서.xlsx");
  assert.ok(exportFileName("가".repeat(100), "docx").length <= 65);
});
