/**
 * 추출한 텍스트를 검색 조각으로 자른다.
 *
 * 조각 크기 1,000자 안팎·겹침 150자. 임베딩 모델의 입력 한도(8k 토큰)에 넉넉히 들어가고, 답변에
 * 근거로 붙일 때 한 조각이 화면 한 단락 정도로 읽힌다. 문단 경계를 우선 지키고, 문단 하나가 너무
 * 길면 문장 경계에서 다시 자른다. 토큰 단위로 재지 않는 이유는 한국어에서 문자 수와 토큰 수의 비율이
 * 안정적이어서 문자 수로 충분하고, 토크나이저 의존성을 하나 덜 수 있기 때문이다.
 */
import "server-only";

export interface ExtractedPage {
  /** PDF 쪽 번호 · XLSX 시트 순번(1부터). 없는 형식은 undefined */
  page?: number;
  text: string;
}

export interface Chunk {
  idx: number;
  page?: number;
  content: string;
}

const TARGET = 1000;
const MAX = 1400;
const OVERLAP = 150;

/** 문단 하나가 MAX 를 넘으면 문장 단위로 다시 나눈다 */
function splitLong(paragraph: string): string[] {
  if (paragraph.length <= MAX) return [paragraph];
  const sentences = paragraph.split(/(?<=[.!?。]|다\.|요\.)\s+/);
  const out: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if (buf && buf.length + s.length + 1 > MAX) {
      out.push(buf);
      buf = s;
    } else {
      buf = buf ? `${buf} ${s}` : s;
    }
  }
  if (buf) out.push(buf);
  // 문장 하나가 MAX 를 넘는 극단(공백 없는 표 덤프 등)은 그냥 길이로 자른다
  return out.flatMap((s) =>
    s.length <= MAX ? [s] : Array.from({ length: Math.ceil(s.length / MAX) }, (_, i) =>
      s.slice(i * MAX, (i + 1) * MAX),
    ),
  );
}

function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chunkPages(pages: ExtractedPage[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const p of pages) {
    const text = normalize(p.text);
    if (!text) continue;
    const paragraphs = text.split(/\n\s*\n/).flatMap(splitLong);

    let buf = "";
    const flush = () => {
      const content = buf.trim();
      if (content.length >= 20) chunks.push({ idx: chunks.length, page: p.page, content });
      // 겹침 — 직전 조각의 꼬리를 다음 조각 머리에 남겨 경계에 걸린 문맥이 끊기지 않게 한다
      buf = content.length > OVERLAP ? content.slice(-OVERLAP) : "";
    };

    for (const para of paragraphs) {
      if (buf && buf.length + para.length + 2 > TARGET) flush();
      buf = buf ? `${buf}\n\n${para}` : para;
      if (buf.length >= MAX) flush();
    }
    if (buf.trim().length >= 20 && (chunks.length === 0 || !chunks[chunks.length - 1].content.endsWith(buf.trim()))) {
      const content = buf.trim();
      chunks.push({ idx: chunks.length, page: p.page, content });
    }
  }
  return chunks;
}
