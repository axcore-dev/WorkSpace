/**
 * 회사 스킬 한 건 — `PUT /ai/skills/co-<id>` 고치기 · `DELETE` 지우기. 관리자만. 기본 스킬(`co-` 가 아닌 id)은 코드에 있어
 * 여기로 올 수 없다 — 모양이 아니면 404 다.
 */
import { authenticate } from "@/lib/ai/server/auth";
import { withTenant } from "@/lib/ai/server/db";
import { handle, HttpError } from "@/lib/ai/server/http";
import { deleteSkill, duplicateName, isDuplicateName, parseSkillBody, requireAdmin, rowId, updateSkill } from "@/lib/ai/server/skills";

type Ctx = { params: Promise<{ id: string }> };

const notFound = () => new HttpError(404, "NOT_FOUND", "그 스킬이 없어요");

async function skillRowId(ctx: Ctx): Promise<number> {
  const { id } = await ctx.params;
  const n = rowId(id);
  if (n === null) throw notFound();
  return n;
}

export async function PUT(req: Request, ctx: Ctx) {
  return handle(async () => {
    const principal = await authenticate(req);
    requireAdmin(principal);
    const id = await skillRowId(ctx);
    const input = await parseSkillBody(req);
    const updated = await withTenant(principal.schemaName, (db) => updateSkill(db, id, input)).catch((e) => {
      throw isDuplicateName(e) ? duplicateName() : e;
    });
    if (!updated) throw notFound();
    return Response.json(updated);
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  return handle(async () => {
    const principal = await authenticate(req);
    requireAdmin(principal);
    const id = await skillRowId(ctx);
    const removed = await withTenant(principal.schemaName, (db) => deleteSkill(db, id));
    if (!removed) throw notFound();
    return new Response(null, { status: 204 });
  });
}
