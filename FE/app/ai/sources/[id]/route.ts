/**
 * 소스 문서 하나 — `GET /ai/sources/:id` 열기 링크 · `DELETE /ai/sources/:id` 삭제.
 *
 * GET 은 파일을 프록시하지 않고 Object Storage 의 presigned URL(10분)을 돌려준다. 객체는 전부 비공개라
 * 이 링크 없이는 열 수 없고, 링크는 인증을 통과한 본인 문서에만 발급된다.
 */
import { authenticate } from "@/lib/ai/server/auth";
import { withTenant } from "@/lib/ai/server/db";
import { handle, HttpError } from "@/lib/ai/server/http";
import { deleteDoc, findDoc } from "@/lib/ai/server/sources";
import { deleteObject, presignViewUrl } from "@/lib/ai/server/storage";

type Ctx = { params: Promise<{ id: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function docId(ctx: Ctx): Promise<string> {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) throw new HttpError(404, "NOT_FOUND", "문서를 찾을 수 없어요");
  return id;
}

export async function GET(req: Request, ctx: Ctx) {
  return handle(async () => {
    const principal = await authenticate(req);
    const id = await docId(ctx);
    const doc = await withTenant(principal.schemaName, (db) => findDoc(db, principal.userId, id));
    if (!doc) throw new HttpError(404, "NOT_FOUND", "문서를 찾을 수 없어요");
    const url = await presignViewUrl(doc.storage_key, doc.name);
    return Response.json({ url, status: doc.status, error: doc.error });
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  return handle(async () => {
    const principal = await authenticate(req);
    const id = await docId(ctx);
    const doc = await withTenant(principal.schemaName, async (db) => {
      const found = await findDoc(db, principal.userId, id);
      if (found) await deleteDoc(db, principal.userId, id);
      return found;
    });
    // 이미 없어도 204 — 화면은 목록에서 지우는 게 목적이고, 두 번 눌러도 실패로 보이면 안 된다
    if (doc) {
      await deleteObject(doc.storage_key).catch((e) =>
        console.error("[ai-sources] 객체 삭제 실패, 행은 지워졌어요", e),
      );
    }
    return new Response(null, { status: 204 });
  });
}
