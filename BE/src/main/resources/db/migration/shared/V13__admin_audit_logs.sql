-- 운영자 행위 기록.
--
-- 운영자는 고객 워크스페이스를 만들고 고치고 멈추고, 소속 없이 그 안에 들어갈 수도 있다
-- (V12 이후). 그 권한 자체는 필요한데, 누가 언제 무엇을 했는지 남지 않으면 사고가 났을 때
-- 되짚을 방법이 없다. 접근을 막는 것보다 기록을 남기는 것이 현실적인 통제다.
--
-- 애플리케이션 로그로는 부족하다. 로그는 보존 기간이 짧고, 운영자 콘솔에서 조회할 수 없고,
-- 포맷이 바뀌면 과거 기록을 읽지 못한다.
--
-- 행위자·대상 이름을 스냅샷으로 함께 저장한다. 정규화해서 조인만 걸어 두면, 나중에 회사명이
-- 바뀌거나 담당자가 퇴사해 계정이 지워졌을 때 "그때 무엇에 무슨 일이 있었는지" 가 사라진다.
-- 감사 기록은 그 시점의 사실을 그대로 들고 있어야 한다.

CREATE TABLE shared.admin_audit_logs (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    occurred_at   timestamp(6) with time zone NOT NULL,
    actor_id      uuid,
    actor_name    varchar(100)                NOT NULL,
    action        varchar(30)                 NOT NULL,
    workspace_id  bigint,
    target_schema varchar(63),
    target_name   varchar(200),
    detail        text,
    CONSTRAINT fk_aal_actor     FOREIGN KEY (actor_id)     REFERENCES shared.users (id) ON DELETE SET NULL,
    CONSTRAINT fk_aal_workspace FOREIGN KEY (workspace_id) REFERENCES shared.workspaces (id) ON DELETE SET NULL,
    CONSTRAINT ck_aal_action CHECK (action IN (
        'create', 'update', 'deactivate', 'activate', 'terminate', 'issue_link', 'enter'
    ))
);

-- 화면 기본 정렬이 시각 내림차순이다. id 를 함께 넣어 같은 시각의 순서를 고정한다 -
-- 없으면 페이지 경계에서 같은 행이 두 번 나오거나 빠진다.
CREATE INDEX ix_aal_occurred_at ON shared.admin_audit_logs (occurred_at DESC, id DESC);

-- 워크스페이스 상세에서 "이 회사에 무슨 일이 있었나" 를 볼 때 쓴다.
CREATE INDEX ix_aal_workspace ON shared.admin_audit_logs (workspace_id, occurred_at DESC);

COMMENT ON TABLE  shared.admin_audit_logs IS '운영자 행위 기록. 지우거나 고치지 않는다 - 고칠 수 있는 기록은 증적이 아니다.';
COMMENT ON COLUMN shared.admin_audit_logs.actor_id IS '행위한 운영자. 계정이 지워져도 기록은 남아야 해서 NULL 을 허용하고 이름은 따로 스냅샷으로 둔다.';
COMMENT ON COLUMN shared.admin_audit_logs.actor_name IS '행위 시점의 운영자 이름. 이후 이름이 바뀌어도 당시 기록은 그대로 둔다.';
COMMENT ON COLUMN shared.admin_audit_logs.action IS 'create·update·deactivate·activate·terminate·issue_link·enter. enter 는 운영자가 소속 없이 고객 워크스페이스에 진입한 것이다.';
COMMENT ON COLUMN shared.admin_audit_logs.target_schema IS '대상 테넌트 스키마 이름 스냅샷. 화면이 상세로 링크할 때 쓴다.';
COMMENT ON COLUMN shared.admin_audit_logs.detail IS '무엇이 어떻게 바뀌었는지 한 줄. 없으면 NULL.';
