/**
 * 문서의 업무 분야(핵심 기능 모듈) 분류.
 *
 * AI 답변 범위를 "본인이 권한을 가진 분야" 로 좁히려면 문서마다 분야가 붙어 있어야 한다. 업로드 화면에 고르는
 * 칸을 두는 대신 색인 때 모델이 첫 조각들을 보고 한 번 정한다 — 사용자는 올리기만 하면 되고, 분류가 틀리면
 * 나중에 화면에서 고칠 수 있게 할 자리다.
 *
 * 분류할 수 없거나(내용이 여러 분야에 걸침, 모델 없음) 모델이 목록 밖 값을 내면 `null` — 분야 제한 없는 문서가 된다.
 * 잘못 좁혀서 자료가 아무에게도 안 보이는 쪽보다 안전하다.
 */
import "server-only";
import { generateText } from "ai";
import { MODULES } from "@/data/modules";
import type { Chunk } from "./chunk";
import { chatModel, providerOptions } from "./models";

const SLUGS = new Set(MODULES.map((m) => m.slug));
/** 분류에 쓰는 본문 길이 — 앞부분 몇 조각이면 충분하고, 문서 전체를 보내면 비용만 든다 */
const SAMPLE_CHARS = 3_000;

export async function classifyModule(name: string, chunks: Chunk[]): Promise<string | null> {
  const model = chatModel();
  if (!model || chunks.length === 0) return null;

  let sample = "";
  for (const c of chunks) {
    if (sample.length >= SAMPLE_CHARS) break;
    sample += (sample ? "\n\n" : "") + c.content.slice(0, SAMPLE_CHARS - sample.length);
  }
  const menu = MODULES.map((m) => `${m.slug}: ${m.name}`).join(", ");

  try {
    const { text } = await generateText({
      model,
      system:
        "당신은 제조 기업의 문서를 업무 분야로 분류합니다. 아래 slug 중 하나만, 다른 글자 없이 소문자로 출력합니다. " +
        "여러 분야에 걸치거나 판단이 어려우면 general 을 출력합니다.",
      prompt: `분야 목록: ${menu}, general: 분류 불가\n\n파일명: ${name}\n\n본문 앞부분:\n${sample}\n\nslug:`,
      maxOutputTokens: 20,
      providerOptions: providerOptions("low"),
    });
    const slug = text.trim().toLowerCase().replace(/[^a-z]/g, "");
    return SLUGS.has(slug) ? slug : null;
  } catch (e) {
    console.warn(`[ai-classify] ${name} 분류 실패, 분야 제한 없이 둔다`, e);
    return null;
  }
}
