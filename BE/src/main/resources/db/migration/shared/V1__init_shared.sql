-- shared 스키마 초기화.
--
-- 이 위치(db/migration/shared)는 전역 테이블만 다룬다. 로그인 시점에는 아직 어느 회사인지
-- 모르기 때문에 계정·세션을 회사 스키마에 둘 수 없다. (docs/db/schema-draft-v2.md)
--
-- 회사 스키마용 마이그레이션은 회사 수만큼 순회해야 해서 부팅 경로에 두지 않는다.
-- db/migration/tenant 는 프로비저닝 러너와 함께 별도로 추가한다.
--
-- 여기서는 엔티티가 이미 있는 두 장만 만든다. 나머지 전역 테이블과 workspace_id 는 V2 가 붙인다.

CREATE SCHEMA IF NOT EXISTS shared;

CREATE TABLE shared.users (
    id                  uuid                        PRIMARY KEY,
    email               varchar(255)                NOT NULL,
    password_hash       varchar(255)                NOT NULL,
    name                varchar(100)                NOT NULL,
    avatar_url          varchar(500),
    password_changed_at timestamp(6) with time zone,
    last_login_at       timestamp(6) with time zone,
    created_at          timestamp(6) with time zone NOT NULL,
    updated_at          timestamp(6) with time zone NOT NULL,
    CONSTRAINT ux_users_email UNIQUE (email)
);

COMMENT ON COLUMN shared.users.email IS '항상 소문자. User.normalizeEmail 로 정규화한 뒤 저장한다.';
COMMENT ON COLUMN shared.users.password_hash IS 'DelegatingPasswordEncoder 형식({bcrypt}$2a$...). 평문은 어떤 형태로도 저장하지 않는다.';

CREATE TABLE shared.user_sessions (
    id         uuid                        PRIMARY KEY,
    user_id    uuid                        NOT NULL,
    token_hash varchar(64)                 NOT NULL,
    user_agent varchar(500),
    ip         varchar(45),
    expires_at timestamp(6) with time zone NOT NULL,
    revoked_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone NOT NULL,
    CONSTRAINT ux_user_sessions_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES shared.users (id)
);

CREATE INDEX ix_user_sessions_user_id ON shared.user_sessions (user_id);

COMMENT ON COLUMN shared.user_sessions.token_hash IS '토큰 원문은 저장하지 않는다. SHA-256 hex 64자.';
COMMENT ON COLUMN shared.user_sessions.ip IS 'IPv6 최대 표기 길이가 45자다.';
