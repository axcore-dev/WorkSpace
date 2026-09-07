-- 소스 문서의 업무 분야(모듈) 태그.
--
-- AI 답변 범위를 "본인이 권한을 가진 분야" 로 좁히기 위한 컬럼이다. 값은 화면의 핵심 기능 slug
-- (management · design · production · equipment · quality · inventory · sales · support) 중 하나이고,
-- 색인 때 모델이 문서 내용을 보고 분류해 넣는다. 분류가 안 되면 NULL 이며, NULL 문서는 분야 제한 없이
-- 회사 구성원 누구의 검색에나 잡힌다 — 태그가 없다는 이유로 자료가 아무에게도 안 보이는 쪽보다 안전하다.
--
-- 검색(FE/lib/ai/server/sources.ts) 은 `module_slug IS NULL OR module_slug = ANY(허용 모듈)` 로 거른다.
-- 허용 모듈은 BE introspect 가 `role_module_grants` · `member_module_grants` 로 계산해 준다.
ALTER TABLE ai_source_docs ADD COLUMN module_slug varchar(50);

CREATE INDEX ix_ai_source_docs_module ON ai_source_docs (owner_user_id, module_slug);

COMMENT ON COLUMN ai_source_docs.module_slug IS '업무 분야(핵심 기능 slug). 색인 때 모델이 분류. NULL 은 분야 제한 없음.';
