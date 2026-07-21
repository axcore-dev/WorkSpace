import type { Cell } from "@/data/types";

const cellText = (c: Cell) => (typeof c === "object" ? c.badge : String(c));

/** CSV 다운로드 — Excel 한글 호환을 위해 BOM 포함 */
export function downloadCsv(filename: string, rows: Cell[][]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = "﻿" + rows.map((r) => r.map((c) => esc(cellText(c))).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
