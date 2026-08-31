-- 워크스페이스 상세 — 운영자가 개설 화면에서 입력받는 것들.
--
-- 고객이 사업자번호로 검색해 직접 만드는 방식(PRD 2.2)을 쓰지 않기로 했다. 우리가 계약 정보를
-- 받아 대신 만들고 접속 링크를 보내는 방식이라, 개설 화면이 받는 값이 그대로 이 테이블의
-- 컬럼이 된다. (FE/app/(admin)/admin/new/page.tsx)
--
-- 스키마 이름에 영향을 주는 값은 하나도 없다. schema_name 은 여전히 id 에서만 나온다.

-- ---------------------------------------------------------------------------
-- 회사 정보
-- ---------------------------------------------------------------------------

ALTER TABLE shared.workspaces
    ADD COLUMN corp_number varchar(13),
    ADD COLUMN biz_type    varchar(100),
    ADD COLUMN biz_item    varchar(100),
    ADD COLUMN address     varchar(300),
    ADD COLUMN website     varchar(300),
    ADD COLUMN tax_email   varchar(255),
    ADD COLUMN memo        text,
    -- 담당 운영자. shared.users 를 가리키지 않고 이름만 둔다 — 퇴사·인수인계로 계정이 사라져도
    -- "누가 열었는가" 는 남아야 하고, 이 값으로 권한을 판단하지 않는다.
    ADD COLUMN operator_name varchar(100),
    -- 접속 링크를 받는 사람. 이 사람이 첫 관리자가 된다.
    ADD COLUMN link_contact_name  varchar(100),
    ADD COLUMN link_contact_email varchar(255),
    -- 평소 연락처. 링크는 여기로 가지 않는다 — 실무자가 링크를 받고 계약 연락은 다른 사람에게
    -- 가는 경우가 있어 둘을 나눈다.
    ADD COLUMN contact_name  varchar(100),
    ADD COLUMN contact_email varchar(255),
    ADD COLUMN contact_phone varchar(30),
    ADD COLUMN link_sent_at   timestamp(6) with time zone,
    ADD COLUMN link_opened_at timestamp(6) with time zone;

-- 하이픈을 뺀 13자리. 사업자번호와 같은 규칙이다.
ALTER TABLE shared.workspaces
    ADD CONSTRAINT ck_workspaces_corp_number CHECK (corp_number ~ '^[0-9]{13}$');

COMMENT ON COLUMN shared.workspaces.corp_number   IS '법인등록번호 13자리(하이픈 제거). 사업자번호와 달리 유일성 제약을 걸지 않는다 — 개인사업자는 없는 값이다.';
COMMENT ON COLUMN shared.workspaces.operator_name IS '이 회사를 담당하는 우리 쪽 운영자 이름. 표시용이며 권한 판단에 쓰지 않는다.';
COMMENT ON COLUMN shared.workspaces.link_contact_email IS '접속 링크가 나가는 주소. 이 사람이 첫 관리자가 된다.';
COMMENT ON COLUMN shared.workspaces.link_opened_at IS '접속 링크를 실제로 연 시각. NULL 이면 아직 열지 않았다 — 개설했는데 아무도 들어오지 않은 회사를 찾는 데 쓴다.';

-- ---------------------------------------------------------------------------
-- 참조 수신(CC)
-- ---------------------------------------------------------------------------
--
-- 발송 메일에 CC 로 들어가는 주소들. 개수가 정해지지 않아 컬럼으로 둘 수 없다.
-- text[] 대신 테이블로 두는 이유는 순서·중복 제약을 DB 에서 표현하기 위해서다.

CREATE TABLE shared.workspace_cc_emails (
    workspace_id bigint       NOT NULL,
    email        varchar(255) NOT NULL,
    CONSTRAINT pk_workspace_cc_emails PRIMARY KEY (workspace_id, email),
    CONSTRAINT fk_workspace_cc_emails_workspace FOREIGN KEY (workspace_id)
        REFERENCES shared.workspaces (id) ON DELETE CASCADE
);

COMMENT ON TABLE shared.workspace_cc_emails IS '개설·안내 메일의 참조 수신 주소. (workspace_id, email) 이 PK 라 같은 주소를 두 번 넣을 수 없다.';

-- ---------------------------------------------------------------------------
-- 사업장
-- ---------------------------------------------------------------------------
--
-- 본사 외 사업장. 본사 정보는 workspaces 에 그대로 있고 여기에 중복해 넣지 않는다.
--
-- 사업자번호가 본사와 같을 수 있다(종된 사업장). 그래서 유일성 제약을 걸지 않는다 —
-- shared.workspaces.biz_number 의 유일 제약은 "회사 하나가 두 번 개설되는 것" 을 막는
-- 장치이고, 여기는 그 회사 안의 목록이라 성격이 다르다.

CREATE TABLE shared.workspace_sites (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workspace_id bigint                      NOT NULL,
    name         varchar(200)                NOT NULL,
    biz_number   varchar(10),
    address      varchar(300),
    biz_type     varchar(100),
    biz_item     varchar(100),
    created_at   timestamp(6) with time zone NOT NULL,
    updated_at   timestamp(6) with time zone NOT NULL,
    CONSTRAINT fk_workspace_sites_workspace FOREIGN KEY (workspace_id)
        REFERENCES shared.workspaces (id) ON DELETE CASCADE,
    CONSTRAINT ck_workspace_sites_biz_number CHECK (biz_number ~ '^[0-9]{10}$')
);

CREATE INDEX ix_workspace_sites_workspace ON shared.workspace_sites (workspace_id);

COMMENT ON TABLE shared.workspace_sites IS '본사 외 사업장. 본사는 workspaces 의 컬럼이며 여기 들어가지 않는다.';
