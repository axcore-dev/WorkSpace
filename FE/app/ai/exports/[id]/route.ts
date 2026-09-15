/**
 * AI 가 만든 파일 내려받기 — `GET /ai/exports/:id?name=<파일명>`.
 *
 * 인증을 통과한 요청자의 스키마 · 사용자 id 와 경로의 id · 파일명으로 객체 키를 되짚어(`exportKey`) 파일을 그대로 돌려준다.
 * 표가 따로 없다 — 키가 곧 소유 증명이라 남의 id 를 넣어도 자기 경로 아래에서만 찾는다. presigned URL 을 쓰지 않는 이유는
 * 화면이 인증 헤더를 붙여 fetch 하고 blob 으로 저장하는 편이 스토리지 종류(응답 헤더 지원 여부)와 무관하고, 링크가 만료되지
 * 않기 때문이다. 파일은 작다(보고서 · 표).
 */
import { authenticate } from "@/lib/ai/server/auth";
import { exportContentType, exportKey } from "@/lib/ai/server/export-tools";
import { handle, HttpError, requireUuid } from "@/lib/ai/server/http";
import { getObjectBuffer } from "@/lib/ai/server/storage";

type Ctx = { params: Promise<{ id: string }> };

/** 파일명은 도구가 만든 것과 같은 규칙만 통과한다 — 경로 구분자 · 제어 문자 없음, 확장자 둘 중 하나 */
const NAME = /^[^\\/\x00-\x1f]{1,64}\.(docx|xlsx)$/;

export async function GET(req: Request, ctx: Ctx) {
  return handle(async () => {
    const principal = await authenticate(req);
    const { id } = await ctx.params;
    const exportId = requireUuid(id, "파일을 찾을 수 없어요");
    const name = new URL(req.url).searchParams.get("name") ?? "";
    if (!NAME.test(name)) throw new HttpError(404, "NOT_FOUND", "파일을 찾을 수 없어요");

    let body: Buffer;
    try {
      body = await getObjectBuffer(exportKey(principal.schemaName, principal.userId, exportId, name));
    } catch {
      throw new HttpError(404, "NOT_FOUND", "파일을 찾을 수 없어요. 다시 만들어 달라고 해 주세요");
    }
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": exportContentType(name),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store",
      },
    });
  });
}
