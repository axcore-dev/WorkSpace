/**
 * 「AI 로 다듬기」 — `POST /ai/ontology/refine`.
 *
 * 몸: `{ workspaceId, conceptRowIds, structureOnly }`. 호출자의 토큰으로 BE 의 운영 콘솔 API 를 부르므로 관리자가 아니면 BE 가 403 을
 * 주고 그 개념은 실패로 돌아온다 — 관리자 판정을 여기서 따로 하지 않는다(두 곳으로 갈리지 않게). 결과는 제안일 뿐 저장하지 않는다.
 *
 * 채팅의 `authenticate` 를 쓰지 않는다 — 그건 회사 소속(introspect)을 요구하는데, 운영 콘솔의 내부 관리자는 어느 회사에도 속하지
 * 않아 「회사를 먼저 선택해 주세요」 로 막힌다. 여기서는 토큰이 있는지만 보고, 누구인지는 BE 운영 API 가 판정한다.
 */
import { z } from "zod";
import { handle, HttpError } from "@/lib/ai/server/http";
import { hasChatModel } from "@/lib/ai/server/models";
import { refineMany } from "@/lib/ai/server/ontology-refine";
import type { RefineResult } from "@/lib/ai/refine-types";

const bodySchema = z.object({
  workspaceId: z.number().int().positive(),
  conceptRowIds: z.array(z.number().int().positive()).min(1).max(30),
  structureOnly: z.boolean().default(false),
});

export async function POST(req: Request) {
  return handle(async () => {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) throw new HttpError(401, "UNAUTHORIZED", "인증이 필요합니다");
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "VALIDATION_FAILED", "요청 형태가 올바르지 않아요");
    if (!hasChatModel()) throw new HttpError(503, "MODEL_UNAVAILABLE", "대화 모델이 설정되지 않았어요. 관리자에게 문의해 주세요");

    const { workspaceId, conceptRowIds, structureOnly } = parsed.data;
    console.info(`[ai-refine] workspace ${workspaceId} · ${conceptRowIds.length}개 · ${structureOnly ? "구조만" : "값 포함"}`);
    const items = await refineMany(workspaceId, conceptRowIds, structureOnly, token);
    // 전부 같은 이유로 실패했으면(관리자 아님 · BE 다운) 항목 오류 대신 한 번에 알린다
    const errors = items.filter((i) => !i.ok);
    if (errors.length === items.length && errors.length > 0) {
      const first = errors[0];
      throw new HttpError(502, "REFINE_FAILED", first.ok ? "제안을 받지 못했어요" : first.error);
    }
    const result: RefineResult = { items };
    return Response.json(result);
  });
}
