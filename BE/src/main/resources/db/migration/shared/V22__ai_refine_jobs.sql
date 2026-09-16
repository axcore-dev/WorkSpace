-- 「AI 로 다듬기」 작업 — 서버가 든다.
--
-- 지금까지 작업은 브라우저 메모리에 있어 새로고침 · 탭 닫기에 사라졌다. AI 서버(FE/lib/ai/server/refine-jobs.ts)가 행을 만들고
-- 개념 하나를 끝낼 때마다 진행(done · current · done_ids)과 결과(items)를 갱신한다. 화면은 이 행을 폴링한다.
--
-- 공유 스키마에 두는 이유: 운영 콘솔 사이드바 배지가 「어느 회사든 도는 작업」 을 한 번에 물어야 한다. 테넌트 표면 스키마마다
-- 훑어야 한다. 행은 회사당 하나만 남긴다 — 새 작업을 시작할 때 그 회사의 끝난 행을 지우고, 검토를 끝내면 행을 지운다.
-- 도는 작업이 회사당 하나뿐인 것은 부분 유니크 인덱스가 보장한다.
--
-- AI 역할(axcore_ai)에 이 표만 연다. shared 의 다른 표 권한은 여전히 없다(V16).
CREATE TABLE shared.ai_refine_jobs (
    id             uuid                        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id   bigint                      NOT NULL,
    -- 시작한 운영자(shared.users). 사람이 지워지면 작업도 의미가 없다
    created_by     uuid                        NOT NULL,
    status         varchar(10)                 NOT NULL,
    structure_only boolean                     NOT NULL,
    -- [{"rowId": 12, "conceptId": "mes_equipment", "name": "설비"}, …]
    targets        jsonb                       NOT NULL,
    done           integer                     NOT NULL DEFAULT 0,
    -- 지금 도는 개념 이름(최대 3)
    current        jsonb                       NOT NULL DEFAULT '[]',
    done_ids       jsonb                       NOT NULL DEFAULT '[]',
    -- 끝난 개념의 제안(RefineItem). 하나 끝날 때마다 덧붙인다
    items          jsonb                       NOT NULL DEFAULT '[]',
    -- failed 일 때 이유
    error          text,
    created_at     timestamp(6) with time zone NOT NULL DEFAULT now(),
    -- 진행이 마지막으로 갱신된 시각. running 인데 오래 멈춰 있으면(서버 재시작) 읽는 쪽이 failed 로 바꾼다
    updated_at     timestamp(6) with time zone NOT NULL DEFAULT now(),
    finished_at    timestamp(6) with time zone,
    CONSTRAINT fk_ai_refine_jobs_user FOREIGN KEY (created_by) REFERENCES shared.users (id) ON DELETE CASCADE,
    CONSTRAINT ck_ai_refine_jobs_status CHECK (status IN ('running', 'done', 'failed'))
);

CREATE UNIQUE INDEX ux_ai_refine_jobs_running ON shared.ai_refine_jobs (workspace_id) WHERE status = 'running';
CREATE INDEX ix_ai_refine_jobs_recent ON shared.ai_refine_jobs (updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON shared.ai_refine_jobs TO axcore_ai;

COMMENT ON TABLE shared.ai_refine_jobs IS 'AI 로 다듬기 작업 — AI 서버가 진행과 결과를 적고 운영 콘솔이 폴링한다. 회사당 한 행.';
