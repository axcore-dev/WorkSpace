/**
 * 메시지 하나 — `PATCH` 답변 평가(up · down · null=해제).
 *
 * 평가는 나중에 답변 품질 지표로 쓴다. 사용자 메시지에는 붙지 않는다(저장소가 role 을 본다).
 */
import { z } from "zod";
import { authenticate } from "@/lib/ai/server/auth";
import { findConversation, setRating } from "@/lib/ai/server/conversations";
import { withTenant } from "@/lib/ai/server/db";
import { handle, HttpError } from "@/lib/ai/server/http";

type Ctx = { params: Promise<{ id: string; seq: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bodySchema = z.object({ rating: z.enum(["up", "down"]).nullable() });

export async function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const principal = await authenticate(req);
    const { id, seq: seqRaw } = await ctx.params;
    const seq = Number(seqRaw);
    if (!UUID_RE.test(id) || !Number.isInteger(seq) || seq < 1) {
      throw new HttpError(404, "NOT_FOUND", "메시지를 찾을 수 없어요");
    }
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "VALIDATION_FAILED", "요청 형태가 올바르지 않아요");

    const ok = await withTenant(principal.schemaName, async (db) => {
      const conv = await findConversation(db, principal.userId, id);
      if (!conv) return false;
      return setRating(db, id, seq, parsed.data.rating);
    });
    if (!ok) throw new HttpError(404, "NOT_FOUND", "메시지를 찾을 수 없어요");
    return new Response(null, { status: 204 });
  });
}
