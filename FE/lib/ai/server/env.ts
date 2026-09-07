/**
 * AI 서버(Next Route Handler)가 읽는 환경 변수.
 *
 * **전부 서버 전용이다.** `NEXT_PUBLIC_` 접두어가 없고, 이 파일을 클라이언트 컴포넌트에서 import 하면
 * 안 된다(`server-only` 로 막아 둔다). 값은 INFRA/.env → docker-compose.yml 의 frontend.environment 로
 * 들어오고, 로컬 개발은 FE/.env.local 에 둔다. 값의 목록과 뜻은 docs/ai/ai-server.md 참고.
 *
 * 빌드 시점에 읽지 않는다. `next build` 는 이 값들 없이도 끝나야 하므로 모든 접근을 함수로 늦춘다.
 */
import "server-only";

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    // 어느 변수가 빠졌는지 로그에 남되, 값은 어떤 경우에도 찍지 않는다.
    throw new Error(`환경 변수 ${name} 이(가) 설정되지 않았어요`);
  }
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

/** BE(Spring) 내부 주소와 서비스 간 인증 토큰 — `POST /api/auth/introspect` 에 쓴다 */
export function beConfig() {
  return {
    baseUrl: optional("AI_BE_BASE_URL", "http://localhost:8080").replace(/\/$/, ""),
    internalToken: required("AUTH_INTERNAL_TOKEN"),
  };
}

/**
 * 네이버 클라우드 Object Storage. S3 호환 API 라 AWS SDK 로 붙는다.
 * 엔드포인트·리전은 네이버가 고정해 둔 값이 기본이다.
 */
export function storageConfig() {
  return {
    endpoint: optional("NCP_OBJECT_STORAGE_ENDPOINT", "https://kr.object.ncloudstorage.com"),
    region: optional("NCP_OBJECT_STORAGE_REGION", "kr-standard"),
    bucket: required("NCP_OBJECT_STORAGE_BUCKET"),
    accessKeyId: required("NCP_ACCESS_KEY"),
    secretAccessKey: required("NCP_SECRET_KEY"),
  };
}

export function anthropicApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || undefined;
}

export function openaiApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY || undefined;
}

export type ChatProvider = "openai" | "anthropic";

/**
 * 대화 모델 프로바이더. `AI_CHAT_PROVIDER` 가 비어 있으면 키가 있는 쪽, 둘 다 있으면 anthropic.
 * 키가 하나도 없으면 undefined — 대본(mock) 응답으로 내려간다(`app/ai/chat/route.ts`).
 */
export function chatProvider(): ChatProvider | undefined {
  const v = process.env.AI_CHAT_PROVIDER?.trim().toLowerCase();
  if (v === "openai" || v === "anthropic") {
    const key = v === "openai" ? openaiApiKey() : anthropicApiKey();
    if (!key) console.warn(`[ai-env] AI_CHAT_PROVIDER=${v} 인데 그 프로바이더의 API 키가 없어요`);
    return key ? v : undefined;
  }
  if (anthropicApiKey()) return "anthropic";
  if (openaiApiKey()) return "openai";
  return undefined;
}

const DEFAULT_CHAT_MODEL: Record<ChatProvider, string> = {
  anthropic: "claude-opus-5",
  openai: "gpt-5.6-luna",
};

/** 대화·옮겨 적기 모델 id. `AI_CHAT_MODEL` 이 비어 있으면 프로바이더 기본값 */
export function chatModelId(provider: ChatProvider): string {
  return optional("AI_CHAT_MODEL", DEFAULT_CHAT_MODEL[provider]);
}

/** 임베딩 모델(OpenAI). 키가 없으면 임베딩 없이 저장하고 전문 검색(tsv)으로만 찾는다 */

export function embeddingModelId(): string {
  return optional("AI_EMBEDDING_MODEL", "text-embedding-3-small");
}

/** 테넌트 V3 마이그레이션의 `vector(1536)` 과 같아야 한다. 바꾸려면 컬럼을 다시 만든다 */
export const EMBEDDING_DIMENSIONS = 1536;
