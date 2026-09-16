-- 회사 스킬 — 관리자가 만드는 AI 답변 양식.
--
-- 기본 스킬 9개(보고서 · 공문 · RCA …)는 코드에 있다(FE data/chat.ts SKILL_LIB). 회사마다 보고 양식 · 결재선 · 거래처 말투가
-- 달라 회사가 직접 넣을 자리가 필요하다. 한 행이 스킬 하나고, 내용은 모델에게 주는 지시문(양식 · 순서 · 하지 말 것)이다.
-- 지시문은 답의 모양만 정한다. 답변 범위 규칙(권한 · 근거 없으면 추측 금지)은 시스템 프롬프트가 스킬보다 위에 둔다.
--
-- 읽고 쓰는 쪽은 FE 안의 AI 서버(FE/app/ai/skills/*)다. DDL 만 Flyway 에 둔다(V3 · V4 와 같은 이유). 구성원 누구나 읽고,
-- 쓰기는 회사 관리자(roles.is_admin · owner)만 — 판정은 introspect 의 admin 값으로 한다.
CREATE TABLE ai_skills (
    id            bigint                      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          varchar(60)                 NOT NULL,
    description   varchar(200)                NOT NULL,
    -- 모델에게 주는 작업 방식. 프롬프트에 그대로 들어가므로 길이를 막는다
    instructions  varchar(4000)               NOT NULL,
    created_by    uuid                        NOT NULL,
    created_at    timestamp(6) with time zone NOT NULL DEFAULT now(),
    updated_at    timestamp(6) with time zone NOT NULL DEFAULT now(),
    CONSTRAINT uq_ai_skills_name UNIQUE (name),
    CONSTRAINT fk_ai_skills_created_by FOREIGN KEY (created_by) REFERENCES shared.users (id) ON DELETE RESTRICT
);

COMMENT ON TABLE  ai_skills IS '회사 스킬 — 관리자가 만드는 AI 답변 양식. 구성원 누구나 대화에 붙일 수 있다.';
COMMENT ON COLUMN ai_skills.instructions IS '모델에게 주는 작업 방식(양식 · 순서 · 하지 말 것). 시스템 프롬프트에 그대로 들어간다.';
