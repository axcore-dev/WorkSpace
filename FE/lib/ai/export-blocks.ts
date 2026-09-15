/**
 * 문서 내보내기용 마크다운-라이트 파서 — 모델이 쓴 답(제목 · 문단 · 목록 · 표)을 블록으로 나눈다.
 *
 * docx 로 바꾸는 쪽(`server/export-tools.ts`)이 이 블록만 안다. 지원하는 것: `#`~`###` 제목, `-`/`*` 글머리, `1.` 번호,
 * `| a | b |` 표(구분선 `|---|` 은 버린다), 나머지는 문단. 인라인은 `**굵게**` 만. 그 밖의 마크다운은 글자 그대로 둔다 —
 * 보고서 · 공문에 그 이상은 필요 없고, 모르는 문법을 억지로 해석하면 내용이 사라진다.
 *
 * `node --test` 가 그대로 돌게 `server-only` 를 쓰지 않는다.
 */

export type Run = { text: string; bold: boolean };

export type Block =
  | { kind: "heading"; level: 1 | 2 | 3; runs: Run[] }
  | { kind: "paragraph"; runs: Run[] }
  | { kind: "bullet"; runs: Run[] }
  | { kind: "numbered"; runs: Run[] }
  | { kind: "table"; rows: string[][] };

/** `**굵게**` 만 가른다. 짝이 안 맞는 별표는 글자로 남긴다 */
export function inlineRuns(text: string): Run[] {
  const runs: Run[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index), bold: false });
    runs.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), bold: false });
  return runs.length ? runs : [{ text: "", bold: false }];
}

function splitRow(line: string): string[] {
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return inner.split("|").map((c) => c.trim());
}

const SEPARATOR = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

export function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: Block[] = [];
  let table: string[][] | null = null;

  const flushTable = () => {
    if (table && table.length) out.push({ kind: "table", rows: table });
    table = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const t = line.trim();
    if (t.startsWith("|") && t.length > 1) {
      if (SEPARATOR.test(t)) continue;
      (table ??= []).push(splitRow(t));
      continue;
    }
    flushTable();
    if (!t) continue;
    const h = /^(#{1,3})\s+(.*)$/.exec(t);
    if (h) {
      out.push({ kind: "heading", level: h[1].length as 1 | 2 | 3, runs: inlineRuns(h[2]) });
      continue;
    }
    const b = /^[-*]\s+(.*)$/.exec(t);
    if (b) {
      out.push({ kind: "bullet", runs: inlineRuns(b[1]) });
      continue;
    }
    const n = /^\d+[.)]\s+(.*)$/.exec(t);
    if (n) {
      out.push({ kind: "numbered", runs: inlineRuns(n[1]) });
      continue;
    }
    out.push({ kind: "paragraph", runs: inlineRuns(t) });
  }
  flushTable();
  return out;
}

/** 파일 이름 — 경로 구분자 · 제어 문자를 빼고 길이를 자른 뒤 확장자를 붙인다 */
export function exportFileName(title: string, ext: "docx" | "xlsx"): string {
  const base = title
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return `${base || "문서"}.${ext}`;
}
