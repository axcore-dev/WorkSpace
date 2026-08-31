-- 소셜 로그인 — Google · 네이버.
--
-- 두 가지를 바꾼다. 하나는 비밀번호 없는 계정을 허용하는 것이고, 다른 하나는 "이 계정이 어느
-- 제공자의 어떤 사용자와 같은 사람인가"를 담을 곳을 만드는 것이다.
--
-- 이메일을 연결 키로 쓰지 않는다. 제공자 쪽 이메일은 바뀔 수 있고, 바뀐 뒤에도 같은 사람으로
-- 인식해야 한다. 반대로 이메일만으로 이었다면 어떤 제공자가 확인되지 않은 주소를 넘겨주는
-- 순간 남의 계정에 들어가는 경로가 된다. 그래서 제공자가 주는 불변 식별자(Google 의 sub,
-- 네이버의 id)를 저장하고 그걸로 잇는다.

-- ---------------------------------------------------------------------------
-- 비밀번호 없는 계정
-- ---------------------------------------------------------------------------

-- Google 로만 가입한 사람은 비밀번호가 없다. 빈 문자열이나 임의의 난수 해시를 채워 넣는 방식은
-- 쓰지 않는다 — "비밀번호가 없다"와 "아무도 모르는 비밀번호가 있다"를 구분할 수 없게 되고,
-- 비밀번호 로그인 경로에서 그 차이가 필요하다.
ALTER TABLE shared.users ALTER COLUMN password_hash DROP NOT NULL;

COMMENT ON COLUMN shared.users.password_hash IS 'DelegatingPasswordEncoder 형식({bcrypt}$2a$...). NULL 이면 비밀번호 자격증명이 없는 계정이다(소셜 전용). 이 경우 비밀번호 로그인은 실패해야 하며, 비밀번호 재설정 링크로 나중에 설정할 수 있다.';

-- password_changed_at 도 함께 NULL 을 허용해야 의미가 맞는다. 원래도 nullable 이지만
-- 소셜 계정에서는 채우지 않는다는 점을 남긴다.
COMMENT ON COLUMN shared.users.password_changed_at IS '비밀번호를 마지막으로 설정·변경한 시각. 비밀번호가 없는 계정은 NULL 이다.';

-- ---------------------------------------------------------------------------
-- 소셜 계정 연결
-- ---------------------------------------------------------------------------

CREATE TABLE shared.user_identities (
    id               uuid                        PRIMARY KEY,
    user_id          uuid                        NOT NULL,
    provider         varchar(20)                 NOT NULL,
    provider_user_id varchar(255)                NOT NULL,
    email            varchar(255),
    created_at       timestamp(6) with time zone NOT NULL,
    updated_at       timestamp(6) with time zone NOT NULL,
    CONSTRAINT ux_user_identities_provider_subject UNIQUE (provider, provider_user_id),
    CONSTRAINT ux_user_identities_user_provider    UNIQUE (user_id, provider),
    CONSTRAINT fk_user_identities_user             FOREIGN KEY (user_id)
        REFERENCES shared.users (id) ON DELETE CASCADE,
    CONSTRAINT ck_user_identities_provider         CHECK (provider IN ('google', 'naver'))
);

COMMENT ON TABLE shared.user_identities IS '계정에 연결된 소셜 제공자. 한 계정이 Google 과 네이버를 동시에 가질 수 있다.';

-- 이 제약이 이 테이블의 핵심이다. 하나의 Google 계정이 두 사람의 계정에 붙는 것을 DB 가 막는다.
-- 애플리케이션 로직에 구멍이 생겨도 여기서 걸린다.
COMMENT ON CONSTRAINT ux_user_identities_provider_subject ON shared.user_identities IS '같은 제공자 계정이 두 개의 내부 계정에 연결되는 것을 막는다.';

-- 한 계정에 같은 제공자를 두 번 붙일 이유가 없다. Google 계정을 바꿔 다시 연결하려면
-- 기존 행을 갱신하거나 지워야 한다.
COMMENT ON CONSTRAINT ux_user_identities_user_provider ON shared.user_identities IS '한 계정당 제공자별로 하나만 연결한다.';

COMMENT ON COLUMN shared.user_identities.provider_user_id IS '제공자가 주는 불변 식별자(Google=sub, 네이버=id). 이메일이 바뀌어도 이 값은 유지되므로 연결 키로 이 값을 쓴다.';
COMMENT ON COLUMN shared.user_identities.email IS '연결 시점에 제공자가 알려 준 이메일. 참고용 기록이며 조회 키로 쓰지 않는다 — 제공자 쪽에서 바뀔 수 있다.';

CREATE INDEX ix_user_identities_user ON shared.user_identities (user_id);
