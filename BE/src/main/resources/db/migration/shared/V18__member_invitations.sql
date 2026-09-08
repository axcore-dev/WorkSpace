-- 회사 관리자가 직원을 부르는 초대 — 이메일 초대에 직급·부서를 싣고, 누구나 쓸 수 있는 초대 링크를 만든다.
--
-- 지금까지 shared.workspace_invitations 는 우리 운영자가 계약 회사 담당자에게 보내는 접속 링크였다(V12). 수락하면
-- 담당자는 owner, 나머지는 admin 으로 들어갔다(TenantMemberWriter). 설정 › 회사 › 초대 관리 화면은 회사 관리자가
-- 직원을 직급·부서와 함께 부르는 것이라, 초대에 그 둘을 실어야 한다.
--
-- role_id · department_id 는 테넌트 스키마의 id 를 가리키는 역방향 크로스 스키마 참조다. 대상 스키마가 행마다 달라
-- FK 를 걸 수 없고, 수락 시점에 애플리케이션이 검증한다 — 직급이 그 사이 지워졌으면 member 로 들어간다.
-- (docs/db/schema-draft-v2.md 「크로스 스키마 참조」)

ALTER TABLE shared.workspace_invitations
    ADD COLUMN kind          varchar(10) NOT NULL DEFAULT 'operator',
    ADD COLUMN role_id       bigint,
    ADD COLUMN department_id bigint,
    ADD CONSTRAINT ck_wi_kind CHECK (kind IN ('operator', 'member'));

COMMENT ON COLUMN shared.workspace_invitations.kind          IS 'operator = 운영자가 담당자에게 보낸 접속 링크(수락자는 owner 또는 admin) · member = 회사 관리자가 직원에게 보낸 초대(role_id · department_id 로 들어간다)';
COMMENT ON COLUMN shared.workspace_invitations.role_id       IS 'member 초대가 부여할 테넌트 roles.id. FK 없음(스키마가 행마다 다름). 수락 때 없으면 member 직급.';
COMMENT ON COLUMN shared.workspace_invitations.department_id IS 'member 초대가 부여할 테넌트 departments.id. FK 없음. 수락 때 없으면 부서 없음.';

-- ---------------------------------------------------------------------------
-- 초대 링크 — 주소에 묶이지 않는다. 받은 사람 누구나 쓸 수 있으므로 한도와 만료가 유일한 안전장치다.
-- ---------------------------------------------------------------------------
--
-- 화면은 「무제한」 「만료 없음」 을 두지 않는다. 한 번 새어 나가면 회수할 방법이 그 링크를 지우는 것뿐인데,
-- 지우기 전까지 누구나 들어온다. DB 도 같은 한계를 둔다 — max_uses 는 1~50, expires_at 은 NOT NULL.
--
-- 수락은 use_count 를 UPDATE … WHERE use_count < max_uses RETURNING 한 문장으로 선점한다. 마지막 한 자리에
-- 두 명이 동시에 들어오면 둘 다 들어와서는 안 된다(도구 승인 게이트와 같은 이유).

CREATE TABLE shared.workspace_invite_links (
    id            uuid                        PRIMARY KEY,
    workspace_id  bigint                      NOT NULL,
    token_hash    varchar(64)                 NOT NULL,
    role_id       bigint                      NOT NULL,
    department_id bigint,
    max_uses      int                         NOT NULL,
    use_count     int                         NOT NULL DEFAULT 0,
    expires_at    timestamp(6) with time zone NOT NULL,
    revoked_at    timestamp(6) with time zone,
    created_by    uuid,
    created_at    timestamp(6) with time zone NOT NULL,
    CONSTRAINT ux_wil_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_wil_workspace  FOREIGN KEY (workspace_id) REFERENCES shared.workspaces (id),
    CONSTRAINT fk_wil_created_by FOREIGN KEY (created_by)   REFERENCES shared.users (id) ON DELETE SET NULL,
    CONSTRAINT ck_wil_max_uses   CHECK (max_uses BETWEEN 1 AND 50),
    CONSTRAINT ck_wil_use_count  CHECK (use_count BETWEEN 0 AND max_uses)
);

CREATE INDEX ix_wil_workspace ON shared.workspace_invite_links (workspace_id);

COMMENT ON TABLE  shared.workspace_invite_links IS '회사 관리자가 만든 초대 링크. 주소에 묶이지 않고 한도(max_uses)·만료로만 막는다. 토큰은 SHA-256 해시만 저장.';
COMMENT ON COLUMN shared.workspace_invite_links.role_id       IS '이 링크로 들어온 사람이 받는 테넌트 roles.id. FK 없음. 수락 때 없으면 member 직급.';
COMMENT ON COLUMN shared.workspace_invite_links.department_id IS '이 링크로 들어온 사람의 테넌트 departments.id. FK 없음. NULL 이면 부서 없음.';
COMMENT ON COLUMN shared.workspace_invite_links.use_count     IS '수락된 횟수. max_uses 에 닿으면 저절로 닫힌다.';
