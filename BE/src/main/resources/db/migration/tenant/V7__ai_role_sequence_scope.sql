-- AI 역할의 시퀀스 권한을 ai_* 세 개로 좁힌다.
--
-- V6 은 `ALL SEQUENCES IN SCHEMA` 로 줘서 members · roles · departments 등 AI 서버가 쓰지 않는 시퀀스에도
-- nextval(ID 건너뜀) · last_value 읽기(행 수 추정)가 열려 있었다. 영향은 작지만 최소 권한 원칙에 맞게 정리한다.
-- ai_source_docs · ai_conversations 는 uuid 기본키라 시퀀스가 없다.

DO $$
DECLARE
    s text := current_schema();
BEGIN
    EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM axcore_ai', s);
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %I.ai_source_chunks_id_seq, %I.ai_messages_id_seq, %I.ai_tool_audit_id_seq TO axcore_ai', s, s, s);
END
$$;
