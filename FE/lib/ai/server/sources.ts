/**
 * 소스 문서 저장소 — 테넌트 스키마의 `ai_source_docs` · `ai_source_chunks`.
 *
 * 모든 조회가 `owner_user_id = 요청자` 조건을 갖는다. 검색 범위가 "개인" 이라는 결정이 여기 한 곳에
 * 박혀 있어서, 팀·전사 범위를 열 때는 이 파일의 WHERE 절이 바뀌는 것이지 라우트가 바뀌는 것이 아니다.
 *
 * 쿼리는 전부 바인딩 파라미터다. 스키마는 `withTenant` 가 search_path 로 잡아 주므로 테이블 이름만 쓴다.
 */
import "server-only";
import type { SourceDoc } from "@/data/chat";
import type { Chunk } from "./chunk";
import type { Db } from "./db";
import { toVectorLiteral } from "./embedding";

export type DocStatus = "indexing" | "ready" | "failed";

export interface DocRow {
  id: string;
  owner_user_id: string;
  name: string;
  type: string;
  size_bytes: string;
  storage_key: string;
  scope: "personal" | "team" | "company";
  status: DocStatus;
  error: string | null;
  chunk_count: number;
  /** 업무 분야(핵심 기능 slug). 색인 때 모델이 분류. NULL 은 분야 제한 없음 */
  module_slug: string | null;
  created_at: Date;
  updated_at: Date;
}

const SCOPE_LABEL: Record<DocRow["scope"], SourceDoc["scope"]> = {
  personal: "개인",
  team: "팀",
  company: "전사",
};

/** "방금 전 · n분 전 · n시간 전 · M월 D일" — 화면의 `SourceDoc.updated` */
export function relativeTime(d: Date, now = Date.now()): string {
  const diff = Math.max(0, now - d.getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function toSourceDoc(r: DocRow): SourceDoc {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    scope: SCOPE_LABEL[r.scope],
    updated: relativeTime(r.updated_at),
    status: r.status,
    module: r.module_slug ?? undefined,
  };
}

/** 색인이 분류한 업무 분야를 기록한다. `null` 이면 분야 제한 없음 */
export async function setModule(db: Db, id: string, moduleSlug: string | null) {
  await db.query(`UPDATE ai_source_docs SET module_slug = $2, updated_at = now() WHERE id = $1`, [id, moduleSlug]);
}

export async function insertDoc(
  db: Db,
  doc: {
    id: string;
    ownerUserId: string;
    name: string;
    type: string;
    sizeBytes: number;
    storageKey: string;
    /** 기본은 개인. `company` 면 같은 회사 구성원이 검색할 수 있다 */
    scope?: "personal" | "company";
  },
): Promise<DocRow> {
  const { rows } = await db.query<DocRow>(
    `INSERT INTO ai_source_docs (id, owner_user_id, name, type, size_bytes, storage_key, scope)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [doc.id, doc.ownerUserId, doc.name, doc.type, doc.sizeBytes, doc.storageKey, doc.scope ?? "personal"],
  );
  return rows[0];
}

/** 색인이 만든 요약과 그 벡터를 만든 임베딩 모델을 기록한다 */
export async function setIndexMeta(
  db: Db,
  id: string,
  meta: { summary: string | null; embeddingModel: string | null },
) {
  await db.query(
    `UPDATE ai_source_docs SET summary = $2, embedding_model = $3, updated_at = now() WHERE id = $1`,
    [id, meta.summary, meta.embeddingModel],
  );
}

/** 재색인 대상 — 내가 올린 문서 전부. 실패한 것도 다시 해 본다 */
export async function listDocsForReindex(db: Db, ownerUserId: string): Promise<DocRow[]> {
  const { rows } = await db.query<DocRow>(
    `SELECT * FROM ai_source_docs WHERE owner_user_id = $1 ORDER BY created_at`,
    [ownerUserId],
  );
  return rows;
}

export async function findDoc(db: Db, ownerUserId: string, id: string): Promise<DocRow | null> {
  const { rows } = await db.query<DocRow>(
    `SELECT * FROM ai_source_docs WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, id],
  );
  return rows[0] ?? null;
}

export async function findDocByName(
  db: Db,
  ownerUserId: string,
  name: string,
): Promise<DocRow | null> {
  const { rows } = await db.query<DocRow>(
    `SELECT * FROM ai_source_docs WHERE owner_user_id = $1 AND name = $2`,
    [ownerUserId, name],
  );
  return rows[0] ?? null;
}

export async function listDocs(db: Db, ownerUserId: string): Promise<DocRow[]> {
  const { rows } = await db.query<DocRow>(
    `SELECT * FROM ai_source_docs WHERE owner_user_id = $1 ORDER BY created_at DESC`,
    [ownerUserId],
  );
  return rows;
}

export async function updateStatus(
  db: Db,
  id: string,
  status: DocStatus,
  opts: { error?: string | null; chunkCount?: number } = {},
) {
  await db.query(
    `UPDATE ai_source_docs
        SET status = $2, error = $3, chunk_count = COALESCE($4, chunk_count), updated_at = now()
      WHERE id = $1`,
    [id, status, opts.error ?? null, opts.chunkCount ?? null],
  );
}

export async function deleteDoc(db: Db, ownerUserId: string, id: string): Promise<boolean> {
  const { rowCount } = await db.query(
    `DELETE FROM ai_source_docs WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, id],
  );
  return (rowCount ?? 0) > 0;
}

/** 조각을 통째로 갈아 끼운다. 재색인 때 이전 조각이 남지 않게 먼저 지운다 */
export async function replaceChunks(
  db: Db,
  docId: string,
  chunks: Chunk[],
  embeddings: number[][] | null,
) {
  await db.query(`DELETE FROM ai_source_chunks WHERE doc_id = $1`, [docId]);
  // 한 문장에 여러 행 — 조각 수백 개를 행마다 왕복하면 색인이 느려진다
  const BATCH = 100;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH);
    const values: unknown[] = [];
    const tuples = slice.map((c, j) => {
      const base = j * 5;
      values.push(
        docId,
        c.idx,
        c.page ?? null,
        c.content,
        embeddings ? toVectorLiteral(embeddings[i + j]) : null,
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::public.vector)`;
    });
    await db.query(
      `INSERT INTO ai_source_chunks (doc_id, idx, page, content, embedding) VALUES ${tuples.join(", ")}`,
      values,
    );
  }
}

export interface ChunkHit {
  doc_name: string;
  page: number | null;
  content: string;
  /** 세 검색의 순위를 합친 값(RRF). 절대 크기에 뜻이 없고 이 목록 안의 순서만 뜻한다 */
  score: number;
  /** 코사인 유사도(0~1). 벡터 쪽에 안 걸렸으면 null — 문턱 판정은 `retrieval.ts` 가 한다 */
  similarity: number | null;
  /** 전문 검색이나 부분 일치에서 잡혔는가 — 질의 낱말이 본문에 실제로 있다는 뜻이다 */
  lexical: boolean;
  /** 이 조각이 속한 문서의 요약. 색인 때 만들어 둔 것이고 없으면 null */
  doc_summary: string | null;
  /** 내가 올린 문서가 아니라 회사에 공유된 문서인가 */
  shared: boolean;
}

/** 세 순위를 합칠 때 쓰는 상수(RRF). 60 은 이 방식의 관례값이고, 클수록 상위권 가중이 완만해진다 */
const RRF_K = 60;
/** 각 검색에서 가져올 후보 수. 합친 뒤 상위 `limit` 개만 남는다 */
const CANDIDATES = 30;
/**
 * 부분 일치로 인정할 최소 낱말 유사도(0~1).
 *
 * `word_similarity` 는 질의가 본문의 어느 한 대목과 얼마나 닮았는지를 본다. 0.5 면 "단가" 가 "단가는" 에,
 * "608ZZ" 가 "608ZZ-01" 에 걸리는 정도다. 낮추면 아무 낱말이나 걸리고, 높이면 조사 하나에도 떨어진다.
 */
const TRGM_FLOOR = 0.5;

/**
 * 질문과 가까운 조각을 찾는다. `names` 가 있으면 그 문서 안에서, `null` 이면 본인 문서 전체에서.
 *
 * **분야 제한이 SQL 에 있다.** 문서의 `module_slug` 가 허용 모듈(`allowedModules`) 안에 있거나 NULL(분류 없음)인
 * 것만 잡힌다. 권한 없는 분야의 문서는 조각 단계에서 걸러지므로 프롬프트가 실수해도 모델에 닿지 않는다.
 *
 * **벡터와 전문 검색을 둘 다 돌려 순위를 합친다(RRF).** 예전에는 벡터가 한 건이라도 나오면 거기서 끝냈고, 벡터는
 * 거의 항상 무언가를 돌려주므로 전문 검색은 사실상 켜지지 않았다. 그런데 품번(`PRT-BRG-608`)·전표번호처럼 글자가
 * 그대로 맞아야 하는 질의는 밀집 벡터가 가장 약한 자리다 — 제조 문서 질문의 상당수가 그렇다.
 *
 * 합치는 방법은 순위 기반이다. 두 검색의 점수 체계(코사인 유사도 · ts_rank)는 서로 비교할 수 없으므로 점수를 섞지
 * 않고 각 목록에서의 등수만 쓴다: `1/(60+등수)` 를 더한다. 한쪽에만 잡힌 조각도 그 한쪽 몫만큼 점수를 받는다.
 *
 * 질의 임베딩이 없으면(키 없음·임베딩 실패) 벡터 쪽이 0건이 되어 자연히 전문 검색만 남는다. 조각의 임베딩이
 * NULL 인 경우(키 없이 색인)도 같다. 둘 다 `ready` 상태의 본인 문서만 본다.
 */
export async function searchChunks(
  db: Db,
  ownerUserId: string,
  names: string[] | null,
  allowedModules: string[],
  query: { text: string; embedding: number[] | null; embeddingModel: string },
  limit: number,
): Promise<ChunkHit[]> {
  if (names !== null && names.length === 0) return [];
  // $2 가 NULL 이면 이름 조건을 건너뛴다 — 내가 볼 수 있는 문서 전체. $5 는 허용 모듈(빈 배열이면 분류 없는 문서만)
  const scope = `(d.owner_user_id = $1 OR d.scope = 'company')
          AND d.status = 'ready'
          AND ($2::text[] IS NULL OR d.name = ANY($2::text[]))
          AND (d.module_slug IS NULL OR d.module_slug = ANY($5::text[]))`;

  const { rows } = await db.query<ChunkHit>(
    `WITH q AS (
       -- 질의를 본문과 같은 방식으로 토큰화한 뒤 OR 로 잇는다.
       -- websearch_to_tsquery 는 낱말을 AND 로 묶는데, 색인이 'simple'(형태소 분석 없음)이라 "단가" 와 "단가는" 이
       -- 다른 토큰이다 — 조사가 붙은 낱말 하나가 섞이면 문장 전체가 안 걸린다. OR 로 두면 걸리는 낱말 수만큼
       -- ts_rank 가 올라가고, 느슨해진 만큼은 RRF 합산과 유사도 문턱이 잡는다.
       SELECT to_tsquery('simple', nullif(array_to_string(tsvector_to_array(to_tsvector('simple', $3)), ' | '), '')) AS tsq
     ),
     vec AS (
       SELECT c.id,
              row_number() OVER (ORDER BY c.embedding OPERATOR(public.<=>) $6::public.vector) AS rnk,
              1 - (c.embedding OPERATOR(public.<=>) $6::public.vector) AS sim
         FROM ai_source_chunks c
         JOIN ai_source_docs d ON d.id = c.doc_id
        WHERE $6::public.vector IS NOT NULL
          AND c.embedding IS NOT NULL
          -- 다른 모델로 만든 벡터는 비교 대상이 아니다. 재색인 전까지 그 문서는 전문 검색·부분 일치로만 찾힌다
          AND d.embedding_model IS NOT DISTINCT FROM $8
          AND ${scope}
        ORDER BY c.embedding OPERATOR(public.<=>) $6::public.vector
        LIMIT $7
     ),
     trg AS (
       -- 부분 일치. 조사가 붙은 낱말("단가는")과 품번 일부를 잡는다 — 전문 검색이 낱말 단위라 놓치는 자리다.
       -- word_similarity 는 본문에서 질의와 가장 닮은 대목을 보고, gin_trgm_ops 색인을 탄다
       SELECT c.id,
              row_number() OVER (ORDER BY public.word_similarity($3, c.content) DESC) AS rnk
         FROM ai_source_chunks c
         JOIN ai_source_docs d ON d.id = c.doc_id
        WHERE public.word_similarity($3, c.content) >= ${TRGM_FLOOR}
          AND ${scope}
        ORDER BY public.word_similarity($3, c.content) DESC
        LIMIT $7
     ),
     lex AS (
       SELECT c.id,
              row_number() OVER (ORDER BY ts_rank(c.tsv, q.tsq) DESC) AS rnk
         FROM ai_source_chunks c
         JOIN ai_source_docs d ON d.id = c.doc_id
         CROSS JOIN q
        WHERE q.tsq IS NOT NULL
          AND c.tsv @@ q.tsq
          AND ${scope}
        ORDER BY ts_rank(c.tsv, q.tsq) DESC
        LIMIT $7
     ),
     ids AS (SELECT id FROM vec UNION SELECT id FROM lex UNION SELECT id FROM trg)
     SELECT d.name AS doc_name, c.page, c.content,
            (coalesce(1.0 / (${RRF_K} + v.rnk), 0)
             + coalesce(1.0 / (${RRF_K} + l.rnk), 0)
             + coalesce(1.0 / (${RRF_K} + t.rnk), 0))::float8 AS score,
            v.sim AS similarity,
            (l.id IS NOT NULL OR t.id IS NOT NULL) AS lexical,
            d.summary AS doc_summary,
            (d.owner_user_id <> $1) AS shared
       FROM ids
       JOIN ai_source_chunks c ON c.id = ids.id
       JOIN ai_source_docs d ON d.id = c.doc_id
       LEFT JOIN vec v ON v.id = ids.id
       LEFT JOIN lex l ON l.id = ids.id
       LEFT JOIN trg t ON t.id = ids.id
      ORDER BY score DESC, similarity DESC NULLS LAST
      LIMIT $4`,
    [
      ownerUserId,
      names,
      query.text,
      limit,
      allowedModules,
      query.embedding ? toVectorLiteral(query.embedding) : null,
      CANDIDATES,
      query.embeddingModel,
    ],
  );
  return rows;
}
