-- AI 역할 비밀번호 설정 함수(V16)에서 실패 시 SQL 전문이 오류에 붙지 않게 한다.
--
-- PL/pgSQL 의 EXECUTE 가 실패하면 PostgreSQL 은 오류 CONTEXT 에 실행하던 문장을 그대로 덧붙인다 —
-- `SQL statement "ALTER ROLE axcore_ai PASSWORD '평문'"`. 그 CONTEXT 는 서버 로그에 기록되고 클라이언트(BE)에도
-- 돌아가 예외 메시지에 실린다. 즉 ALTER ROLE 이 한 번 실패하면 비밀번호가 로그 두 곳에 평문으로 남는다.
--
-- EXECUTE 를 예외 블록으로 감싸 오류 종류(SQLSTATE)와 문구(SQLERRM)만 담은 새 오류로 다시 던진다. 다시 던진
-- 오류에는 원래 문장이 붙지 않는다. 실패 원인 파악에는 이 둘로 충분하다.
--
-- V16 을 고치지 않고 V17 로 두는 이유: 적용된 마이그레이션 파일을 바꾸면 Flyway 체크섬이 어긋나 부팅이 막힌다.

CREATE OR REPLACE FUNCTION shared.set_ai_role_password(p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_password IS NULL OR length(p_password) < 16 THEN
        RAISE EXCEPTION 'AI 역할 비밀번호는 16자 이상이어야 합니다';
    END IF;
    BEGIN
        EXECUTE format('ALTER ROLE axcore_ai PASSWORD %L', p_password);
    EXCEPTION WHEN OTHERS THEN
        -- 원래 오류의 CONTEXT(SQL 전문)를 버리고 종류·문구만 남긴다
        RAISE EXCEPTION 'ALTER ROLE axcore_ai 실패: % (%)', SQLERRM, SQLSTATE;
    END;
END
$$;

REVOKE ALL ON FUNCTION shared.set_ai_role_password(text) FROM PUBLIC;
