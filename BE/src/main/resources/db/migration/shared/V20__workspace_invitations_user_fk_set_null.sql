-- workspace_invitations 의 사용자 참조 두 개에 ON DELETE SET NULL 을 건다.
--
-- V6 의 규칙은 "shared.users 를 참조하는 외래 키는 계정 삭제를 막지 않는다" 다(밀어내기 · 탈퇴 · 만료가 전부
-- DELETE FROM shared.users 다). V12 가 이 표를 만들면서 invited_by · accepted_by 의 삭제 규칙을 빠뜨렸다 —
-- 컬럼 주석은 "계정이 지워져도 초대는 남기려고 NULL 을 허용한다" 고 적어 두고 제약은 NO ACTION 이었다.
-- 그 결과 초대를 발급했거나 수락한 계정은 지울 수 없었다(2026-09-10 로컬 계정 삭제에서 확인).
--
-- CASCADE 가 아니라 SET NULL 인 이유: 이 표는 「어느 회사에 누가 언제 들어왔는가」 감사 이력이다. 계정이 사라져도
-- 행은 남아야 하고, 누가 했는지만 비운다. 같은 성격의 admin_audit_logs.actor_id · workspace_invite_links.created_by 가
-- 이미 SET NULL 이다. 데이터 변경은 없다.

ALTER TABLE shared.workspace_invitations DROP CONSTRAINT IF EXISTS fk_wi_invited_by;
ALTER TABLE shared.workspace_invitations ADD CONSTRAINT fk_wi_invited_by
    FOREIGN KEY (invited_by) REFERENCES shared.users (id) ON DELETE SET NULL;

ALTER TABLE shared.workspace_invitations DROP CONSTRAINT IF EXISTS fk_wi_accepted_by;
ALTER TABLE shared.workspace_invitations ADD CONSTRAINT fk_wi_accepted_by
    FOREIGN KEY (accepted_by) REFERENCES shared.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN shared.workspace_invitations.accepted_by IS '수락한 계정. 계정이 지워지면 NULL 이 되고 초대 행과 accepted_at 은 남는다.';
