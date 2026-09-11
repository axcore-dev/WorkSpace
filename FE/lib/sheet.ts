/**
 * 업로드한 표 파일 → 문자열 행. 첫 행이 머리글이다.
 * CSV 는 직접 읽고, .xlsx 는 이미 있는 `exceljs` 를 그때 불러온다(번들이 커서 눌렀을 때만).
 * 옛 .xls(바이너리)는 읽지 않는다 — xlsx 나 csv 로 저장해 달라고 한다.
 */
export interface Sheet {
  columns: string[];
  rows: string[][];
}

export async function parseSheet(file: File): Promise<Sheet> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) return parseXlsx(file);
  if (name.endsWith(".xls")) throw new Error("xlsx 또는 csv 파일로 저장해 주세요");
  return parseCsv(await file.text());
}

/** RFC 4180 최소 — 따옴표 안의 쉼표 · 줄바꿈 · 이중 따옴표를 처리한다. 앞의 BOM 은 버린다 */
export function parseCsv(text: string): Sheet {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return toSheet(rows);
}

async function parseXlsx(file: File): Promise<Sheet> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("시트가 비어 있어요");
  const rows: string[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= ws.columnCount; c++) cells.push(String(row.getCell(c).text ?? "").trim());
    rows.push(cells);
  }
  return toSheet(rows);
}

/** 빈 행은 버리고, 첫 행을 머리글로 */
function toSheet(all: string[][]): Sheet {
  const rows = all.filter((r) => r.some((c) => c.trim() !== ""));
  const [columns = [], ...body] = rows;
  const width = columns.length;
  return { columns: columns.map((c) => c.trim()), rows: body.map((r) => Array.from({ length: width }, (_, i) => (r[i] ?? "").trim())) };
}
