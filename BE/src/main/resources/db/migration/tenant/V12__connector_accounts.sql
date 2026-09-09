-- 외부 서비스에 연결한 계정 — 제공자별 토큰.
--
-- V11 의 connected_services 는 "이 앱을 쓰기로 했는가" 라는 깃발이다. 그 깃발이 진짜가 되려면 제공자가
-- 준 토큰이 있어야 한다. 토큰은 **앱이 아니라 제공자 단위**다 — Google Calendar · Drive · Sheets · Gmail 은
-- 구글 계정 하나에 스코프만 다르다. 그래서 표를 나눈다: 깃발은 앱마다(connected_services), 토큰은
-- 제공자마다(이 표). 앱이 "연결됨" 인 것은 깃발이 서 있고 제공자 계정이 그 앱의 스코프를 가졌을 때다.
--
-- 회사 단위다. 연동 권한이 있는 사람이 한 번 연결하면 구성원 모두가 쓴다(1차 결정). 개인 단위 연결이
-- 필요해지면 user_id 를 가진 표를 따로 둔다 — 이 표에 user_id 를 nullable 로 섞지 않는다.
--
-- **토큰은 암호화해 저장한다.** 평문을 DB 에 두지 않는다(schema-draft-v2 의 token_ref 원칙). 키는
-- 환경변수(CONNECTOR_TOKEN_KEY)에만 있고 DB 덤프만으로는 풀 수 없다. 외부 비밀 저장소가 생기면
-- 이 두 칸을 참조 키로 바꾼다.
--
-- 이 파일에 스키마 이름을 적지 않는다(V1 규칙). AI 서버 역할(axcore_ai)에는 권한을 주지 않는다 —
-- AI 는 토큰을 만지지 않고 BE 의 내부 엔드포인트를 부른다. 토큰이 BE 밖으로 나가지 않는 것이 규칙이다.

CREATE TABLE connector_accounts (
    provider          varchar(20)                 NOT NULL,
    access_token_enc  text                        NOT NULL,
    -- 구글만 준다. 슬랙·노션 토큰은 만료가 없다
    refresh_token_enc text,
    token_expires_at  timestamp(6) with time zone,
    -- 제공자가 실제로 승인한 스코프. 공백으로 나눈다. 앱마다 필요한 스코프는 코드(ConnectorCatalog)에 있다
    scopes            text                        NOT NULL DEFAULT '',
    -- 화면에 보여 줄 이름. 구글은 이메일, 슬랙은 팀 이름, 노션은 워크스페이스 이름
    external_account  varchar(255),
    -- 갱신이 실패했다. 토큰이 회수됐거나 비밀번호가 바뀐 경우다. 화면은 「다시 연결 필요」를 보인다
    needs_reconnect   boolean                     NOT NULL DEFAULT false,
    connected_by      uuid,
    connected_at      timestamp(6) with time zone NOT NULL,
    updated_at        timestamp(6) with time zone NOT NULL,
    CONSTRAINT pk_connector_accounts PRIMARY KEY (provider),
    CONSTRAINT fk_connector_accounts_connected_by FOREIGN KEY (connected_by)
        REFERENCES shared.users (id) ON DELETE SET NULL,
    CONSTRAINT ck_connector_accounts_provider CHECK (provider IN ('google', 'slack', 'notion'))
);

COMMENT ON TABLE  connector_accounts IS '외부 서비스 제공자별 토큰(암호화). 앱 단위 켜기/끄기는 connected_services 가 든다.';
COMMENT ON COLUMN connector_accounts.access_token_enc  IS 'AES-GCM 으로 암호화한 access 토큰. 키는 CONNECTOR_TOKEN_KEY.';
COMMENT ON COLUMN connector_accounts.refresh_token_enc IS '같은 방식으로 암호화한 refresh 토큰. 없는 제공자는 null.';
COMMENT ON COLUMN connector_accounts.scopes            IS '제공자가 승인한 스코프. 공백 구분. 앱이 쓸 수 있는지는 이 값 ⊇ 앱 요구 스코프 로 본다.';
COMMENT ON COLUMN connector_accounts.needs_reconnect   IS '토큰 갱신 실패. 사용자가 다시 연결해야 한다.';
