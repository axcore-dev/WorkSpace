-- AI 대화 기록 · 도구 실행 감사.
--
-- 지금까지 대화는 브라우저 localStorage 에만 있어 이전 턴이 모델에 들어가지 못했고, 화면이 히스토리를 통째로
-- 보내는 길은 위조(이전 AI 답변·검색 결과를 꾸며 보내 모델을 유도) 때문에 막아 두었다. 서버가 대화를 갖고
-- 자기 저장본에서 히스토리를 읽어야 한다. 회사 기밀 문서 내용이 답변에 실리므로 소스 문서와 같이 회사별
-- 테넌트 스키마에만 둔다.
--
-- 읽고 쓰는 쪽은 FE 안의 AI 서버(FE/lib/ai/server/conversations.ts)다. DDL 만 Flyway 에 둔다(V3 와 같은 이유).
-- 기존 회사에 적용하려면 `POST /api/admin/workspaces/migrate` 를 한 번 돌린다.

-- ---------------------------------------------------------------------------
-- 대화
-- ---------------------------------------------------------------------------

CREATE TABLE ai_conversations (
    id               uuid                        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id    uuid                        NOT NULL,
    title            varchar(120)                NOT NULL DEFAULT '새 대화',
    -- 이 대화에서 고른 소스 문서 이름들. 문서 자체는 ai_source_docs 에 있고 여기는 선택만 기억한다.
    selected_sources text[]                      NOT NULL DEFAULT '{}',
    created_at       timestamp(6) with time zone NOT NULL DEFAULT now(),
    updated_at       timestamp(6) with time zone NOT NULL DEFAULT now(),
    last_message_at  timestamp(6) with time zone,
    CONSTRAINT fk_ai_conversations_owner FOREIGN KEY (owner_user_id) REFERENCES shared.users (id) ON DELETE CASCADE
);

CREATE INDEX ix_ai_conversations_owner_recent ON ai_conversations (owner_user_id, last_message_at DESC NULLS LAST, created_at DESC);

COMMENT ON TABLE ai_conversations IS 'AI 대화(노트북) 한 건. 본인만 읽고 쓴다.';

-- ---------------------------------------------------------------------------
-- 메시지
-- ---------------------------------------------------------------------------
--
-- 본문(text)과 화면 부가 정보(meta)를 나눈다. 모델에 넣는 히스토리는 text 만 쓰고, meta 는 추론 문구·도구 행·
-- 출처·요약·소요 시간·제안 카드·승인 요청처럼 화면이 다시 그릴 때 필요한 것들이다. 컬럼으로 풀지 않는 이유는
-- 이 모양이 화면 계약(`lib/ai/ui-messages.ts`)을 따라 자주 바뀌기 때문이다.

CREATE TABLE ai_messages (
    id              bigint                      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id uuid                        NOT NULL,
    -- 대화 안 순번. 편집·다시 시도는 "이 순번 이후를 지우고 다시 답한다" 로 표현된다.
    seq             integer                     NOT NULL,
    role            varchar(10)                 NOT NULL,
    text            text                        NOT NULL,
    meta            jsonb                       NOT NULL DEFAULT '{}'::jsonb,
    rating          varchar(4),
    created_at      timestamp(6) with time zone NOT NULL DEFAULT now(),
    CONSTRAINT fk_ai_messages_conversation FOREIGN KEY (conversation_id) REFERENCES ai_conversations (id) ON DELETE CASCADE,
    CONSTRAINT ck_ai_messages_role   CHECK (role IN ('user', 'assistant')),
    CONSTRAINT ck_ai_messages_rating CHECK (rating IS NULL OR rating IN ('up', 'down'))
);

CREATE UNIQUE INDEX ux_ai_messages_conversation_seq ON ai_messages (conversation_id, seq);

COMMENT ON TABLE  ai_messages      IS 'AI 대화 메시지. text 는 모델 히스토리, meta 는 화면 부가 정보.';
COMMENT ON COLUMN ai_messages.seq  IS '대화 안 순번(1부터). 편집·재시도는 이 값 이후를 지운다.';

-- ---------------------------------------------------------------------------
-- 도구 실행 감사
-- ---------------------------------------------------------------------------
--
-- 모델이 도구를 부르는 모든 순간을 남긴다. 승인이 필요한 도구는 `proposed` 로 먼저 기록되고 사용자가 승인·거절하면
-- 그 결정과 시각이 같은 행에 남는다. 기밀 데이터가 외부 앱으로 나갈 수 있는 경로라 "누가 언제 무엇을 어떤 입력으로"
-- 가 없으면 안 된다. 출력은 앞부분만 남긴다(output_preview) — 통째로 쌓으면 감사 테이블이 기밀 저장소가 된다.

CREATE TABLE ai_tool_audit (
    id              bigint                      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- 승인 요청 식별자. 화면의 승인 카드가 이 값으로 답한다. 승인이 필요 없는 도구는 NULL.
    approval_id     uuid                        UNIQUE,
    conversation_id uuid,
    user_id         uuid                        NOT NULL,
    tool_name       varchar(100)                NOT NULL,
    input           jsonb,
    output_preview  text,
    -- proposed(승인 대기) → approved | denied → executed | failed. 승인 불필요 도구는 executed | failed 로 시작.
    status          varchar(20)                 NOT NULL,
    error           text,
    duration_ms     integer,
    decided_at      timestamp(6) with time zone,
    created_at      timestamp(6) with time zone NOT NULL DEFAULT now(),
    CONSTRAINT fk_ai_tool_audit_conversation FOREIGN KEY (conversation_id) REFERENCES ai_conversations (id) ON DELETE SET NULL,
    CONSTRAINT fk_ai_tool_audit_user         FOREIGN KEY (user_id) REFERENCES shared.users (id) ON DELETE CASCADE,
    CONSTRAINT ck_ai_tool_audit_status CHECK (status IN ('proposed', 'approved', 'denied', 'executed', 'failed'))
);

CREATE INDEX ix_ai_tool_audit_user_recent ON ai_tool_audit (user_id, created_at DESC);

COMMENT ON TABLE ai_tool_audit IS 'AI 도구 호출 감사 기록. 승인 대기·결정·실행 결과가 한 행에 남는다.';
