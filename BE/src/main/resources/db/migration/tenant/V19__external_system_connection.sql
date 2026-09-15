-- 외부 시스템 접속 정보 — 테넌트별 MES 연동.
--
-- 지금까지 MES 접속은 서버 환경 변수(MES_DB_*) 하나였고 모든 회사가 같은 MES 를 봤다. 접속 정보를 이 표의 행으로
-- 옮겨 회사마다 자기 MES 를 갖게 한다. 행은 운영 콘솔(AdminExternalSystemService)이 넣는다 — V11 의 「운영팀이 등록」
-- 그대로다. AI 도구는 MesDataSourceRegistry 가 이 행으로 읽기 전용 풀을 회사별로 만든다.
--
-- 비밀번호는 평문으로 두지 않는다. 외부 서비스 토큰과 같은 키(CONNECTOR_TOKEN_KEY, TokenCipher AES-GCM)로 잠근다.
-- 화면에는 절대 내려보내지 않고 「있음/없음」만 알린다. `endpoint` 는 쓰지 않고 남겨 둔다.
ALTER TABLE external_systems
    ADD COLUMN host            varchar(255),
    ADD COLUMN port            integer     NOT NULL DEFAULT 5432,
    ADD COLUMN db_name         varchar(100),
    ADD COLUMN db_user         varchar(100),
    ADD COLUMN db_password_enc text,
    ADD COLUMN sslmode         varchar(20) NOT NULL DEFAULT 'require',
    ADD CONSTRAINT ck_external_systems_port CHECK (port BETWEEN 1 AND 65535),
    ADD CONSTRAINT ck_external_systems_sslmode CHECK (sslmode IN ('disable', 'require', 'verify-ca', 'verify-full'));

COMMENT ON COLUMN external_systems.host            IS 'DB 호스트. 비어 있으면 표시만 하는 시스템이고 접속하지 않는다.';
COMMENT ON COLUMN external_systems.db_name         IS 'DB 이름.';
COMMENT ON COLUMN external_systems.db_user         IS 'SELECT 만 가진 롤. Supabase 풀러는 롤.프로젝트ID 형식.';
COMMENT ON COLUMN external_systems.db_password_enc IS 'CONNECTOR_TOKEN_KEY 로 잠근 비밀번호. 화면에 내려보내지 않는다.';
COMMENT ON COLUMN external_systems.sslmode         IS 'JDBC sslmode.';
