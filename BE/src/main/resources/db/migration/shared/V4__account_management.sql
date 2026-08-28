-- 계정 관리 — 이메일 소유 확인 · 비밀번호 재설정 · 2단계 인증.
--
-- V2 가 만들어 둔 user_mfa_methods 는 "어떤 수단을 켰는가"만 들고 있다. 실제 로그인 도중의
-- 중간 상태(코드를 보냈고 아직 검증 전)를 담을 곳이 없어서 여기서 mfa_challenges 를 추가한다.
--
-- 이메일 인증과 비밀번호 재설정은 "메일로 보낸 일회용 토큰을 되받는다"는 점에서 같은 모양이라
-- 테이블 하나에 purpose 로 구분해 담는다. 두 장으로 나누면 발급·소비·만료 로직이 그대로
-- 복제된다.

-- ---------------------------------------------------------------------------
-- 이메일 소유 확인
-- ---------------------------------------------------------------------------

ALTER TABLE shared.users ADD COLUMN email_verified_at timestamp(6) with time zone;

COMMENT ON COLUMN shared.users.email_verified_at IS '이메일 소유가 확인된 시각. NULL 이면 미확인. 이메일을 바꾸면 다시 NULL 로 되돌린다.';

-- 이미 가입돼 있던 계정은 확인 절차를 거치지 않았다. NULL 로 두어 미확인으로 남긴다.
-- 소급해서 확인 처리하면 "확인했다"는 기록이 거짓이 된다.

-- ---------------------------------------------------------------------------
-- 메일로 보내는 일회용 토큰
-- ---------------------------------------------------------------------------

CREATE TABLE shared.user_tokens (
    id          uuid                        PRIMARY KEY,
    user_id     uuid                        NOT NULL,
    purpose     varchar(30)                 NOT NULL,
    token_hash  varchar(64)                 NOT NULL,
    expires_at  timestamp(6) with time zone NOT NULL,
    consumed_at timestamp(6) with time zone,
    created_at  timestamp(6) with time zone NOT NULL,
    CONSTRAINT ux_user_tokens_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_user_tokens_user       FOREIGN KEY (user_id) REFERENCES shared.users (id),
    CONSTRAINT ck_user_tokens_purpose    CHECK (purpose IN ('email_verification', 'password_reset'))
);

CREATE INDEX ix_user_tokens_user_purpose ON shared.user_tokens (user_id, purpose);

COMMENT ON TABLE  shared.user_tokens IS '메일 링크에 실리는 일회용 토큰. user_sessions 와 같은 규칙으로 원문 대신 해시만 저장한다.';
COMMENT ON COLUMN shared.user_tokens.token_hash IS '토큰 원문은 저장하지 않는다. SHA-256 hex 64자.';
COMMENT ON COLUMN shared.user_tokens.consumed_at IS '사용된 시각. 채워진 행은 다시 쓸 수 없다. 삭제하지 않고 남기는 이유는 재사용 시도를 만료와 구분하기 위해서다.';

-- ---------------------------------------------------------------------------
-- 2단계 인증 챌린지
-- ---------------------------------------------------------------------------

CREATE TABLE shared.mfa_challenges (
    id          uuid                        PRIMARY KEY,
    user_id     uuid                        NOT NULL,
    purpose     varchar(20)                 NOT NULL,
    method      varchar(20)                 NOT NULL,
    token_hash  varchar(64)                 NOT NULL,
    code_hash   varchar(255)                NOT NULL,
    attempts    integer                     NOT NULL DEFAULT 0,
    remember_me boolean                     NOT NULL DEFAULT false,
    expires_at  timestamp(6) with time zone NOT NULL,
    consumed_at timestamp(6) with time zone,
    created_at  timestamp(6) with time zone NOT NULL,
    CONSTRAINT ux_mfa_challenges_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_mfa_challenges_user       FOREIGN KEY (user_id) REFERENCES shared.users (id),
    CONSTRAINT ck_mfa_challenges_purpose    CHECK (purpose IN ('login', 'enrollment')),
    CONSTRAINT ck_mfa_challenges_method     CHECK (method IN ('totp', 'sms', 'email', 'webauthn')),
    CONSTRAINT ck_mfa_challenges_attempts   CHECK (attempts >= 0)
);

CREATE INDEX ix_mfa_challenges_user_id ON shared.mfa_challenges (user_id);

COMMENT ON TABLE  shared.mfa_challenges IS '비밀번호는 통과했지만 2단계가 남은 중간 상태. 이 행이 사는 동안에는 access·refresh 토큰이 발급되지 않는다.';
COMMENT ON COLUMN shared.mfa_challenges.purpose IS 'login = 로그인 도중의 2단계, enrollment = 수단을 켜면서 하는 소유 확인.';
COMMENT ON COLUMN shared.mfa_challenges.token_hash IS '클라이언트가 들고 있는 챌린지 토큰의 해시. 이 값과 코드 둘 다 맞아야 통과한다.';
COMMENT ON COLUMN shared.mfa_challenges.code_hash IS '메일로 보낸 6자리 코드의 해시. 자릿수가 짧아 SHA-256 으로는 전수 대입이 즉시 끝나므로 비밀번호와 같은 PasswordEncoder(BCrypt)를 쓴다. 접두어가 붙어 255자를 잡는다.';
COMMENT ON COLUMN shared.mfa_challenges.attempts IS '코드 오입력 횟수. 상한을 넘으면 챌린지를 폐기한다. 짧은 코드를 쓰는 이상 시도 횟수 제한이 실질적인 방어선이다.';
COMMENT ON COLUMN shared.mfa_challenges.remember_me IS '로그인 요청에 실려 온 "로그인 유지" 값. 2단계를 통과한 뒤 세션을 발급할 때 써야 해서 여기에 보관한다.';
