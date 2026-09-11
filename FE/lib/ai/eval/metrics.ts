/**
 * RAG 검색 품질 지표 — 순수 계산만. DB 도 모델도 부르지 않는다.
 *
 * 검색을 고칠 때마다 좋아졌는지 나빠졌는지를 숫자로 남기기 위한 것이다. 지표가 없으면 모든 변경이 느낌으로 남고,
 * 어떤 변경이 오히려 나쁘게 만들었는지도 모른다.
 *
 * 세 가지를 본다.
 *
 * - <b>재현율@k</b> — 정답 문서가 상위 k 개 안에 들어왔는가. 근거를 가져오기는 했는지를 본다.
 * - <b>MRR</b> — 정답이 몇 번째로 나왔는가. 1등으로 나오는 것과 8등으로 나오는 것은 답변 품질이 다르다.
 * - <b>거절 정확도</b> — 근거가 없어야 맞는 질문(`docs: []`)에 아무것도 안 가져왔는가. 지어내기를 잡는 유일한 지표다.
 *
 * 문서는 이름으로 맞춘다 — 한 사람 안에서 문서 이름이 유일하기 때문이다(`ux_ai_source_docs_owner_name`).
 * 이 파일은 `node --test` 가 그대로 돌 수 있게 `@/` 별칭과 `server-only` 를 쓰지 않는다.
 */

/** 평가 한 줄. `docs` 가 비면 "근거가 없는 게 정답" 인 질문이다 */
export interface EvalCase {
  q: string;
  docs: string[];
}

/** 한 질문을 실제로 검색해 본 결과. `retrieved` 는 순위 순서의 문서 이름(중복 제거) */
export interface CaseResult {
  q: string;
  expected: string[];
  retrieved: string[];
}

export interface Summary {
  /** 근거가 있어야 하는 질문 수 */
  positives: number;
  /** 근거가 없어야 하는 질문 수 */
  negatives: number;
  /** 정답 문서를 상위 k 안에 하나라도 가져온 비율 (0~1) */
  recall: number;
  /** 정답이 처음 나온 등수의 역수 평균 (0~1) */
  mrr: number;
  /** 근거 없는 질문에 아무것도 안 가져온 비율 (0~1). 해당 질문이 없으면 null */
  refusal: number | null;
}

/** 정답이 처음 나온 등수의 역수. 상위 k 안에 없으면 0. 근거가 없어야 하는 질문이면 null */
export function reciprocalRank(r: CaseResult, k: number): number | null {
  if (r.expected.length === 0) return null;
  const top = r.retrieved.slice(0, k);
  for (let i = 0; i < top.length; i++) {
    if (r.expected.includes(top[i])) return 1 / (i + 1);
  }
  return 0;
}

/** 정답 문서가 상위 k 안에 있으면 1. "안에 있는가" 는 등수가 있는가와 같은 말이라 여기서 파생한다 */
export function recallAt(r: CaseResult, k: number): number | null {
  const rr = reciprocalRank(r, k);
  return rr === null ? null : rr > 0 ? 1 : 0;
}

/** 근거가 없어야 하는 질문에 아무것도 안 가져왔으면 true. 근거가 있어야 하는 질문이면 null */
export function refusedCorrectly(r: CaseResult): boolean | null {
  if (r.expected.length > 0) return null;
  return r.retrieved.length === 0;
}

const avg = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

export function summarize(results: CaseResult[], k: number): Summary {
  const recalls = results.map((r) => recallAt(r, k)).filter((v): v is number => v !== null);
  const ranks = results.map((r) => reciprocalRank(r, k)).filter((v): v is number => v !== null);
  const refusals = results.map(refusedCorrectly).filter((v): v is boolean => v !== null);
  return {
    positives: recalls.length,
    negatives: refusals.length,
    recall: avg(recalls),
    mrr: avg(ranks),
    refusal: refusals.length === 0 ? null : avg(refusals.map((ok) => (ok ? 1 : 0))),
  };
}

/** 사람이 읽는 한 줄. 바꾸기 전후로 찍어 두면 그대로 비교가 된다 */
export function formatSummary(s: Summary, k: number): string {
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const refusal = s.refusal === null ? "—" : pct(s.refusal);
  return `재현율@${k} ${pct(s.recall)} · MRR ${s.mrr.toFixed(3)} · 거절 ${refusal} (근거 있음 ${s.positives}문항 · 없음 ${s.negatives}문항)`;
}
