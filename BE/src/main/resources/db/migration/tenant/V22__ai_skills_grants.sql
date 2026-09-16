-- ai_skills 를 AI 서버 역할(axcore_ai)에 연다 — V6 규칙(ai_ 표가 늘면 그 마이그레이션에서 GRANT). V21 에서 빠져 INSERT 가
-- permission denied 로 막혔다. V21 은 이미 적용된 스키마가 있어 고치지 않고 따로 준다.
DO $$
DECLARE
    s text := current_schema();
BEGIN
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I.ai_skills TO axcore_ai', s);
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %I.ai_skills_id_seq TO axcore_ai', s);
END
$$;
