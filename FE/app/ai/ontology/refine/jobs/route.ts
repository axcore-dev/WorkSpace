/**
 * 「AI 로 다듬기」 작업 — `GET /ai/ontology/refine/jobs` 전부(사이드바 배지 · 스튜디오 폴링) · `POST` 시작.
 * 운영자만(`requireInternalAdmin`). 계약은 `lib/ai/ontology-refine.ts`.
 */
import { z } from "zod";
import { REFINE_MAX_TARGETS } from "@/lib/ai/refine-types";
import { handle, HttpError } from "@/lib/ai/server/http";
import { hasChatModel } from "@/lib/ai/server/models";
import { listJobs, requireInternalAdmin, startJob } from "@/lib/ai/server/refine-jobs";

const bodySchema = z.object({
  workspaceId: z.number().int().positive(),
  targets: z
    .array(z.object({ rowId: z.number().int().positive(), conceptId: z.string().min(1).max(50), name: z.string().min(1).max(100) }))
    .min(1, "다듬을 개념이 없어요")
    .max(REFINE_MAX_TARGETS, `한 번에 ${REFINE_MAX_TARGETS}개까지 다듬을 수 있어요`),
  structureOnly: z.boolean().default(false),
});

export async function GET(req: Request) {
  return handle(async () => {
    await requireInternalAdmin(req);
    return Response.json(await listJobs());
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { token, userId } = await requireInternalAdmin(req);
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "VALIDATION_FAILED", parsed.error.issues[0]?.message ?? "요청 형태가 올바르지 않아요");
    if (!hasChatModel()) throw new HttpError(503, "MODEL_UNAVAILABLE", "대화 모델이 설정되지 않았어요. 관리자에게 문의해 주세요");
    const { workspaceId, targets, structureOnly } = parsed.data;
    const job = await startJob(workspaceId, targets, structureOnly, token, userId);
    if (!job) throw new HttpError(409, "REFINE_RUNNING", "다른 다듬기가 아직 돌고 있어요. 끝나면 다시 눌러 주세요");
    console.info(`[ai-refine] workspace ${workspaceId} · 작업 ${job.id} · ${targets.length}개 · ${structureOnly ? "구조만" : "값 포함"}`);
    return Response.json(job, { status: 201 });
  });
}
