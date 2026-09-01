-- 테넌트 스키마를 만드는 함수.
--
-- V9 의 workspace_comment 와 같은 이유다. CREATE SCHEMA 는 유틸리티 문이라 스키마 이름을
-- 바인딩 파라미터로 받지 못한다. 애플리케이션에서 문자열로 붙이면 그 자리가 이 시스템에서
-- 유일한 SQL 조립 지점이 되는데, 조립을 서버로 넘기면 format 의 %I 가 식별자 인용을 대신해
-- 준다.
--
-- 결과적으로 애플리케이션 코드에는 SQL 을 문자열로 잇는 자리가 하나도 남지 않는다.
--
--   전:  jdbcTemplate.execute("CREATE SCHEMA IF NOT EXISTS " + schema);
--   후:  jdbcTemplate.queryForObject("SELECT shared.create_tenant_schema(?)", ...);
--
-- 함수 안에서 이름을 다시 검증하는 이유는, 이 함수 자체가 임의의 식별자에 DDL 을 실행할 수
-- 있는 도구이기 때문이다. 호출자를 믿지 않는다.

CREATE OR REPLACE FUNCTION shared.create_tenant_schema(p_schema text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_schema !~ '^ax_[0-9]{5,}$' THEN
        RAISE EXCEPTION '허용되지 않는 스키마 이름입니다: %', p_schema;
    END IF;

    -- IF NOT EXISTS 인 이유는 재시도 때문이다. 마이그레이션 도중 실패한 회사를 다시
    -- 프로비저닝할 때, 스키마만 남고 테이블이 없는 상태에서 여기서 막히면 손으로 지워야 한다.
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', p_schema);
END;
$$;

COMMENT ON FUNCTION shared.create_tenant_schema(text) IS 'ax_ 스키마를 만든다. CREATE SCHEMA 가 바인딩 파라미터를 받지 않아 조립이 불가피한데, format 의 %I 로 식별자 인용을 서버에서 처리한다.';
