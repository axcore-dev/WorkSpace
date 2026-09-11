/**
 * 문서 요약 — 색인할 때 한 번 만들어 두고 답변 문맥의 문서 머리말로 쓴다.
 *
 * 조각 검색은 "이 규정 몇 조에 뭐라고 적혀 있어" 에는 강하지만 "이 문서 뭐야" 에는 약하다. 8개 조각은 문서의 일부일
 * 뿐이라 요약이 편향된다. 문서마다 두세 문장을 미리 만들어 두면, 조각이 어느 문서에서 왔는지를 모델이 알고 답한다.
 *
 * 실패하면 `null` 이다. 요약이 없다고 검색이나 답변이 막히지 않는다 — 있으면 좋은 것이지 전제가 아니다.
 */
import "server-only";
import { generateText } from "ai";
import { sampleText } from "@/lib/ai/text";
import type { Chunk } from "./chunk";
import { chatModel, providerOptions } from "./models";

/** 요약에 쓰는 본문 길이. 앞부분이면 무엇에 대한 문서인지 알기에 충분하고, 전체를 보내면 비용만 든다 */
const SAMPLE_CHARS = 4_000;
/** 요약 길이 상한 — 문맥 머리말 한두 줄 */
const MAX_SUMMARY = 300;

export async function summarizeDoc(name: string, chunks: Chunk[]): Promise<string | null> {
  const model = chatModel();
  if (!model || chunks.length === 0) return null;

  const sample = sampleText(chunks, SAMPLE_CHARS);

  try {
    const { text } = await generateText({
      model,
      instructions:
        "제조 기업의 사내 문서를 한 문단으로 요약합니다. 무엇에 대한 문서이고 어떤 정보가 들어 있는지를 두세 문장으로 적습니다. " +
        "본문에 없는 사실을 넣지 않고, 머리말·인사말 없이 요약문만 출력합니다.",
      prompt: `파일명: ${name}\n\n본문 앞부분:\n${sample}\n\n요약:`,
      maxOutputTokens: 300,
      providerOptions: providerOptions("low"),
    });
    const out = text.trim().replace(/\s+/g, " ").slice(0, MAX_SUMMARY).trim();
    return out || null;
  } catch (e) {
    console.warn(`[ai-summarize] ${name} 요약 실패, 요약 없이 둔다`, e);
    return null;
  }
}
