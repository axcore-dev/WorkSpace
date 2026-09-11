/**
 * `POST /ai/sources/reindex` — 내 문서를 다시 색인한다.
 *
 * 색인 방식이 바뀌면 이미 올라간 문서는 옛 방식 그대로 남는다. 지금 이 문이 필요한 이유는 셋이다.
 *
 * - 조각 머리말(문서 이름 · 쪽)이 벡터에 실리기 시작했다 — 옛 조각에는 없다.
 * - 문서 요약이 생겼다 — 옛 문서는 요약이 비어 있다.
 * - 임베딩 모델을 바꾸면 옛 벡터는 비교 대상이 아니다(검색이 알아서 뺀다). 다시 만들어야 벡터 검색으로 돌아온다.
 *
 * 원본 파일은 스토리지에 그대로 있으므로 내려받아 추출부터 다시 한다. 한 번에 하나씩, 응답을 돌려준 뒤에 돈다 —
 * 문서 수십 개면 몇 분이 걸리고 요청을 붙들 일이 아니다. 진행은 문서의 `status` 로 본다(`indexing` → `ready`).
 *
 * 남의 문서는 건드리지 않는다. 회사에 공유된 문서라도 다시 색인하는 것은 올린 사람의 몫이다.
 */
import { after } from "next/server";
import { authenticate } from "@/lib/ai/server/auth";
import { withTenant } from "@/lib/ai/server/db";
import { handle } from "@/lib/ai/server/http";
import { indexSource } from "@/lib/ai/server/indexer";
import { listDocsForReindex, updateStatus } from "@/lib/ai/server/sources";

export async function POST(req: Request) {
  return handle(async () => {
    const principal = await authenticate(req);

    const docs = await withTenant(principal.schemaName, async (db) => {
      const rows = await listDocsForReindex(db, principal.userId);
      // 목록에 바로 「색인 중」 으로 보이게 한다 — 눌렀는데 아무 일도 안 일어나 보이지 않게
      for (const d of rows) await updateStatus(db, d.id, "indexing", {});
      return rows;
    });

    after(async () => {
      for (const d of docs) {
        // 하나씩 — 임베딩·요약 호출이 한꺼번에 몰리면 한도에 걸린다
        await indexSource(principal, d.id);
      }
      console.info(`[ai-reindex] 사용자 ${principal.userId}: 문서 ${docs.length}개 재색인 끝`);
    });

    return Response.json({ queued: docs.length });
  });
}
