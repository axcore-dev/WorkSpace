/**
 * `POST /ai/eval` — 검색 품질 측정. 질문 목록을 받아 실제로 검색해 보고 재현율·MRR·거절 정확도를 돌려준다.
 *
 * **개발 도구다.** `AI_EVAL=1` 일 때만 열린다. 검색만 돌리고 모델은 부르지 않는다(검색어 재작성도 하지 않는다 —
 * 같은 질문에 늘 같은 결과가 나와야 비교가 된다).
 *
 * 남의 자료를 볼 수 없다. 로그인 토큰으로 판정한 본인 문서·본인 권한 분야 안에서만 검색한다 — 일반 대화와 같은 경로다.
 *
 * 쓰는 법:
 *   AI_EVAL=1 npm run dev
 *   curl -s -X POST http://localhost:8000/ai/eval -H "authorization: Bearer <액세스 토큰>" \
 *        -H 'content-type: application/json' --data @lib/ai/eval/questions.json
 *
 * `questions.json` 의 형태와 채우는 법은 그 파일에 적혀 있다. 검색을 고치기 전에 한 번 찍어 두고, 고친 뒤 다시 찍어
 * 비교한다.
 */
import { z } from "zod";
import { authenticate } from "@/lib/ai/server/auth";
import { handle, HttpError } from "@/lib/ai/server/http";
import { retrieve } from "@/lib/ai/server/retrieval";
import { formatSummary, recallAt, refusedCorrectly, summarize, type CaseResult } from "@/lib/ai/eval/metrics";

/** 상위 몇 개까지 보고 셀지 — 대화에서 모델에 넣는 조각 수와 같게 둔다 */
const K = 8;

const caseSchema = z.object({
  q: z.string().min(1).max(1_000),
  docs: z.array(z.string().max(200)).max(20).default([]),
});
const bodySchema = z.array(caseSchema).min(1).max(200);

export async function POST(req: Request) {
  return handle(async () => {
    if (process.env.AI_EVAL !== "1") {
      throw new HttpError(404, "NOT_FOUND", "없는 주소예요");
    }
    const principal = await authenticate(req);

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_FAILED", "질문 목록의 형태가 올바르지 않아요");
    }
    const results: CaseResult[] = [];
    for (const c of parsed.data) {
      // 한 번에 하나씩 — 임베딩 호출이 몰리지 않게 하고, 순서가 그대로 보고서 순서가 된다
      const r = await retrieve(principal, [], c.q);
      results.push({
        q: c.q,
        expected: c.docs,
        retrieved: [...new Set(r.hits.map((h) => h.doc_name))],
      });
    }

    const summary = summarize(results, K);
    return Response.json({
      k: K,
      summary,
      line: formatSummary(summary, K),
      cases: results.map((r) => ({
        q: r.q,
        expected: r.expected,
        retrieved: r.retrieved,
        // 근거가 있어야 하는 질문은 재현율, 없어야 하는 질문은 거절 — 판정 규칙은 metrics 에만 적는다
        ok: (recallAt(r, K) ?? (refusedCorrectly(r) ? 1 : 0)) === 1,
      })),
    });
  });
}
