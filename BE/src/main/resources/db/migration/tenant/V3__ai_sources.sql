-- AI 대화 소스 문서 · 검색용 조각(RAG).
--
-- **회사 기밀 문서다.** 그래서 shared 가 아니라 회사별 테넌트 스키마에만 만든다. 스키마 하나가 곧
-- 회사 하나라 workspace 컬럼이 없고, 다른 회사의 조각이 같은 테이블에 섞이는 일이 구조적으로 없다.
--
-- 이 테이블은 Spring 이 아니라 **FE 안의 AI 서버(Next Route Handler, FE/lib/ai/server)** 가 읽고 쓴다.
-- DDL 만 여기(Flyway)에 두는 이유는 테넌트 스키마 구조의 단일 출처를 유지하기 위해서다 — 신규 회사
-- 프로비저닝과 기존 회사 순회 배포가 같은 파일을 쓴다는 성질이 AI 테이블에도 그대로 적용된다.
-- 기존 회사에 적용하려면 `POST /api/admin/workspaces/migrate` 를 한 번 돌린다.

-- ---------------------------------------------------------------------------
-- 소스 문서
-- ---------------------------------------------------------------------------
--
-- 파일 본문은 DB 에 없다. 네이버 클라우드 Object Storage 에 회사 스키마 접두어로 올라가고 여기에는
-- 그 키(storage_key)만 남는다. 화면이 보는 `SourceDoc { name, type, scope, updated }` 는 이 행에서 만든다.

CREATE TABLE ai_source_docs (
    id             uuid                        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id  uuid                        NOT NULL,
    -- 화면이 문서를 이름으로 고르므로(선택 소스 = 이름 배열) 같은 사람 안에서는 이름이 유일해야 한다.
    name           varchar(200)                NOT NULL,
    -- 확장자 대문자. PDF · DOCX · XLSX · PNG · JPG
    type           varchar(10)                 NOT NULL,
    size_bytes     bigint                      NOT NULL,
    storage_key    varchar(500)                NOT NULL,
    -- personal(개인) · team(팀) · company(전사). 지금은 personal 만 만들고 검색도 본인 문서로 한정한다.
    scope          varchar(10)                 NOT NULL DEFAULT 'personal',
    -- indexing → ready | failed. 업로드 응답은 indexing 상태로 나가고 뒤에서 조각을 만든다.
    status         varchar(20)                 NOT NULL DEFAULT 'indexing',
    error          text,
    chunk_count    integer                     NOT NULL DEFAULT 0,
    created_at     timestamp(6) with time zone NOT NULL DEFAULT now(),
    updated_at     timestamp(6) with time zone NOT NULL DEFAULT now(),
    CONSTRAINT fk_ai_source_docs_owner  FOREIGN KEY (owner_user_id) REFERENCES shared.users (id) ON DELETE CASCADE,
    CONSTRAINT ck_ai_source_docs_status CHECK (status IN ('indexing', 'ready', 'failed')),
    CONSTRAINT ck_ai_source_docs_scope  CHECK (scope  IN ('personal', 'team', 'company'))
);

CREATE UNIQUE INDEX ux_ai_source_docs_owner_name  ON ai_source_docs (owner_user_id, name);
CREATE UNIQUE INDEX ux_ai_source_docs_storage_key ON ai_source_docs (storage_key);

COMMENT ON TABLE  ai_source_docs             IS 'AI 대화에 올린 소스 문서(회사 기밀). 본문은 Object Storage, 여기는 메타와 색인 상태.';
COMMENT ON COLUMN ai_source_docs.storage_key IS 'Object Storage 객체 키. <schema>/ai-sources/<user>/<doc id>/<파일명>';
COMMENT ON COLUMN ai_source_docs.status      IS 'indexing: 조각 생성 중 · ready: 검색 가능 · failed: error 참고';

-- ---------------------------------------------------------------------------
-- 검색 조각
-- ---------------------------------------------------------------------------
--
-- 문서를 1,000자 안팎으로 잘라 조각마다 임베딩을 붙인다. 임베딩 모델이 없는 환경(키 미설정)에서도
-- 동작하도록 embedding 은 NULL 을 허용하고, 그때는 tsv(전문 검색)로 찾는다.
--
-- 차원 1536 은 OpenAI text-embedding-3-* 를 dimensions=1536 으로 부른 값이다. 모델을 바꿔 차원이
-- 달라지면 이 컬럼을 다시 만들어야 하므로, AI 서버는 항상 1536 으로 고정해 호출한다.

CREATE TABLE ai_source_chunks (
    id        bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doc_id    uuid    NOT NULL,
    idx       integer NOT NULL,
    -- PDF 쪽 번호 · XLSX 시트 순번. 출처 표시에 쓴다. 없는 형식은 NULL
    page      integer,
    content   text    NOT NULL,
    embedding public.vector(1536),
    -- 'simple' 설정은 공백 기준 토큰화라 한국어에도 무난하다. 형태소 분석은 하지 않는다.
    tsv       tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
    CONSTRAINT fk_ai_source_chunks_doc FOREIGN KEY (doc_id) REFERENCES ai_source_docs (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX ux_ai_source_chunks_doc_idx   ON ai_source_chunks (doc_id, idx);
CREATE INDEX        ix_ai_source_chunks_tsv       ON ai_source_chunks USING gin (tsv);
CREATE INDEX        ix_ai_source_chunks_embedding ON ai_source_chunks USING hnsw (embedding public.vector_cosine_ops);

COMMENT ON TABLE ai_source_chunks IS '소스 문서 조각. 임베딩(코사인) 또는 전문 검색(tsv)으로 찾는다.';
