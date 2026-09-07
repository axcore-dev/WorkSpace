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
  },
): Promise<DocRow> {
  const { rows } = await db.query<DocRow>(
    `INSERT INTO ai_source_docs (id, owner_user_id, name, type, size_bytes, storage_key)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [doc.id, doc.ownerUserId, doc.name, doc.type, doc.sizeBytes, doc.storageKey],
  );
  return rows[0];
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
  score: number;
}

/**
 * 질문과 가까운 조각을 찾는다. `names` 가 있으면 그 문서 안에서, `null` 이면 본인 문서 전체에서.
 *
 * **분야 제한이 SQL 에 있다.** 문서의 `module_slug` 가 허용 모듈(`allowedModules`) 안에 있거나 NULL(분류 없음)인
 * 것만 잡힌다. 권한 없는 분야의 문서는 조각 단계에서 걸러지므로 프롬프트가 실수해도 모델에 닿지 않는다.
 *
 * 임베딩이 있으면 코사인 거리(`<=>`), 없으면 전문 검색 순위다. 둘 다 `ready` 상태의 본인 문서만 본다.
 * 조각의 임베딩이 NULL(키 없이 색인) 인데 질의 임베딩만 있는 경우도 전문 검색으로 내려간다.
 */
export async function searchChunks(
  db: Db,
  ownerUserId: string,
  names: string[] | null,
  allowedModules: string[],
  query: { text: string; embedding: number[] | null },
  limit: number,
): Promise<ChunkHit[]> {
  if (names !== null && names.length === 0) return [];
  // $2 가 NULL 이면 이름 조건을 건너뛴다 — 본인 문서 전체. $5 는 허용 모듈(빈 배열이면 분류 없는 문서만)
  const filters = `AND ($2::text[] IS NULL OR d.name = ANY($2::text[]))
          AND (d.module_slug IS NULL OR d.module_slug = ANY($5::text[]))`;

  if (query.embedding) {
    const { rows } = await db.query<ChunkHit>(
      `SELECT d.name AS doc_name, c.page, c.content,
              1 - (c.embedding OPERATOR(public.<=>) $3::public.vector) AS score
         FROM ai_source_chunks c
         JOIN ai_source_docs d ON d.id = c.doc_id
        WHERE d.owner_user_id = $1
          AND d.status = 'ready'
          ${filters}
          AND c.embedding IS NOT NULL
        ORDER BY c.embedding OPERATOR(public.<=>) $3::public.vector
        LIMIT $4`,
      [ownerUserId, names, toVectorLiteral(query.embedding), limit, allowedModules],
    );
    if (rows.length > 0) return rows;
  }

  const { rows } = await db.query<ChunkHit>(
    `WITH q AS (SELECT websearch_to_tsquery('simple', $3) AS tsq)
     SELECT d.name AS doc_name, c.page, c.content,
            ts_rank(c.tsv, q.tsq) AS score
       FROM ai_source_chunks c
       JOIN ai_source_docs d ON d.id = c.doc_id
       CROSS JOIN q
      WHERE d.owner_user_id = $1
        AND d.status = 'ready'
        ${filters}
        AND c.tsv @@ q.tsq
      ORDER BY score DESC
      LIMIT $4`,
    [ownerUserId, names, query.text, limit, allowedModules],
  );
  return rows;
}
