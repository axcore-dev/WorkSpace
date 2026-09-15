/**
 * 문서 내보내기 도구 — 모델이 쓴 문서를 docx · xlsx 파일로 만든다.
 *
 * 흐름: 모델이 `export_document` 를 부른다(docx 는 마크다운 본문, xlsx 는 시트 배열) → 파일을 만든다(docx 패키지 · exceljs)
 * → Object Storage 의 `<회사 스키마>/ai-exports/<사용자 id>/<uuid>/<파일명>` 에 넣는다 → exportId 를 돌려준다
 * → 화면이 exportId 로 내려받기 버튼을 그리고, 누르면 GET /ai/exports/:id 가 인증 뒤 파일을 돌려준다.
 *
 * 우리 스토리지에만 쓰고 고객 시스템은 건드리지 않으므로 승인 게이트는 없다. 객체는 전부 비공개고 본인만 내려받는다.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import ExcelJS from "exceljs";
import { z } from "zod";
import { exportFileName, parseBlocks, type Run } from "@/lib/ai/export-blocks";
import { putObject } from "./storage";
import { registerTool } from "./tools";

const MAX_MARKDOWN = 60_000;
const MAX_ROWS = 5_000;

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const cellSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

function runs(list: Run[]): TextRun[] {
  return list.map((r) => new TextRun({ text: r.text, bold: r.bold }));
}

/** 블록 → docx 문단. 표는 첫 줄이 머리글이다 */
export async function buildDocx(title: string, markdown: string): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [new Paragraph({ text: title, heading: HeadingLevel.TITLE })];
  for (const b of parseBlocks(markdown)) {
    switch (b.kind) {
      case "heading":
        children.push(new Paragraph({ children: runs(b.runs), heading: b.level === 1 ? HeadingLevel.HEADING_1 : b.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3 }));
        break;
      case "bullet":
        children.push(new Paragraph({ children: runs(b.runs), bullet: { level: 0 } }));
        break;
      case "numbered":
        children.push(new Paragraph({ children: runs(b.runs), numbering: { reference: "num", level: 0 } }));
        break;
      case "table": {
        const width = b.rows[0]?.length ?? 1;
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: b.rows.map(
              (cells, i) =>
                new TableRow({
                  tableHeader: i === 0,
                  children: Array.from({ length: width }, (_, c) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: cells[c] ?? "", bold: i === 0 })] })] })),
                }),
            ),
          }),
        );
        children.push(new Paragraph({ text: "" }));
        break;
      }
      default:
        children.push(new Paragraph({ children: runs(b.runs), spacing: { after: 120 } }));
    }
  }
  const doc = new Document({
    creator: "AXPoint",
    title,
    numbering: { config: [{ reference: "num", levels: [{ level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START }] }] },
    styles: { default: { document: { run: { font: "Malgun Gothic", size: 21 } } } },
    sections: [{ children }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

type Sheet = { name: string; columns: string[]; rows: (string | number | boolean | null)[][] };

/** 시트마다 머리글 굵게 · 열 너비는 내용 길이로 · 숫자는 숫자 그대로 */
export async function buildXlsx(sheets: Sheet[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AXPoint";
  for (const [i, s] of sheets.entries()) {
    const ws = wb.addWorksheet((s.name || `Sheet${i + 1}`).replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
    ws.addRow(s.columns);
    ws.getRow(1).font = { bold: true };
    for (const r of s.rows.slice(0, MAX_ROWS)) ws.addRow(r);
    ws.columns.forEach((col, c) => {
      const widest = Math.max(s.columns[c]?.length ?? 0, ...s.rows.slice(0, 200).map((r) => String(r[c] ?? "").length));
      col.width = Math.min(60, Math.max(8, widest + 2));
    });
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

registerTool({
  name: "export_document",
  label: "문서 파일 만들기",
  description:
    "답을 docx(워드) 또는 xlsx(엑셀) 파일로 만든다. 사용자가 「파일로」「워드로」「엑셀로」「다운로드」 를 원하면 부른다. " +
    "docx 는 markdown 에 문서 전체(# 제목 · 문단 · - 목록 · | 표 |)를 넣고, xlsx 는 sheets 에 시트마다 columns 와 rows 를 넣는다. " +
    "결과가 오면 사람에게 건네듯 한두 문장으로 답한다 — 예: 「요청하신 주간 재고 보고서예요. 아래 버튼으로 받으시면 되고, 고칠 부분 있으면 말씀해 주세요.」 " +
    "파일 이름만 덜렁 적거나 URL · 유효 기간을 적지 않는다. 내려받기 버튼은 화면이 붙인다. 같은 파일을 다시 달라고 하면 새로 만들지 말고 앞 답변의 버튼을 안내한다.",
  needsApproval: false,
  timeoutMs: 30_000,
  inputSchema: z.object({
    title: z.string().min(1).max(80).describe("문서 제목. 파일 이름이 된다"),
    format: z.enum(["docx", "xlsx"]),
    markdown: z.string().max(MAX_MARKDOWN).optional().describe("docx 본문. 제목 · 문단 · 목록 · 표를 마크다운으로"),
    sheets: z
      .array(z.object({ name: z.string().max(31), columns: z.array(z.string()).min(1).max(50), rows: z.array(z.array(cellSchema)).max(MAX_ROWS) }))
      .min(1)
      .max(10)
      .optional()
      .describe("xlsx 시트들. 첫 줄이 columns"),
  }),
  execute: async ({ title, format, markdown, sheets }, ctx) => {
    let body: Buffer;
    let contentType: string;
    if (format === "docx") {
      if (!markdown?.trim()) throw new Error("docx 는 markdown 본문이 필요해요");
      body = await buildDocx(title, markdown);
      contentType = DOCX_TYPE;
    } else {
      if (!sheets?.length) throw new Error("xlsx 는 sheets 가 필요해요");
      body = await buildXlsx(sheets);
      contentType = XLSX_TYPE;
    }
    const fileName = exportFileName(title, format);
    const exportId = randomUUID();
    // 키의 모양은 GET /ai/exports/:id 가 그대로 되짚는다 — 요청자의 스키마 · 사용자 id 로만 만들어서 남의 파일에 닿지 않는다
    await putObject(exportKey(ctx.principal.schemaName, ctx.principal.userId, exportId, fileName), body, contentType);
    // 링크를 돌려주지 않는다 — 모델이 긴 서명 URL 을 옮겨 적다 깨뜨린다. 화면이 exportId 로 내려받기 버튼을 그린다
    return { exportId, fileName, bytes: body.length, note: "파일이 만들어졌다. 답에는 파일 이름만 말한다 — 내려받기 버튼은 화면이 붙인다. URL 을 적지 않는다" };
  },
});

export function exportKey(schemaName: string, userId: string, exportId: string, fileName: string): string {
  return `${schemaName}/ai-exports/${userId}/${exportId}/${fileName}`;
}

export function exportContentType(fileName: string): string {
  return fileName.endsWith(".xlsx") ? XLSX_TYPE : DOCX_TYPE;
}
