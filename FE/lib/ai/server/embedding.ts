/**
 * 임베딩. AI SDK 의 `embedMany` 로 OpenAI text-embedding-3 계열을 부른다.
 *
 * 차원을 1536 으로 고정해 부른다(`dimensions` 옵션). 테넌트 스키마의 `vector(1536)` 컬럼과 맞아야
 * 하고, 모델을 large 로 바꿔도 같은 차원으로 나오게 하려는 것이다.
 *
 * 키가 없으면 `null` 을 돌려준다. 그때 색인은 임베딩 없이 저장되고 검색은 전문 검색(tsv)으로
 * 내려간다 — 로컬 개발에서 키 없이도 업로드·검색 흐름을 볼 수 있어야 한다.
 */
import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import { embed, embedMany, type EmbeddingModel } from "ai";
import { EMBEDDING_DIMENSIONS, embeddingModelId, openaiApiKey } from "./env";

let model: EmbeddingModel | null | undefined;

function embeddingModel(): EmbeddingModel | null {
  if (model === undefined) {
    const apiKey = openaiApiKey();
    model = apiKey
      ? createOpenAI({ apiKey }).textEmbeddingModel(embeddingModelId())
      : null;
    if (!model) console.warn("[ai-embed] OPENAI_API_KEY 가 없어 임베딩 없이 전문 검색만 씁니다");
  }
  return model;
}

const providerOptions = { openai: { dimensions: EMBEDDING_DIMENSIONS } };

/** 조각 여러 개. 모델의 호출당 한도에 맞춰 SDK 가 나눠 보낸다 */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const m = embeddingModel();
  if (!m || texts.length === 0) return null;
  const { embeddings } = await embedMany({
    model: m,
    values: texts,
    maxParallelCalls: 2,
    providerOptions,
  });
  return embeddings;
}

export async function embedQuery(text: string): Promise<number[] | null> {
  const m = embeddingModel();
  if (!m) return null;
  const { embedding } = await embed({ model: m, value: text, providerOptions });
  return embedding;
}

/** pgvector 리터럴. `$1::public.vector` 로 바인딩한다 */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}
