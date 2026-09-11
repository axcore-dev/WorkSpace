/**
 * 소스 문서 API 의 클라이언트 절반. 스트리밍이 아니라 평범한 JSON/multipart 라 `useChat` 밖에 있다.
 *
 * 서버 절반은 `app/ai/sources/*`(FE 안의 AI 서버). 모든 호출에 access 토큰이 붙고, 서버는 그 토큰을
 * BE 에 판정받은 뒤에만 응답한다.
 */
import { ApiRequestError, type ApiError } from "@/lib/api";
import { ensureAccessToken } from "@/lib/session";
import type { SourceDoc } from "@/data/chat";
import { SOURCES_ENDPOINT } from "./transport";

const UNKNOWN: ApiError = { code: "UNKNOWN", message: "문서를 등록하지 못했어요" };

async function authHeaders(): Promise<Record<string, string>> {
  const token = await ensureAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function throwIfError(res: Response, fallback: ApiError): Promise<void> {
  if (res.ok) return;
  const parsed = (await res.json().catch(() => null)) as ApiError | null;
  throw new ApiRequestError(res.status, parsed ?? fallback);
}

/**
 * 소스 문서 업로드 — 등록된 메타를 돌려준다. 색인은 뒤에서 이어지므로 `status` 가 indexing 일 수 있다.
 *
 *
 * 올린 문서는 <b>올린 사람만</b> 본다. 회사 공유는 두지 않으므로 범위를 고르는 입력이 없다.
 */
export async function uploadSources(files: File[]): Promise<SourceDoc[]> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const res = await fetch(SOURCES_ENDPOINT, {
    method: "POST",
    credentials: "include",
    headers: await authHeaders(),
    body: form,
  });
  await throwIfError(res, UNKNOWN);
  const parsed = (await res.json().catch(() => null)) as unknown;
  // 200인데 배열이 아니면(프록시 HTML, `{items:[…]}` 같은 다른 형태) 화면이 터지기 전에 오류로 돌린다
  if (!Array.isArray(parsed))
    throw new ApiRequestError(res.status, {
      code: "MALFORMED",
      message: "문서를 등록하지 못했어요",
    });
  return parsed as SourceDoc[];
}

/** 내 문서 목록과 지금 색인 상태. 화면은 '색인 중' 문서가 있을 때 이걸 주기적으로 불러 상태를 갱신한다 */
export async function listSources(): Promise<SourceDoc[]> {
  const res = await fetch(SOURCES_ENDPOINT, {
    method: "GET",
    credentials: "include",
    headers: await authHeaders(),
  });
  await throwIfError(res, { code: "UNKNOWN", message: "문서 목록을 불러오지 못했어요" });
  const parsed = (await res.json().catch(() => null)) as unknown;
  return Array.isArray(parsed) ? (parsed as SourceDoc[]) : [];
}

/** 서버에 올라간 문서를 지운다. 스토리지 객체와 검색 조각이 함께 사라진다 */
export async function deleteSource(id: string): Promise<void> {
  const res = await fetch(`${SOURCES_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
    headers: await authHeaders(),
  });
  await throwIfError(res, { code: "UNKNOWN", message: "문서를 삭제하지 못했어요" });
}

/** 문서를 새 탭에서 열 한시적 링크(10분)와 지금 색인 상태 */
export async function getSourceView(
  id: string,
): Promise<{ url: string; status: SourceDoc["status"]; error: string | null }> {
  const res = await fetch(`${SOURCES_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "GET",
    credentials: "include",
    headers: await authHeaders(),
  });
  await throwIfError(res, { code: "UNKNOWN", message: "문서를 열지 못했어요" });
  return (await res.json()) as { url: string; status: SourceDoc["status"]; error: string | null };
}
