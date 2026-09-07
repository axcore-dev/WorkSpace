-- AI 서버(FE/lib/ai/server) 전용 DB 역할.
--
-- 지금까지 Next 컨테이너는 Spring 과 같은 슈퍼유저 계정으로 DB 에 붙었다. 그러면 AI 서버가 침해됐을 때
-- shared.users 와 모든 테넌트 테이블에 쓰기가 가능하다. AI 서버가 실제로 만지는 것은 각 회사 스키마의 ai_*
-- 다섯 테이블뿐이므로, 그것만 허용하는 역할을 따로 둔다. 테이블별 GRANT 는 테넌트 마이그레이션(V6)이 회사마다 준다.
--
-- 비밀번호는 여기 적지 않는다(마이그레이션은 저장소에 있다). 역할은 로그인 가능하지만 비밀번호가 없어 곧바로는
-- 못 들어오고, BE 가 부팅할 때 환경 변수(AI_DB_PASSWORD)로 아래 함수를 불러 설정한다(AiDbRoleOnBoot).
-- ALTER ROLE ... PASSWORD 는 리터럴을 바인딩할 수 없어, 다른 자리와 같이 format('%L') 을 쓰는 DB 함수로 옮겼다.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'axcore_ai') THEN
        CREATE ROLE axcore_ai LOGIN;
    END IF;
END
$$;

-- search_path 에 shared 가 붙으므로 스키마 사용은 열어 둔다. shared 의 테이블 권한은 주지 않는다 —
-- 테넌트 테이블의 shared.users FK 검사는 테이블 소유자 권한으로 돌아 AI 역할에 SELECT 가 필요 없다.
GRANT USAGE ON SCHEMA shared TO axcore_ai;

CREATE OR REPLACE FUNCTION shared.set_ai_role_password(p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_password IS NULL OR length(p_password) < 16 THEN
        RAISE EXCEPTION 'AI 역할 비밀번호는 16자 이상이어야 합니다';
    END IF;
    EXECUTE format('ALTER ROLE axcore_ai PASSWORD %L', p_password);
END
$$;

REVOKE ALL ON FUNCTION shared.set_ai_role_password(text) FROM PUBLIC;

COMMENT ON FUNCTION shared.set_ai_role_password(text) IS 'AI 서버 DB 역할(axcore_ai)의 비밀번호를 설정한다. BE 가 부팅 때 AI_DB_PASSWORD 로 부른다.';
