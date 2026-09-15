/**
 * AI 가 만든 파일 내려받기 — 클라이언트 절반. 인증 헤더를 붙여 `GET /ai/exports/:id?name=` 을 받고 blob 으로 저장한다.
 *
 * 링크를 그대로 여는 대신 fetch 하는 이유: `/ai/*` 는 Bearer 토큰이 있어야 하고, 브라우저 링크에는 헤더를 못 붙인다.
 */
import { ApiRequestError, type ApiError } from "@/lib/api";
import { ensureAccessToken } from "@/lib/session";
import { EXPORTS_ENDPOINT } from "./transport";

const FAIL: ApiError = { code: "UNKNOWN", message: "파일을 내려받지 못했어요" };

export async function downloadExport(exportId: string, fileName: string): Promise<void> {
  const token = await ensureAccessToken();
  const res = await fetch(`${EXPORTS_ENDPOINT}/${encodeURIComponent(exportId)}?name=${encodeURIComponent(fileName)}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const parsed = (await res.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(res.status, parsed ?? FAIL);
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 클릭이 처리된 뒤에 놓는다 — 바로 놓으면 일부 브라우저가 저장을 시작하지 못한다
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
