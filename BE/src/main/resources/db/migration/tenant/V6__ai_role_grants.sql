-- AI 서버 역할(axcore_ai, shared V16)에 이 회사 스키마의 ai_* 테이블만 연다.
--
-- 스키마 이름은 식별자라 바인딩이 안 되므로, 이 파일에도 적지 않고(V1 규칙) current_schema() 를 format('%I') 로
-- 인용해 쓴다. Flyway 가 대상 스키마를 search_path 로 잡아 주므로 current_schema() 가 곧 이 회사다.
--
-- 앞으로 ai_ 테이블이 늘면 그 마이그레이션에서 GRANT 를 같이 준다 — 기본 권한(ALTER DEFAULT PRIVILEGES)은
-- 만든 역할별로 적용돼 마이그레이션 실행 계정이 바뀌면 조용히 빠질 수 있어 쓰지 않는다.

DO $$
BEGIN
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO axcore_ai', current_schema());
    -- identity 컬럼의 시퀀스(ai_source_chunks.id · ai_messages.id · ai_tool_audit.id) — INSERT 에 필요하다
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO axcore_ai', current_schema());
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ai_source_docs, ai_source_chunks, ai_conversations, ai_messages, ai_tool_audit TO axcore_ai;
