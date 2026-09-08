-- 설정 › 워크스페이스 › 연동 의 저장소. 화면의 두 섹션이 그대로 두 표다.
--
-- 1) external_systems — 「외부 시스템」. 회사의 ERP · MES · 센서 게이트웨이. 화면에서는 읽기만 한다
--    (운영팀이 붙여 준다). 그래서 여기에 쓰기 API 를 두지 않았다 — 행은 운영 콘솔 · 마이그레이션으로 들어온다.
-- 2) connected_services — 「외부 서비스」. AI 대화가 부를 수 있는 외부 앱(Slack · Notion · …) 중
--    이 회사가 연결해 둔 것. 카탈로그(어떤 앱이 있는가)는 코드에 있다(FE/data/chat.ts · BE ConnectorCatalog) —
--    enabled_features 와 같은 규칙이다. 여기에는 "연결했는가" 만 남는다.
--
-- 지금까지 두 섹션 모두 화면 안의 고정 데이터와 브라우저 localStorage 였다. 브라우저를 바꾸면 연결이
-- 사라졌고, 같은 회사의 다른 사람은 서로 다른 연결 상태를 봤다.
--
-- 이 파일에 스키마 이름을 적지 않는다(V1 규칙). AI 서버 역할(axcore_ai)에는 권한을 주지 않는다 —
-- AI 가 쓸 수 있는 앱은 introspect 응답으로 받는다.

CREATE TABLE external_systems (
    id         bigserial                   NOT NULL,
    -- 목록에 표시될 이름. 회사가 부르는 이름이다 ("본사 ERP" · "1공장 MES")
    name       varchar(100)                NOT NULL,
    -- 실제 제품 이름 ("더존비즈온 iCUBE")
    vendor     varchar(100)                NOT NULL,
    kind       varchar(20)                 NOT NULL,
    -- 접속 주소. 화면에 보이지 않는다 — 운영·점검용이다
    endpoint   varchar(500),
    status     varchar(20)                 NOT NULL DEFAULT 'ok',
    sort_order integer                     NOT NULL DEFAULT 0,
    created_at timestamp(6) with time zone NOT NULL DEFAULT now(),
    updated_at timestamp(6) with time zone NOT NULL DEFAULT now(),
    CONSTRAINT pk_external_systems PRIMARY KEY (id),
    -- 유형은 화면의 목록(CONNECTOR_TYPES)과 같다. 늘어나면 이 제약을 고친다
    CONSTRAINT ck_external_systems_kind CHECK (kind IN ('ERP', 'MES', 'PLM', 'QMS', 'WMS', 'CRM', '센서', '기타')),
    -- ok = 정상 · delayed = 지연 · down = 끊김. 배지 문구·색은 화면이 정한다
    CONSTRAINT ck_external_systems_status CHECK (status IN ('ok', 'delayed', 'down'))
);

COMMENT ON TABLE  external_systems IS '회사에 붙은 외부 시스템(ERP · MES · 센서). 화면에서는 읽기 전용이고 운영팀이 등록한다.';
COMMENT ON COLUMN external_systems.name     IS '목록에 표시될 이름. 회사가 부르는 이름.';
COMMENT ON COLUMN external_systems.vendor   IS '실제 제품 이름 (더존비즈온 iCUBE · 미라콤 MESplus …).';
COMMENT ON COLUMN external_systems.kind     IS '시스템 유형 (ERP · MES · 센서 …).';
COMMENT ON COLUMN external_systems.endpoint IS '접속 주소. 화면에 노출하지 않는다.';
COMMENT ON COLUMN external_systems.status   IS 'ok · delayed · down.';

CREATE TABLE connected_services (
    slug       varchar(50)                 NOT NULL,
    connected  boolean                     NOT NULL DEFAULT true,
    -- 마지막으로 바꾼 사람. 감사 로그가 생기기 전까지의 최소 기록이다. 계정이 지워져도 행은 남는다
    updated_by uuid,
    updated_at timestamp(6) with time zone NOT NULL,
    CONSTRAINT pk_connected_services PRIMARY KEY (slug),
    CONSTRAINT fk_connected_services_updated_by FOREIGN KEY (updated_by)
        REFERENCES shared.users (id) ON DELETE SET NULL,
    -- slug 는 코드의 카탈로그가 검증한다. 형태만 DB 가 본다
    CONSTRAINT ck_connected_services_slug CHECK (slug ~ '^[a-z][a-z0-9_-]*$')
);

COMMENT ON TABLE  connected_services IS '이 회사가 연결한 외부 서비스(커넥터) slug. 카탈로그는 코드(ConnectorCatalog)에 있다.';
COMMENT ON COLUMN connected_services.slug      IS 'FE/data/chat.ts CONNECTOR_LIB · BE ConnectorCatalog 의 slug (slack · notion · …).';
COMMENT ON COLUMN connected_services.connected IS '연결 해제는 행을 지우지 않고 false 로 남긴다 — 다시 연결할 때 누가 언제 껐는지 남는다.';
