import { cellText, type Cell } from "@/data/types";

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

/**
 * 엑셀 양식 다운로드(.xlsx) — 첫 행 머리글은 굵게, 열 폭은 머리글 길이에 맞춘다.
 * `exceljs` 는 이미 읽기(`lib/sheet.ts`)에 쓰는 의존성이고, 번들이 커서 눌렀을 때만 불러온다.
 */
export async function downloadXlsx(filename: string, rows: string[][]) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("양식");
  ws.addRows(rows);
  ws.getRow(1).font = { bold: true };
  rows[0]?.forEach((h, i) => (ws.getColumn(i + 1).width = Math.max(12, h.length * 2 + 4)));
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
