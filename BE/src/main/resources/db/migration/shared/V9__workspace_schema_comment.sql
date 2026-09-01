-- 테넌트 스키마에 코멘트를 다는 함수.
--
-- 스키마 이름은 ax_00001 처럼 순번뿐이라 psql 에서 \dn 을 쳐도 어느 회사인지 알 수 없다.
-- 코멘트를 달아두면 \dn+ 에 함께 나와 운영·디버깅 때 shared.workspaces 를 조회하지 않아도 된다.
-- (docs/db/schema-draft-v2.md — "대신 잃는 것 — 스키마만 보고 회사를 알 수 없다")
--
-- 함수로 감싸는 이유가 있다. COMMENT ON 은 유틸리티 문이라 ? 바인딩을 받지 않는다. 즉 회사명을
-- 문자열로 조립할 수밖에 없는데, 그걸 애플리케이션에서 하면 회사명이 그대로 DDL 에 들어가는
-- 인젝션 표면이 된다. format 의 %I · %L 이 서버 쪽에서 이스케이프를 대신해 주므로 그 일을
-- DB 로 넘긴다.
--
--   %I — 식별자로 인용(스키마 이름). 예약어·대문자·따옴표를 안전하게 감싼다
--   %L — 리터럴로 인용(코멘트 본문). 따옴표가 들어 있어도 문자열을 벗어나지 못한다

CREATE OR REPLACE FUNCTION shared.workspace_comment(p_schema text, p_label text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- 스키마 이름은 애플리케이션에서도 검증하지만 여기서 한 번 더 본다. 이 함수는 임의의
    -- 식별자에 DDL 을 실행할 수 있는 도구라, 호출자를 믿지 않는 편이 맞다.
    IF p_schema !~ '^ax_[0-9]{5,}$' THEN
        RAISE EXCEPTION '허용되지 않는 스키마 이름입니다: %', p_schema;
    END IF;

    EXECUTE format('COMMENT ON SCHEMA %I IS %L', p_schema, p_label);
END;
$$;

COMMENT ON FUNCTION shared.workspace_comment(text, text) IS 'ax_ 스키마에 회사 식별 코멘트를 단다. COMMENT ON 이 바인딩 파라미터를 받지 않아 조립이 불가피한데, format 의 %I·%L 로 이스케이프를 서버에서 처리한다.';
