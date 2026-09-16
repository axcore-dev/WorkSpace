/**
 * AI 서버(`app/ai/*`) 라우트를 부르는 공통 한 줄 — access 토큰을 붙이고, 오류는 BE 와 같은 `ApiRequestError` 로 던진다.
 * 스트리밍이 아닌 JSON 라우트(스킬 · 다듬기 작업)가 쓴다. 채팅 스트림은 `transport.ts`.
 */
import { ApiRequestError, type ApiError } from "@/lib/api";
import { ensureAccessToken } from "@/lib/session";

export async function aiCall<T>(url: string, init: RequestInit, fallback: string): Promise<T> {
  const token = await ensureAccessToken();
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const parsed = (await res.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(res.status, parsed ?? { code: "UNKNOWN", message: fallback });
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
