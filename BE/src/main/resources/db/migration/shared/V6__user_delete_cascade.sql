-- 계정 삭제를 가능하게 한다.
--
-- 미확인 계정이 이메일 주소를 점유하지 못하게 하려면(SocialAccountLinker · AuthService#signUp)
-- 그 계정을 지울 수 있어야 한다. 지금은 users 를 참조하는 다섯 개 테이블의 외래 키에 삭제
-- 규칙이 없어서 DELETE 가 제약 위반으로 막힌다.
--
-- 애플리케이션에서 자식 행을 순서대로 지우는 방법도 있지만 쓰지 않는다. users 를 참조하는
-- 테이블이 늘어날 때마다 지우는 코드를 함께 고쳐야 하고, 한 곳을 빠뜨리면 그 흔적이 남은 채
-- 삭제가 실패한다. 규칙을 DB 에 두면 테이블이 늘어도 제약을 만들 때 함께 정해진다.
--
-- user_identities 는 V5 에서 이미 ON DELETE CASCADE 로 만들었다. 여기서 나머지를 맞춘다.
--
-- 세션·토큰·2단계 수단은 계정에 딸린 것이라 계정이 사라지면 함께 사라지는 것이 맞다.
-- 남겨 둘 이유가 있는 것은 하나도 없고, 남으면 주인 없는 세션이 된다.

ALTER TABLE shared.user_sessions
    DROP CONSTRAINT fk_user_sessions_user,
    ADD  CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id)
         REFERENCES shared.users (id) ON DELETE CASCADE;

ALTER TABLE shared.user_mfa_methods
    DROP CONSTRAINT fk_user_mfa_user,
    ADD  CONSTRAINT fk_user_mfa_user FOREIGN KEY (user_id)
         REFERENCES shared.users (id) ON DELETE CASCADE;

ALTER TABLE shared.user_tokens
    DROP CONSTRAINT fk_user_tokens_user,
    ADD  CONSTRAINT fk_user_tokens_user FOREIGN KEY (user_id)
         REFERENCES shared.users (id) ON DELETE CASCADE;

ALTER TABLE shared.mfa_challenges
    DROP CONSTRAINT fk_mfa_challenges_user,
    ADD  CONSTRAINT fk_mfa_challenges_user FOREIGN KEY (user_id)
         REFERENCES shared.users (id) ON DELETE CASCADE;

-- 회사 소속도 함께 지운다. 계정이 사라졌는데 소속만 남으면 회사의 멤버 목록에 주인 없는
-- 행이 뜬다.
--
-- 다만 이 경로로 지워지는 것은 이메일 확인이 끝나지 않은 계정뿐이고, 그런 계정은
-- SessionIssuer#nextStep 이 회사 선택 자체를 막기 때문에 실제로 소속이 있을 일이 없다.
-- 규칙을 넣어 두는 것은 나중에 "계정 탈퇴" 가 붙었을 때를 위해서다.
ALTER TABLE shared.user_workspace_memberships
    DROP CONSTRAINT fk_uwm_user,
    ADD  CONSTRAINT fk_uwm_user FOREIGN KEY (user_id)
         REFERENCES shared.users (id) ON DELETE CASCADE;
