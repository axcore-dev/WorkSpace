-- 내부 운영자 표시.
--
-- 워크스페이스는 고객이 직접 만들지 않고 우리가 만들어 준다. 그 API(/api/admin/**)를 부를 수
-- 있는 사람을 가릴 근거가 필요한데, shared.users 에는 역할 개념이 없었다.
--
-- 플래그 하나로 두는 이유: 지금 답해야 하는 질문은 "내부 사람인가 아닌가" 하나뿐이다.
-- 담당 등급·권한 범위처럼 값이 여럿이 되는 순간 별도 테이블로 옮기는 것이 맞지만, 그 전에
-- 테이블을 먼저 만들면 행이 하나뿐인 조인이 늘어난다.
--
-- 환경변수 이메일 목록으로 두지 않는다. 권한을 배포 설정으로 관리하게 되고, 추가·회수마다
-- 재배포가 필요하며, 누가 언제 받았는지가 어디에도 남지 않는다.

ALTER TABLE shared.users
    ADD COLUMN is_internal_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN shared.users.is_internal_admin IS '우리 쪽 운영자인가. /api/admin/** 접근 가부를 정한다. 고객 계정은 항상 false 이며, 이 값은 토큰이 아니라 요청 시점의 DB 에서 확인한다.';

-- 부분 인덱스. 운영자는 전체 계정 대비 극소수라 true 인 행만 담는다.
CREATE INDEX ix_users_internal_admin ON shared.users (id) WHERE is_internal_admin;
