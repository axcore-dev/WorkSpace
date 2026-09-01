-- 비밀번호 로그인 시도 제한.
--
-- 2단계 인증 코드는 mfa_challenges.attempts 로 5회에서 끊기는데, 그 앞단인 비밀번호는
-- 무제한이었다. 비밀번호 정책이 8~16자라도 시도 횟수가 열려 있으면 정책의 효과가 줄어든다.
--
-- 상태를 users 의 컬럼으로 두는 이유: 지금 답해야 하는 질문은 "이 계정이 몇 번 틀렸고
-- 잠겼는가" 하나뿐이다. 시도 이력을 감사 목적으로 남겨야 한다면 별도 테이블이 맞지만,
-- 그 요구가 생기기 전에 테이블을 먼저 만들면 로그인마다 조인이 하나 늘어난다.
--
-- IP 단위 제한은 여기에 담지 않는다. 계정 단위와 IP 단위는 저장 위치도 만료 방식도 달라서
-- (IP 는 짧은 TTL 의 캐시가 맞다) 같은 테이블에 섞으면 둘 다 어정쩡해진다.

ALTER TABLE shared.users
    ADD COLUMN failed_login_attempts integer NOT NULL DEFAULT 0;

ALTER TABLE shared.users
    ADD COLUMN locked_at timestamp(6) with time zone;

COMMENT ON COLUMN shared.users.failed_login_attempts IS '연속 비밀번호 실패 횟수. 로그인 성공·비밀번호 변경·재설정 시 0 으로 되돌린다. 잠긴 뒤에는 더 올리지 않는다.';
COMMENT ON COLUMN shared.users.locked_at IS '비밀번호 연속 실패로 잠긴 시각. NULL 이면 정상. 시간이 지나도 자동으로 풀리지 않으며 비밀번호 재설정으로만 해제된다.';

-- 부분 인덱스. 잠긴 계정은 전체 대비 극소수라 잠긴 행만 담는다.
-- 운영자가 "지금 잠긴 계정" 을 훑어볼 때 쓴다.
CREATE INDEX ix_users_locked ON shared.users (locked_at) WHERE locked_at IS NOT NULL;
