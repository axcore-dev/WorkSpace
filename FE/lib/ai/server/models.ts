/**
 * 대화·옮겨 적기에 쓰는 언어 모델 선택. **모델을 만드는 곳은 여기 하나다.**
 *
 * 프로바이더는 `AI_CHAT_PROVIDER`(openai | anthropic) 로 고른다. 비어 있으면 키가 있는 쪽을 쓰고, 둘 다
 * 있으면 anthropic 이다. 키가 하나도 없으면 `null` — 그때 대화 라우트는 503 으로 거절한다.
 *
 * 프로바이더별 옵션(추론 강도)은 이름이 달라 `providerOptions()` 로 함께 묶는다. 호출부가 프로바이더를
 * 분기하지 않게 하려는 것이다.
 */
import "server-only";
import { createAnthropic, type AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { createOpenAI, type OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import type { LanguageModel, streamText } from "ai";
import { anthropicApiKey, chatModelId, chatProvider, openaiApiKey } from "./env";

export type Effort = "low" | "medium";

/** `ai` 가 이 타입을 직접 내보내지 않아 호출 옵션에서 꺼낸다 */
type ProviderOptions = NonNullable<Parameters<typeof streamText>[0]["providerOptions"]>;

let cached: { model: LanguageModel; provider: "openai" | "anthropic"; id: string } | null | undefined;

function build() {
  const provider = chatProvider();
  if (!provider) return null;
  const id = chatModelId(provider);
  if (provider === "anthropic") {
    return { model: createAnthropic({ apiKey: anthropicApiKey() })(id), provider, id };
  }
  return { model: createOpenAI({ apiKey: openaiApiKey() })(id), provider, id };
}

/** 설정된 대화 모델. 없으면 null */
export function chatModel(): LanguageModel | null {
  if (cached === undefined) {
    cached = build();
    if (cached) console.info(`[ai-model] ${cached.provider} / ${cached.id}`);
    else console.warn("[ai-model] 대화 모델 키가 없습니다. 대화 요청은 503 으로 거절됩니다");
  }
  return cached?.model ?? null;
}

export function hasChatModel(): boolean {
  return chatModel() !== null;
}

/** 추론 강도를 프로바이더가 아는 이름으로. 검색 문맥이 있는 짧은 답에는 medium, 옮겨 적기에는 low. 키 이름은 프로바이더 타입이 검사한다 */
export function providerOptions(effort: Effort): ProviderOptions {
  if (cached?.provider === "anthropic") return { anthropic: { effort } satisfies AnthropicProviderOptions };
  return { openai: { reasoningEffort: effort } satisfies OpenAIResponsesProviderOptions };
}
