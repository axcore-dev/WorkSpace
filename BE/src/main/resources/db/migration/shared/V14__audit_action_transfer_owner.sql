-- 운영자 감사 로그에 소유자 권한 이전(transfer_owner) 액션을 추가한다.
--
-- 담당자를 바꾸면 테넌트 스키마에서 owner 역할이 옮겨 간다. 이건 "회사 정보 수정" 과는 무게가 다른
-- 일이라 별도 액션으로 남긴다 — 누가 언제 어느 회사의 소유자를 누구에게 넘겼는지 한 줄로 찾을 수 있어야 한다.
-- 두 경로에서 기록된다: (1) 운영자가 담당자를 이미 멤버인 사람으로 바꿀 때, (2) 새 담당자가 초대를 수락할 때.
--
-- action 은 varchar(30) 이고 CHECK 로 값을 제한한다(V13). 값을 늘리려면 제약을 다시 만들어야 한다.
ALTER TABLE shared.admin_audit_logs DROP CONSTRAINT ck_aal_action;
ALTER TABLE shared.admin_audit_logs ADD CONSTRAINT ck_aal_action CHECK (action IN (
    'create', 'update', 'deactivate', 'activate', 'terminate', 'issue_link', 'enter', 'transfer_owner'
));
