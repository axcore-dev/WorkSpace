/**
 * 소스 문서 업로드. 스트리밍이 아니라 평범한 multipart POST 라 `useChat` 밖에 있다.
 *
 * `lib/chat-api.ts` 에서 옮겨 왔다 — 그 파일은 직접 만든 SSE 파서가 본체였고, 그건 AI SDK 가
 * 대체했다. 남은 것이 이 함수 하나뿐이라 여기로 합쳤다.
 */
import { ApiRequestError, type ApiError } from "@/lib/api";
import { ensureAccessToken } from "@/lib/session";
import type { SourceDoc } from "@/data/chat";
import { SOURCES_ENDPOINT } from "./transport";

const UNKNOWN: ApiError = { code: "UNKNOWN", message: "문서를 등록하지 못했어요" };

/** 소스 문서 업로드 — 등록된 메타를 돌려준다 */
export async function uploadSources(files: File[]): Promise<SourceDoc[]> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const token = await ensureAccessToken();
  const res = await fetch(SOURCES_ENDPOINT, {
    method: "POST",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const parsed = (await res.json().catch(() => null)) as unknown;
  if (!res.ok)
    throw new ApiRequestError(
      res.status,
      (parsed as ApiError | null) ?? UNKNOWN,
    );
  // 200인데 배열이 아니면(프록시 HTML, `{items:[…]}` 같은 다른 형태) 화면이 터지기 전에 오류로 돌린다
  if (!Array.isArray(parsed))
    throw new ApiRequestError(res.status, {
      code: "MALFORMED",
      message: "문서를 등록하지 못했어요",
    });
  return parsed as SourceDoc[];
}
