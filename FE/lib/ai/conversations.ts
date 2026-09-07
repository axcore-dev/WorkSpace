/**
 * 대화 API 의 클라이언트 절반. 서버 절반은 `app/ai/conversations/*`.
 *
 * 대화는 서버(테넌트 스키마)가 원본이다. 화면은 목록을 받아 두고, 대화를 열 때 메시지를 받아온다.
 * 모든 호출에 access 토큰이 붙고 서버는 BE 판정을 거친 뒤 본인 대화만 돌려준다.
 */
import { ApiRequestError, type ApiError } from "@/lib/api";
import { ensureAccessToken } from "@/lib/session";
import type { ChatMessage } from "@/data/chat";
import { CONVERSATIONS_ENDPOINT } from "./transport";

export interface ConversationSummary {
  id: string;
  title: string;
  selectedSources: string[];
  lastMessageAt: string | null;
  createdAt: string;
}

async function call<T>(
  path: string,
  init: RequestInit & { fallback: string },
): Promise<T> {
  const token = await ensureAccessToken();
  const res = await fetch(`${CONVERSATIONS_ENDPOINT}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const parsed = (await res.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(res.status, parsed ?? { code: "UNKNOWN", message: init.fallback });
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function listConversations(): Promise<ConversationSummary[]> {
  return call("", { method: "GET", fallback: "대화 목록을 불러오지 못했어요" });
}

export function createConversation(init: {
  title?: string;
  selectedSources?: string[];
}): Promise<ConversationSummary> {
  return call("", {
    method: "POST",
    body: JSON.stringify(init),
    fallback: "새 대화를 만들지 못했어요",
  });
}

export function getConversation(
  id: string,
): Promise<{ conversation: ConversationSummary; messages: ChatMessage[] }> {
  return call(`/${encodeURIComponent(id)}`, {
    method: "GET",
    fallback: "대화를 불러오지 못했어요",
  });
}

export function updateConversation(
  id: string,
  patch: { title?: string; selectedSources?: string[] },
): Promise<ConversationSummary> {
  return call(`/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
    fallback: "대화를 수정하지 못했어요",
  });
}

export function deleteConversation(id: string): Promise<void> {
  return call(`/${encodeURIComponent(id)}`, {
    method: "DELETE",
    fallback: "대화를 삭제하지 못했어요",
  });
}

/** 답변 평가. `null` 이면 해제 */
export function rateMessage(
  id: string,
  seq: number,
  rating: "up" | "down" | null,
): Promise<void> {
  return call(`/${encodeURIComponent(id)}/messages/${seq}`, {
    method: "PATCH",
    body: JSON.stringify({ rating }),
    fallback: "평가를 저장하지 못했어요",
  });
}
