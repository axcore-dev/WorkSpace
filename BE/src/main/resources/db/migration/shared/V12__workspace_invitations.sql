-- 워크스페이스 초대.
--
-- 운영자가 계약 회사를 개설해도 그 회사 직원을 워크스페이스에 넣을 방법이 없었다.
-- user_workspace_memberships 에 행을 만드는 코드가 어디에도 없어서, DB 에 직접 INSERT 하지
-- 않는 한 아무도 진입하지 못했다. 그 자리를 메운다.
--
-- user_tokens 를 재사용하지 않는 이유: 그 테이블은 user_id 가 NOT NULL 이다. 초대는 아직
-- 가입하지 않은 사람에게도 보내야 해서 사용자에 매달 수 없다. 초대가 가리키는 것은
-- "워크스페이스 + 이메일 주소" 지 "사용자" 가 아니다.
--
-- 토큰은 해시로만 저장한다. 유출된 덤프만으로 남의 회사에 들어갈 수 있으면 안 된다.
-- user_tokens · user_sessions 와 같은 규칙이다.

CREATE TABLE shared.workspace_invitations (
    id           uuid                        PRIMARY KEY,
    workspace_id bigint                      NOT NULL,
    email        varchar(255)                NOT NULL,
    token_hash   varchar(64)                 NOT NULL,
    invited_by   uuid,
    expires_at   timestamp(6) with time zone NOT NULL,
    opened_at    timestamp(6) with time zone,
    accepted_at  timestamp(6) with time zone,
    accepted_by  uuid,
    revoked_at   timestamp(6) with time zone,
    created_at   timestamp(6) with time zone NOT NULL,
    CONSTRAINT ux_wi_token_hash  UNIQUE (token_hash),
    CONSTRAINT fk_wi_workspace   FOREIGN KEY (workspace_id) REFERENCES shared.workspaces (id),
    CONSTRAINT fk_wi_invited_by  FOREIGN KEY (invited_by)   REFERENCES shared.users (id),
    CONSTRAINT fk_wi_accepted_by FOREIGN KEY (accepted_by)  REFERENCES shared.users (id)
);

CREATE INDEX ix_wi_workspace ON shared.workspace_invitations (workspace_id);

-- 같은 회사·같은 주소로 살아 있는 초대는 하나뿐이다. 다시 보내면 이전 것을 회수하고 새로
-- 발급한다. 이 제약이 없으면 유효한 링크가 여러 장 돌아다니고, 회수해도 다른 장으로 들어온다.
CREATE UNIQUE INDEX ux_wi_pending
    ON shared.workspace_invitations (workspace_id, email)
    WHERE accepted_at IS NULL AND revoked_at IS NULL;

COMMENT ON TABLE  shared.workspace_invitations IS '워크스페이스 접속 링크. 수락되면 user_workspace_memberships 에 행이 생긴다.';
COMMENT ON COLUMN shared.workspace_invitations.email IS '초대 대상 주소(소문자 정규화). 수락하는 계정의 이메일과 일치해야 한다. 링크를 가진 것만으로는 들어갈 수 없다.';
COMMENT ON COLUMN shared.workspace_invitations.token_hash IS 'SHA-256 hex. 원문은 메일에만 존재한다.';
COMMENT ON COLUMN shared.workspace_invitations.invited_by IS '초대를 보낸 내부 운영자. 감사용이라 계정이 지워져도 초대는 남기려고 NULL 을 허용한다.';
COMMENT ON COLUMN shared.workspace_invitations.opened_at IS '링크를 처음 연 시각. workspaces.link_opened_at 과 함께 기록한다.';
COMMENT ON COLUMN shared.workspace_invitations.revoked_at IS '운영자가 회수했거나 재발송으로 밀려난 시각.';
