-- user_sessions 를 refresh 토큰 저장소로 확정한다.
--
-- 인증 방식이 opaque 세션 토큰에서 JWT + refresh 로 정해졌다. access 토큰은 서명만으로
-- 검증되어 서버에 남지 않고, 여기 저장되는 것은 refresh 토큰의 해시뿐이다.
-- 테이블 자체는 그대로 쓴다. 원래도 "토큰 해시 · 만료 · 폐기" 구조라 refresh 에 그대로 맞는다.

ALTER TABLE shared.user_sessions
    -- 회전(rotation)으로 이 행을 대체한 세션. refresh 를 쓰면 그 자리에서 폐기하고 새 행을
    -- 발급한 뒤 그 id 를 여기 적는다. 값이 채워진 폐기 행에 같은 토큰이 다시 들어오면,
    -- 정상 클라이언트는 이미 새 토큰을 들고 있으므로 사본이 쓰인 것으로 보고 전량 폐기한다.
    -- 반대로 로그아웃·만료로 폐기된 행은 이 값이 비어 있어 단순 만료와 구분된다.
    ADD COLUMN rotated_to  uuid,
    -- 로그인 화면의 "로그인 유지" 체크값. (명세 2.1.2)
    -- 수명뿐 아니라 쿠키의 성격을 정한다. false 면 Max-Age 없는 세션 쿠키로 내려서 브라우저를
    -- 닫는 순간 사라지게 한다. 재발급 때도 같은 성격을 이어가려면 세션이 이 값을 들고 있어야 한다.
    ADD COLUMN remember_me boolean NOT NULL DEFAULT false;

-- 기본값은 기존 행을 채우기 위한 것이고, 이후로는 애플리케이션이 항상 명시해서 넣는다.
ALTER TABLE shared.user_sessions ALTER COLUMN remember_me DROP DEFAULT;

ALTER TABLE shared.user_sessions
    ADD CONSTRAINT fk_user_sessions_rotated_to
        FOREIGN KEY (rotated_to) REFERENCES shared.user_sessions (id);

COMMENT ON COLUMN shared.user_sessions.token_hash IS 'refresh 토큰 원문은 저장하지 않는다. SHA-256 hex 64자.';
COMMENT ON COLUMN shared.user_sessions.rotated_to IS '회전으로 이 행을 대체한 세션 id. 값이 있는 폐기 행에 같은 토큰이 다시 오면 재사용으로 본다.';
COMMENT ON COLUMN shared.user_sessions.remember_me IS '로그인 유지 여부. refresh 쿠키를 세션 쿠키로 낼지 Max-Age 를 붙일지를 정한다.';
