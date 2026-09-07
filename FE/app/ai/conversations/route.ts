/**
 * 대화 — `GET /ai/conversations` 내 대화 목록 · `POST /ai/conversations` 새 대화.
 *
 * 화면은 질문을 보내기 전에 여기서 대화를 먼저 만들고 그 id 로 `/ai/chat` 을 부른다. 대화 id 를 스트림
 * 안에서 돌려주는 방식보다 한 번 더 왕복하지만, 화면 상태가 "id 없는 대화" 를 다룰 일이 없어진다.
 */
import { z } from "zod";
import { authenticate } from "@/lib/ai/server/auth";
import {
  createConversation,
  listConversations,
  toSummary,
} from "@/lib/ai/server/conversations";
import { withTenant } from "@/lib/ai/server/db";
import { handle, HttpError } from "@/lib/ai/server/http";

const createSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  selectedSources: z.array(z.string().max(200)).max(50).optional(),
});

export async function GET(req: Request) {
  return handle(async () => {
    const principal = await authenticate(req);
    const rows = await withTenant(principal.schemaName, (db) =>
      listConversations(db, principal.userId),
    );
    return Response.json(rows.map(toSummary));
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const principal = await authenticate(req);
    const parsed = createSchema.safeParse((await req.json().catch(() => ({}))) ?? {});
    if (!parsed.success) throw new HttpError(400, "VALIDATION_FAILED", "요청 형태가 올바르지 않아요");
    const row = await withTenant(principal.schemaName, (db) =>
      createConversation(db, principal.userId, parsed.data),
    );
    return Response.json(toSummary(row), { status: 201 });
  });
}
