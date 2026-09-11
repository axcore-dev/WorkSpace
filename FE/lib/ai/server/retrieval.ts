/**
 * RAG 검색 — 질문으로 조각을 찾아 모델에 넣을 문맥과 화면의 출처를 만든다.
 *
 * 순서는 넷이다. (1) 질문을 벡터로 (2) 벡터 · 전문 검색 · 부분 일치 세 갈래를 합쳐 후보를 뽑고
 * (3) 모델이 질문에 실제로 답하는 것만 추려 (4) 문턱을 넘은 것만 문맥으로 만든다.
 */
import "server-only";
import type { ChatSource } from "@/data/chat";
import type { AiPrincipal } from "./auth";
import { withTenant } from "./db";
import { embedQuery } from "./embedding";
import { embeddingModelId } from "./env";
import { rerank } from "./rerank";
import { searchChunks, type ChunkHit } from "./sources";

/** 한 턴에 모델에 넣는 조각 수. 1,000자짜리 8개면 문맥 8천 자 안팎이다 */
const TOP_K = 8;
/** 재랭킹에 넘길 후보 수. 검색이 합쳐 준 것 중 이만큼을 모델이 훑는다 */
const RERANK_POOL = 24;
/** 출처 스니펫 길이 — 드로어 한 줄 반 정도 */
const SNIPPET = 160;
/**
 * 문맥에 넣을 최소 코사인 유사도.
 *
 * 예전에는 상위 8개를 무조건 넣었다. 관련 문서가 하나도 없어도 유사도 0.1 짜리 조각 8개가 들어갔고, 프롬프트의
 * "근거가 없으면 찾지 못했다고 말하라" 갈래는 문맥이 비어 있을 때만 켜지므로 켜지지 않았다 — 지어내기가 여기서
 * 시작된다. 문턱을 넘은 조각이 하나도 없으면 문맥을 통째로 비워 그 갈래가 켜지게 한다.
 *
 * 전문 검색·부분 일치에 걸린 조각은 유사도가 낮아도 남긴다. 질의 낱말이 본문에 그대로 있다는 뜻이고, 품번·전표번호가
 * 그 경우다.
 *
 * 0.2 는 시작값이다. `lib/ai/eval` 의 평가 세트로 올리거나 내린다 — 높이면 "못 찾았어요" 가 늘고 낮추면 잡음이 는다.
 */
const MIN_SIMILARITY = 0.2;

export interface Retrieval {
  hits: ChunkHit[];
  /** 모델 프롬프트에 그대로 붙이는 문맥 블록 */
  context: string;
  /** 화면의 출처 카드. 문서당 첫 조각 하나 */
  sources: ChatSource[];
}

/** 문맥 한 덩어리 — 어느 문서 어느 쪽인지, 그 문서가 무엇인지(요약), 그리고 본문 */
function block(h: ChunkHit, i: number): string {
  const where = h.page ? `${h.doc_name} · ${h.page}쪽` : h.doc_name;
  const summary = h.doc_summary ? `\n(문서 개요: ${h.doc_summary})` : "";
  return `[문서 ${i + 1}] ${where}${summary}\n${h.content}`;
}

/**
 * @param names 선택된 문서 이름. **빈 배열이면 내가 볼 수 있는 문서 전체를 뒤진다** — 답은 항상 이 회사 자료에서만
 *   나와야 하므로, 사용자가 문서를 고르지 않았다고 자료 없이 답하게 두지 않는다.
 *   어느 쪽이든 본인 문서와 회사에 공유된 문서만, 그리고 본인이 권한을 가진 분야(`principal.modules`)만 잡힌다.
 */
export async function retrieve(
  principal: AiPrincipal,
  names: string[],
  question: string,
): Promise<Retrieval> {
  if (!question.trim()) return { hits: [], context: "", sources: [] };

  const embedding = await embedQuery(question).catch((e) => {
    // 임베딩 실패는 검색 실패가 아니다. 전문 검색·부분 일치로 내려간다
    console.warn("[ai-retrieve] 질의 임베딩 실패, 낱말 검색으로 대체", e);
    return null;
  });
  const found = await withTenant(principal.schemaName, (db) =>
    searchChunks(
      db,
      principal.userId,
      names.length ? names : null,
      principal.modules,
      { text: question, embedding, embeddingModel: embeddingModelId() },
      RERANK_POOL,
    ),
  );

  // 검색은 주제가 비슷한 것을 잘 찾는다. 질문에 실제로 답하는 것을 고르는 일은 모델이 한 번 더 본다
  const ranked = await rerank(question, found, TOP_K);

  // 문턱을 넘은 것만 남긴다. 하나도 없으면 문맥이 비고, 프롬프트의 "자료에서 찾지 못했어요" 갈래가 켜진다
  const hits = ranked.filter((h) => h.lexical || (h.similarity !== null && h.similarity >= MIN_SIMILARITY));

  const context = hits.map(block).join("\n\n");

  const seen = new Set<string>();
  const sources: ChatSource[] = [];
  for (const h of hits) {
    if (seen.has(h.doc_name)) continue;
    seen.add(h.doc_name);
    const one = h.content.replace(/\s+/g, " ").trim();
    sources.push({
      doc: h.doc_name,
      snippet: one.length > SNIPPET ? `${one.slice(0, SNIPPET)}…` : one,
    });
  }
  return { hits, context, sources };
}
