-- 외부 시스템 온톨로지 — 회사 · 시스템별 개념 표.
--
-- 지금까지 외부 MES 개념 7개는 코드에 있었다(FE lib/ai/ontology.ts 의 설명 + BE MesConcepts 의 SQL). 회사마다 붙는 시스템이
-- 다르고 같은 MES 라도 테이블이 다르므로 개념을 행으로 옮긴다. 한 행에 **모델용 설명**(이름 · 동의어 · 탭 · attrs 라벨 · 관계)과
-- **실행용 정의**(SELECT · 허용 컬럼 · 정렬)를 같이 둔다 — 두 곳에 나눠 두면 한쪽만 고쳐져 갈린다.
--
-- 행은 운영 콘솔(AdminExternalConceptService)이 넣는다. 고객은 보지도 고치지도 못한다. SQL 은 내부 관리자가 쓰는 것이라
-- 신뢰하되 서버가 세 가지(select 로 시작 · 세미콜론 없음 · 길이)를 보고, 실제 안전장치는 DB 롤(SELECT 만) · readOnly · 타임아웃이다.
-- AI 서버는 턴마다 이 표를 읽어 내장 개념 뒤에 붙인다(GET /api/workspace/external/ontology). SQL 은 그 응답에 싣지 않는다.
CREATE TABLE external_system_concepts (
    id                 bigserial     NOT NULL,
    external_system_id bigint        NOT NULL,
    -- 모델이 고르는 값. 회사 안에서 유일. 짧고 영문 소문자 (예: mes_downtime)
    concept_id         varchar(50)   NOT NULL,
    -- ── 모델용 설명 (FE Concept 과 같은 필드) ──
    name               varchar(100)  NOT NULL,
    synonyms           text[]        NOT NULL DEFAULT '{}',
    -- 권한 탭(모듈 탭 id). 이 탭이 없는 사람에게는 이름조차 보이지 않는다
    tab                varchar(30)   NOT NULL,
    description        text          NOT NULL,
    -- {"equipment_code": "설비 코드", ...}. 키 = SELECT 가 내놓는 컬럼 이름
    attrs              jsonb         NOT NULL,
    -- [{"attr": "wo_no", "to": "mes_work_order"}]
    relations          jsonb         NOT NULL DEFAULT '[]',
    -- 파생값이면 사람이 읽는 계산식
    formula            varchar(200),
    -- ── 실행용 정의 (옛 MesConcepts.Concept) ──
    -- FROM 까지의 SELECT. 서버가 서브쿼리로 감싸 WHERE · ORDER BY · LIMIT 를 붙인다
    sql                text          NOT NULL,
    -- 동등 조건을 걸 수 있는 출력 컬럼. 목록 밖 이름은 400
    filter_columns     text[]        NOT NULL DEFAULT '{}',
    -- ORDER BY 절. 출력 컬럼 이름으로 쓴다
    order_by           varchar(200)  NOT NULL,
    sort_order         integer       NOT NULL DEFAULT 0,
    created_at         timestamp(6) with time zone NOT NULL DEFAULT now(),
    updated_at         timestamp(6) with time zone NOT NULL DEFAULT now(),
    CONSTRAINT pk_external_system_concepts PRIMARY KEY (id),
    CONSTRAINT fk_external_system_concepts_system FOREIGN KEY (external_system_id)
        REFERENCES external_systems (id) ON DELETE CASCADE,
    CONSTRAINT uq_external_system_concepts_concept UNIQUE (concept_id),
    CONSTRAINT ck_external_system_concepts_concept_id CHECK (concept_id ~ '^[a-z][a-z0-9_]{1,49}$'),
    CONSTRAINT ck_external_system_concepts_sql CHECK (sql !~ ';' AND length(sql) <= 8000)
);

CREATE INDEX ix_external_system_concepts_system ON external_system_concepts (external_system_id, sort_order, id);

COMMENT ON TABLE  external_system_concepts IS '외부 시스템 온톨로지 — 회사 · 시스템별 개념. 모델용 설명과 실행용 SQL 을 한 행에 둔다. 운영 콘솔이 넣는다.';
COMMENT ON COLUMN external_system_concepts.concept_id     IS '모델이 고르는 id. 회사 안에서 유일.';
COMMENT ON COLUMN external_system_concepts.tab            IS '권한 탭(모듈 탭 id).';
COMMENT ON COLUMN external_system_concepts.attrs          IS '출력 컬럼 → 라벨. 키가 곧 SELECT 컬럼.';
COMMENT ON COLUMN external_system_concepts.sql            IS 'FROM 까지의 SELECT. 서버가 서브쿼리로 감싼다. AI 응답에는 싣지 않는다.';
COMMENT ON COLUMN external_system_concepts.filter_columns IS '동등 조건을 걸 수 있는 출력 컬럼.';
