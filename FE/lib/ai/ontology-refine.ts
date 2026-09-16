/**
 * 「AI 로 다듬기」 — 클라이언트 절반. 운영 콘솔의 검토 패널이 AI 서버 `POST /ai/ontology/refine` 을 부른다.
 * 서버는 제안만 돌려주고 저장하지 않는다. 저장은 패널이 기존 `updateConcept` · `createConcept` · `deleteConcept` 으로.
 */
import { ApiRequestError, type ApiError } from "@/lib/api";
import { ensureAccessToken } from "@/lib/session";
import type { RefineRequest, RefineResult } from "./refine-types";
import { ONTOLOGY_REFINE_ENDPOINT } from "./transport";

const FAIL: ApiError = { code: "UNKNOWN", message: "제안을 받지 못했어요" };

export async function refineConcepts(req: RefineRequest): Promise<RefineResult> {
  const token = await ensureAccessToken();
  const res = await fetch(ONTOLOGY_REFINE_ENDPOINT, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const parsed = (await res.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(res.status, parsed ?? FAIL);
  }
  return (await res.json()) as RefineResult;
}
