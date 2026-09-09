/**
 * 대화 하나 — `GET` 메시지 포함 조회 · `PATCH` 제목·선택 소스 · `DELETE` 삭제.
 */
import { z } from "zod";
import { authenticate } from "@/lib/ai/server/auth";
import {
  deleteConversation,
  findConversation,
  listMessages,
  toChatMessageRow,
  toSummary,
  updateConversation,
} from "@/lib/ai/server/conversations";
import { withTenant } from "@/lib/ai/server/db";
import { handle, HttpError, requireUuid } from "@/lib/ai/server/http";

type Ctx = { params: Promise<{ id: string }> };

export async function conversationId(ctx: Ctx): Promise<string> {
  const { id } = await ctx.params;
  return requireUuid(id, "대화를 찾을 수 없어요");
}

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    selectedSources: z.array(z.string().max(200)).max(50).optional(),
  })
  .refine((v) => v.title !== undefined || v.selectedSources !== undefined, {
    message: "바꿀 값이 없어요",
  });

export async function GET(req: Request, ctx: Ctx) {
  return handle(async () => {
    const principal = await authenticate(req);
    const id = await conversationId(ctx);
    const result = await withTenant(principal.schemaName, async (db) => {
      const conv = await findConversation(db, principal.userId, id);
      if (!conv) return null;
      const messages = await listMessages(db, id);
      return { conversation: toSummary(conv), messages: messages.map(toChatMessageRow) };
    });
    if (!result) throw new HttpError(404, "NOT_FOUND", "대화를 찾을 수 없어요");
    return Response.json(result);
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const principal = await authenticate(req);
    const id = await conversationId(ctx);
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "VALIDATION_FAILED", "요청 형태가 올바르지 않아요");
    const row = await withTenant(principal.schemaName, (db) =>
      updateConversation(db, principal.userId, id, parsed.data),
    );
    if (!row) throw new HttpError(404, "NOT_FOUND", "대화를 찾을 수 없어요");
    return Response.json(toSummary(row));
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  return handle(async () => {
    const principal = await authenticate(req);
    const id = await conversationId(ctx);
    // 이미 없어도 204 — 두 번 눌러도 실패로 보이면 안 된다
    await withTenant(principal.schemaName, (db) => deleteConversation(db, principal.userId, id));
    return new Response(null, { status: 204 });
  });
}
