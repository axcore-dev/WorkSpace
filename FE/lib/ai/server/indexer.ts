/**
 * 색인 — 저장된 파일을 내려받아 텍스트 → 조각 → 임베딩 순으로 만들고 `ready` 로 굳힌다.
 *
 * 업로드 요청 안에서 돌리지 않는다. 20MB PDF 는 추출·임베딩에 수십 초가 걸리고, 그동안 응답을 붙들면
 * 화면은 멎어 보이고 nginx 타임아웃에도 걸린다. 업로드 라우트는 `indexing` 상태로 바로 답하고
 * `after()` 로 이 함수를 응답 뒤에 이어 돌린다. 화면은 `status` 로 진행을 안다.
 *
 * 실패는 `failed` + error 문구로 남긴다. 조용히 `ready` 가 되는 것보다 "이 문서는 못 읽었다" 가
 * 보여야 사용자가 다른 형식으로 다시 올릴 수 있다.
 */
import "server-only";
import { embedInput } from "@/lib/ai/text";
import type { AiPrincipal } from "./auth";
import { chunkPages } from "./chunk";
import { withTenant } from "./db";
import { embedTexts } from "./embedding";
import { classifyModule } from "./classify";
import { embeddingModelId } from "./env";
import { ExtractError, extractPages } from "./extract";
import { findDoc, replaceChunks, setIndexMeta, setModule, updateStatus } from "./sources";
import { getObjectBuffer } from "./storage";
import { summarizeDoc } from "./summarize";


export async function indexSource(principal: AiPrincipal, docId: string): Promise<void> {
  const doc = await withTenant(principal.schemaName, (db) =>
    findDoc(db, principal.userId, docId),
  );
  if (!doc) return;

  try {
    const buf = await getObjectBuffer(doc.storage_key);
    const pages = await extractPages(buf, doc.type.toLowerCase());
    const chunks = chunkPages(pages);
    if (chunks.length === 0) {
      throw new ExtractError("문서에서 읽을 수 있는 텍스트를 찾지 못했어요");
    }
    // 임베딩은 있으면 좋은 것이지 색인의 전제가 아니다. 모델 권한·한도·장애로 실패해도 조각은 저장해
    // 전문 검색(tsv)으로는 찾을 수 있게 한다. 실패한 문서는 나중에 재색인하면 임베딩이 채워진다.
    const embeddings = await embedTexts(chunks.map((c) => embedInput(doc.name, c))).catch((e) => {
      console.warn(`[ai-index] ${doc.name}: 임베딩 실패, 전문 검색만 가능`, e);
      return null;
    });

    // 업무 분야 — 모델이 분류한다. 실패하면 null 이고, 화면 목록의 표시에만 쓴다
    const moduleSlug = await classifyModule(doc.name, chunks);
    // 문서 요약 — 답변 문맥의 문서 머리말. 실패하면 null 이고 검색·답변은 그대로 돈다
    const summary = await summarizeDoc(doc.name, chunks);

    await withTenant(principal.schemaName, async (db) => {
      await replaceChunks(db, docId, chunks, embeddings);
      await setModule(db, docId, moduleSlug);
      // 어떤 모델로 만든 벡터인지 남긴다. 모델을 바꾸면 이 문서는 재색인 전까지 벡터 검색에서 빠진다
      await setIndexMeta(db, docId, { summary, embeddingModel: embeddings ? embeddingModelId() : null });
      await updateStatus(db, docId, "ready", { chunkCount: chunks.length });
    });
    console.info(
      `[ai-index] ${doc.name}: 조각 ${chunks.length}개${embeddings ? "" : " (임베딩 없음)"} · 분야 ${moduleSlug ?? "없음"} · 요약 ${summary ? "있음" : "없음"}`,
    );
  } catch (e) {
    // 사용자에게 보여도 되는 문구는 ExtractError 만이다. 나머지는 원인을 로그에만 남긴다
    const message =
      e instanceof ExtractError ? e.message : "문서를 처리하는 중 문제가 생겼어요";
    console.error(`[ai-index] ${doc.name} 색인 실패`, e);
    await withTenant(principal.schemaName, (db) =>
      updateStatus(db, docId, "failed", { error: message }),
    ).catch((err) => console.error("[ai-index] 실패 상태 기록도 실패", err));
  }
}
