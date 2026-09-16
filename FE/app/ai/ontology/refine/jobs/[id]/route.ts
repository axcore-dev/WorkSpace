/**
 * 「AI 로 다듬기」 작업 한 건 — `GET /ai/ontology/refine/jobs/:id` 결과(items)까지(검토 패널이 끝난 작업을 열 때 한 번).
 * `DELETE` 검토를 끝냈거나 버렸다 — 도는 작업은 지우지 않고 204 만 준다: 화면은 다음 폴링에서 아직 도는 것을 보고 그대로 그린다.
 */
import { handle, HttpError, requireUuid } from "@/lib/ai/server/http";
import { deleteJob, getJob, requireInternalAdmin } from "@/lib/ai/server/refine-jobs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  return handle(async () => {
    await requireInternalAdmin(req);
    const job = await getJob(requireUuid((await ctx.params).id, "그 작업이 없어요"));
    if (!job) throw new HttpError(404, "NOT_FOUND", "그 작업이 없어요");
    return Response.json(job);
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  return handle(async () => {
    await requireInternalAdmin(req);
    await deleteJob(requireUuid((await ctx.params).id, "그 작업이 없어요"));
    return new Response(null, { status: 204 });
  });
}
