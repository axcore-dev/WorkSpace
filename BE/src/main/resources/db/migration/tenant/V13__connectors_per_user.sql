-- 외부 서비스 연결을 회사 단위에서 **사용자 단위**로 바꾼다.
--
-- V11 · V12 는 "연동 권한이 있는 사람이 한 번 연결하면 구성원 모두가 쓴다"(회사 단위)로 시작했다. 그런데 이 연결을
-- 쓰는 곳은 AI 대화이고, AI 는 각자 자기 메일·캘린더·드라이브를 두고 쓰는 개인 도구다. 회사 계정 하나를 전원이
-- 공유하면 남의 메일을 읽고, 한 사람이 끊으면 전원이 끊긴다.
--
-- 결정(2026-09-10):
--   - 토큰(connector_accounts)과 앱 켜기(connected_services) 둘 다 사용자마다 갖는다. 기본 키에 user_id 가 들어간다.
--   - 연결·해제·켜기는 자기 것만 만지므로 별도 권한이 필요 없다. roles.can_manage_integrations 는 그대로 두되
--     이 두 표에는 더 이상 걸리지 않는다.
--   - 기존 행은 연결한 사람(connected_by · updated_by) 것으로 옮긴다. 누가 연결했는지 모르는 행(계정 삭제로 null)은
--     지운다 — 주인 없는 토큰을 누구에게도 줄 수 없다.
--   - 사용자가 지워지면 연결도 함께 지운다(ON DELETE CASCADE). 제공자 쪽 토큰 회수는 애플리케이션이 계정 삭제 때 한다.
--
-- V12 의 "이 표에 user_id 를 nullable 로 섞지 않는다" 는 지킨다 — NOT NULL 이고 기본 키의 일부다.
-- 이 파일에 스키마 이름을 적지 않는다(V1 규칙).

-- ─────────────────────────────────────────────── connector_accounts: (provider) → (user_id, provider)

ALTER TABLE connector_accounts ADD COLUMN user_id uuid;
UPDATE connector_accounts SET user_id = connected_by;
DELETE FROM connector_accounts WHERE user_id IS NULL;
ALTER TABLE connector_accounts ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE connector_accounts DROP CONSTRAINT pk_connector_accounts;
ALTER TABLE connector_accounts ADD CONSTRAINT pk_connector_accounts PRIMARY KEY (user_id, provider);

ALTER TABLE connector_accounts DROP CONSTRAINT fk_connector_accounts_connected_by;
ALTER TABLE connector_accounts DROP COLUMN connected_by;
ALTER TABLE connector_accounts ADD CONSTRAINT fk_connector_accounts_user
    FOREIGN KEY (user_id) REFERENCES shared.users (id) ON DELETE CASCADE;

COMMENT ON TABLE  connector_accounts IS '사용자별 외부 서비스 제공자 토큰(암호화). 앱 단위 켜기/끄기는 connected_services 가 든다.';
COMMENT ON COLUMN connector_accounts.user_id IS '이 토큰의 주인(shared.users). 연결·해제·사용 전부 이 사람만 한다.';

-- ─────────────────────────────────────────────── connected_services: (slug) → (user_id, slug)

ALTER TABLE connected_services ADD COLUMN user_id uuid;
UPDATE connected_services SET user_id = updated_by;
DELETE FROM connected_services WHERE user_id IS NULL;
ALTER TABLE connected_services ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE connected_services DROP CONSTRAINT pk_connected_services;
ALTER TABLE connected_services ADD CONSTRAINT pk_connected_services PRIMARY KEY (user_id, slug);

ALTER TABLE connected_services DROP CONSTRAINT fk_connected_services_updated_by;
ALTER TABLE connected_services DROP COLUMN updated_by;
ALTER TABLE connected_services ADD CONSTRAINT fk_connected_services_user
    FOREIGN KEY (user_id) REFERENCES shared.users (id) ON DELETE CASCADE;

COMMENT ON TABLE  connected_services IS '사용자가 연결해 둔 외부 서비스(커넥터) slug 와 켜짐 여부. 카탈로그는 코드(ConnectorCatalog)에 있다.';
COMMENT ON COLUMN connected_services.user_id IS '이 앱을 연결한 사람(shared.users). 같은 앱도 사람마다 따로 켠다.';
