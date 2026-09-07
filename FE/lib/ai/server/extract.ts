/**
 * 파일에서 텍스트를 뽑는다. 형식별 파서를 이 인터페이스 하나 뒤에 둔다 — 나중에 레이아웃 분석이
 * 필요한 문서가 생겨 별도 파싱 서비스(Python 등)로 옮기더라도 이 함수의 구현만 바뀐다.
 *
 * - PDF: `unpdf`(pdf.js). 쪽마다 따로 뽑아 출처에 쪽 번호를 남긴다. 텍스트가 거의 없으면 스캔본으로
 *   보고 모델에 옮겨 적기를 맡긴다.
 * - DOCX: `mammoth` 의 raw text.
 * - XLSX: `exceljs`. 시트마다 한 쪽으로 치고 행을 ` | ` 로 이어 표 구조를 남긴다.
 * - PNG/JPG: 텍스트 층이 없으니 모델(비전)로 옮겨 적는다. 키가 없으면 색인할 수 없어 실패로 남긴다.
 */
import "server-only";
import { generateText } from "ai";
import { extractText as pdfExtract } from "unpdf";
import mammoth from "mammoth";
import ExcelJS from "exceljs";
import type { ExtractedPage } from "./chunk";
import { contentTypeOf } from "./files";
import { chatModel, providerOptions } from "./models";

export class ExtractError extends Error {}

/** 이 글자 수 미만이면 텍스트 층이 없는(스캔) PDF 로 본다 */
const SCANNED_THRESHOLD = 40;

async function fromPdf(buf: Buffer): Promise<ExtractedPage[]> {
  const { text } = await pdfExtract(new Uint8Array(buf), { mergePages: false });
  const pages = text.map((t, i) => ({ page: i + 1, text: t }));
  const total = pages.reduce((n, p) => n + p.text.trim().length, 0);
  if (total >= SCANNED_THRESHOLD) return pages;
  return transcribe(buf, "application/pdf");
}

async function fromDocx(buf: Buffer): Promise<ExtractedPage[]> {
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return [{ text: value }];
}

async function fromXlsx(buf: Buffer): Promise<ExtractedPage[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const pages: ExtractedPage[] = [];
  wb.eachSheet((sheet, id) => {
    const lines: string[] = [`[시트] ${sheet.name}`];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells = (row.values as unknown[])
        .slice(1) // exceljs 는 1-based 라 0 번째가 비어 있다
        .map((v) => cellText(v));
      if (cells.some((c) => c !== "")) lines.push(cells.join(" | "));
    });
    pages.push({ page: id, text: lines.join("\n") });
  });
  return pages;
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { text?: unknown; result?: unknown; richText?: { text: string }[] };
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join("");
    if (o.result !== undefined) return cellText(o.result);
    if (o.text !== undefined) return String(o.text);
    return "";
  }
  return String(v).trim();
}

/**
 * 스캔 PDF·이미지를 모델이 옮겨 적는다. 텍스트 추출이 아니라 모델 호출이라 비용이 들고 느리지만,
 * 한국어 발주서·검사성적서 스캔본에서 로컬 OCR 보다 정확하다.
 */
async function transcribe(buf: Buffer, mediaType: string): Promise<ExtractedPage[]> {
  const model = chatModel();
  if (!model) {
    throw new ExtractError(
      "텍스트 층이 없는 문서예요. 스캔·이미지 문서를 읽으려면 대화 모델 API 키가 필요해요",
    );
  }
  const { text } = await generateText({
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "file", data: buf, mediaType },
          {
            type: "text",
            text:
              "이 문서의 모든 텍스트를 원문 그대로 옮겨 적어 주세요. 표는 행마다 한 줄로, 칸은 ' | ' 로 구분해 주세요. " +
              "쪽이 여러 개면 각 쪽 앞에 '[쪽 n]' 을 적어 주세요. 해석이나 요약은 넣지 말고 텍스트만 출력해 주세요.",
          },
        ],
      },
    ],
    providerOptions: providerOptions("low"),
  });
  // '[쪽 n]' 표식으로 쪽을 나눈다. 표식이 없으면 한 쪽이다
  const parts = text.split(/\n?\[쪽 (\d+)\]\n?/);
  if (parts.length < 3) return [{ text }];
  const pages: ExtractedPage[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    pages.push({ page: Number(parts[i]), text: parts[i + 1] ?? "" });
  }
  return pages;
}

export async function extractPages(buf: Buffer, type: string): Promise<ExtractedPage[]> {
  switch (type) {
    case "pdf":
      return fromPdf(buf);
    case "docx":
      return fromDocx(buf);
    case "xlsx":
      return fromXlsx(buf);
    case "png":
    case "jpg":
    case "jpeg":
      return transcribe(buf, contentTypeOf(type));
    default:
      throw new ExtractError(`지원하지 않는 형식이에요: ${type}`);
  }
}
