-- shared 스키마 2차 — 워크스페이스(회사) 레지스트리와 그 부속.
--
-- V1 은 엔티티가 이미 있던 users · user_sessions 두 장만 만들었다. 여기서 v2 설계의 나머지
-- 네 장을 채우고 user_sessions 에 workspace_id 를 붙인다. (docs/db/schema-draft-v2.md)
--
-- 이름에 대해: 설계 문서는 이 테이블을 tenants 로 적었지만 코드와 DB 는 workspaces 로 통일한다.
-- 스키마 이름 규칙이 'ax_' || lpad(workspaces.id, 5, '0') 이라 PK 를 가진 이 테이블이 곧
-- 워크스페이스다. tenant_id 계열 컬럼도 전부 workspace_id 로 맞춘다.

CREATE TABLE shared.workspaces (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    biz_number     varchar(10),
    schema_name    varchar(63),
    name           varchar(200)                NOT NULL,
    ceo_name       varchar(100),
    plan           varchar(30)                 NOT NULL DEFAULT 'free',
    status         varchar(20)                 NOT NULL DEFAULT 'provisioning',
    schema_version varchar(50),
    created_at     timestamp(6) with time zone NOT NULL,
    updated_at     timestamp(6) with time zone NOT NULL,
    CONSTRAINT ux_workspaces_schema_name   UNIQUE (schema_name),
    CONSTRAINT ux_workspaces_biz_number    UNIQUE (biz_number),
    -- 스키마 이름은 SET search_path 에 문자열로 조립되는 유일한 값이라 DB 에서도 형태를 막는다.
    -- 애플리케이션의 생성 시·사용 시 2단계 검증과 같은 정규식이다.
    CONSTRAINT ck_workspaces_schema_name   CHECK (schema_name ~ '^ax_[0-9]{5,}$'),
    CONSTRAINT ck_workspaces_biz_number    CHECK (biz_number ~ '^[0-9]{10}$'),
    CONSTRAINT ck_workspaces_status        CHECK (status IN ('provisioning', 'active', 'suspended', 'terminated')),
    -- schema_name 은 id 채번 뒤에야 정해지므로 INSERT 시점에는 비어 있다.
    -- 다만 active 로 넘어간 행에 비어 있으면 search_path 를 못 정하므로 그때는 필수다.
    CONSTRAINT ck_workspaces_active_schema CHECK (status = 'provisioning' OR schema_name IS NOT NULL)
);

COMMENT ON TABLE  shared.workspaces IS '회사 = 워크스페이스. 이 행의 id 가 테넌트 스키마 이름의 재료다.';
COMMENT ON COLUMN shared.workspaces.schema_name IS 'ax_ + lpad(id, 5, ''0''). 생성 후 불변. PK 로 계산 가능한 파생값이지만, 규칙이 바뀌어도 기존 스키마를 찾을 수 있어야 해서 저장한다.';
COMMENT ON COLUMN shared.workspaces.biz_number IS '사업자번호 10자리(하이픈 제거). 회사 식별 키. 스키마 이름에는 쓰지 않는다. NOT NULL 여부는 미결이라 지금은 NULL 을 허용한다.';
COMMENT ON COLUMN shared.workspaces.name IS '화면 표시용 상호. 자유롭게 변경 가능하며 스키마 이름에 영향을 주지 않는다.';

CREATE TABLE shared.user_workspace_memberships (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      uuid                        NOT NULL,
    workspace_id bigint                      NOT NULL,
    status       varchar(20)                 NOT NULL DEFAULT 'active',
    created_at   timestamp(6) with time zone NOT NULL,
    updated_at   timestamp(6) with time zone NOT NULL,
    CONSTRAINT ux_uwm_user_workspace UNIQUE (user_id, workspace_id),
    CONSTRAINT fk_uwm_user           FOREIGN KEY (user_id)      REFERENCES shared.users (id),
    CONSTRAINT fk_uwm_workspace      FOREIGN KEY (workspace_id) REFERENCES shared.workspaces (id),
    CONSTRAINT ck_uwm_status         CHECK (status IN ('active', 'invited', 'suspended', 'left'))
);

CREATE INDEX ix_uwm_user_id ON shared.user_workspace_memberships (user_id);

COMMENT ON TABLE shared.user_workspace_memberships IS '어느 스키마를 열어야 하는가만 답하는 라우팅 인덱스. 실제 역할·부서·모듈 권한은 테넌트 스키마의 members 에 있다.';

CREATE TABLE shared.user_mfa_methods (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     uuid                        NOT NULL,
    method      varchar(20)                 NOT NULL,
    enabled     boolean                     NOT NULL DEFAULT false,
    secret_ref  varchar(255),
    verified_at timestamp(6) with time zone,
    created_at  timestamp(6) with time zone NOT NULL,
    updated_at  timestamp(6) with time zone NOT NULL,
    CONSTRAINT ux_user_mfa_methods UNIQUE (user_id, method),
    CONSTRAINT fk_user_mfa_user    FOREIGN KEY (user_id) REFERENCES shared.users (id),
    CONSTRAINT ck_user_mfa_method  CHECK (method IN ('totp', 'sms', 'email', 'webauthn'))
);

COMMENT ON COLUMN shared.user_mfa_methods.secret_ref IS '비밀 저장소의 참조 키만 둔다. TOTP 시드 원문은 DB 에 저장하지 않는다.';

CREATE TABLE shared.invitations (
    id            uuid                        PRIMARY KEY,
    email         varchar(255)                NOT NULL,
    token_hash    varchar(64)                 NOT NULL,
    workspace_id  bigint                      NOT NULL,
    role_id       bigint,
    department_id bigint,
    status        varchar(20)                 NOT NULL DEFAULT 'pending',
    expires_at    timestamp(6) with time zone NOT NULL,
    accepted_at   timestamp(6) with time zone,
    created_at    timestamp(6) with time zone NOT NULL,
    CONSTRAINT ux_invitations_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_invitations_workspace  FOREIGN KEY (workspace_id) REFERENCES shared.workspaces (id),
    CONSTRAINT ck_invitations_status     CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))
);

CREATE INDEX ix_invitations_email        ON shared.invitations (email);
CREATE INDEX ix_invitations_workspace_id ON shared.invitations (workspace_id);

COMMENT ON COLUMN shared.invitations.token_hash IS '토큰 원문은 저장하지 않는다. SHA-256 hex 64자.';
COMMENT ON COLUMN shared.invitations.role_id IS '테넌트 스키마의 roles 를 가리키는 역방향 크로스 스키마 참조. 대상 스키마가 행마다 달라 FK 를 걸 수 없고 수락 시점에 애플리케이션이 검증한다.';

-- 회사 선택 전 상태를 표현하는 컬럼. V1 이 남겨둔 자리다.
ALTER TABLE shared.user_sessions
    ADD COLUMN workspace_id bigint,
    ADD CONSTRAINT fk_user_sessions_workspace FOREIGN KEY (workspace_id) REFERENCES shared.workspaces (id);

CREATE INDEX ix_user_sessions_workspace_id ON shared.user_sessions (workspace_id);

COMMENT ON COLUMN shared.user_sessions.workspace_id IS '선택된 회사. 로그인만 하고 아직 회사를 고르지 않은 상태가 있어 NULL 을 허용한다. 이 값으로 search_path 를 정하므로 전환 시점마다 user_workspace_memberships 를 재확인한다.';
