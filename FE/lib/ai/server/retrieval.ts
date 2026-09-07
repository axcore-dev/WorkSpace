/**
 * RAG 검색 — 질문으로 선택 문서 안의 조각을 찾아 모델에 넣을 문맥과 화면의 출처를 만든다.
 */
import "server-only";
import type { ChatSource } from "@/data/chat";
import type { AiPrincipal } from "./auth";
import { withTenant } from "./db";
import { embedQuery } from "./embedding";
import { searchChunks, type ChunkHit } from "./sources";

/** 한 턴에 모델에 넣는 조각 수. 1,000자짜리 8개면 문맥 8천 자 안팎이다 */
const TOP_K = 8;
/** 출처 스니펫 길이 — 드로어 한 줄 반 정도 */
const SNIPPET = 160;

export interface Retrieval {
  hits: ChunkHit[];
  /** 모델 프롬프트에 그대로 붙이는 문맥 블록 */
  context: string;
  /** 화면의 출처 카드. 문서당 첫 조각 하나 */
  sources: ChatSource[];
}

/**
 * @param names 선택된 문서 이름. **빈 배열이면 본인 문서 전체를 뒤진다** — 답은 항상 이 회사 자료에서만
 *   나와야 하므로, 사용자가 문서를 고르지 않았다고 자료 없이 답하게 두지 않는다.
 *   어느 쪽이든 본인이 권한을 가진 분야(`principal.modules`)의 문서만 잡힌다.
 */
export async function retrieve(
  principal: AiPrincipal,
  names: string[],
  question: string,
): Promise<Retrieval> {
  if (!question.trim()) return { hits: [], context: "", sources: [] };

  const embedding = await embedQuery(question).catch((e) => {
    // 임베딩 실패는 검색 실패가 아니다. 전문 검색으로 내려간다
    console.warn("[ai-retrieve] 질의 임베딩 실패, 전문 검색으로 대체", e);
    return null;
  });
  const hits = await withTenant(principal.schemaName, (db) =>
    searchChunks(
      db,
      principal.userId,
      names.length ? names : null,
      principal.modules,
      { text: question, embedding },
      TOP_K,
    ),
  );

  const context = hits
    .map((h, i) => {
      const where = h.page ? `${h.doc_name} · ${h.page}쪽` : h.doc_name;
      return `[문서 ${i + 1}] ${where}\n${h.content}`;
    })
    .join("\n\n");

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
