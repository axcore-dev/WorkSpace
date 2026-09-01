-- 테넌트 스키마 1차 — 회원 · 조직 6 tables.
--
-- 이 경로(db/migration/tenant)의 파일은 **회사마다 한 벌씩** 적용된다. 부팅 때 도는
-- db/migration/shared 와 달리, 프로비저닝(신규 회사)과 순회 배포(기존 회사)가 같은 파일을
-- 쓴다. 그래서 "새로 만든 스키마만 구조가 다른" 사고가 나지 않는다.
-- (docs/db/schema-draft-v2.md — "신규 회사 프로비저닝")
--
-- **이 파일에 스키마 이름을 적지 않는다.** Flyway 가 대상 스키마를 search_path 로 잡아 주므로
-- 테이블 이름만 쓰면 그 회사 스키마 안에 만들어진다. ax_00001 처럼 박아 두면 한 회사에만
-- 적용되는 마이그레이션이 된다.
--
-- v1 대비 달라진 점은 workspace_id · organization_id 컬럼이 전부 사라진 것이다. 스키마 하나가
-- 곧 회사 하나라 모든 행이 이미 그 회사 것이고, 조인마다 붙이던 조건이 필요 없다.

-- ---------------------------------------------------------------------------
-- 역할
-- ---------------------------------------------------------------------------
--
-- 역할은 사람이 아니라 "사람 × 회사" 에 붙는다. 같은 사람이 A 사에서는 관리자, B 사에서는
-- 일반 구성원일 수 있다. 그 원칙이 여기서는 저절로 지켜진다 — role_id 가 shared.users 가
-- 아니라 이 스키마의 members 에 있기 때문이다.

CREATE TABLE roles (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code       varchar(50)                 NOT NULL,
    name       varchar(100)                NOT NULL,
    -- 관리자는 회사 설정과 구성원을 다룰 수 있다. 이 플래그를 가진 역할이 하나도 없으면
    -- 회사를 관리할 사람이 사라지므로, 마지막 관리자 회수는 애플리케이션이 막는다.
    is_admin   boolean                     NOT NULL DEFAULT false,
    can_invite boolean                     NOT NULL DEFAULT false,
    -- 기본 제공 역할. 이름은 바꿀 수 있어도 지울 수는 없다.
    is_system  boolean                     NOT NULL DEFAULT false,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    CONSTRAINT ux_roles_code CHECK (code ~ '^[a-z][a-z0-9_]*$')
);

CREATE UNIQUE INDEX ux_roles_code_unique ON roles (code);

COMMENT ON TABLE  roles IS '이 회사의 역할 정의. 스키마 전체가 한 회사라 회사 구분 컬럼이 없다.';
COMMENT ON COLUMN roles.is_system IS '기본 제공 역할. 이름·권한은 바꿀 수 있어도 삭제할 수 없다.';

-- ---------------------------------------------------------------------------
-- 부서
-- ---------------------------------------------------------------------------

CREATE TABLE departments (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       varchar(100)                NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);

CREATE UNIQUE INDEX ux_departments_name ON departments (name);

-- ---------------------------------------------------------------------------
-- 구성원
-- ---------------------------------------------------------------------------
--
-- user_id 는 shared.users 를 가리키는 **크로스 스키마 참조**다. 같은 데이터베이스 안이므로
-- FK 를 실제로 걸 수 있다. 이 방향(테넌트 → shared)만 가능하다 — 반대 방향은 대상 스키마가
-- 행마다 달라져 FK 로 표현할 수 없다.
--
-- shared.user_workspace_memberships 와 역할이 다르다. 그쪽은 "이 사람이 어느 스키마를 열 수
-- 있는가" 만 답하는 라우팅 인덱스이고, 진짜 소속 정보(역할·부서·직함)는 여기에 있다.
-- 로그인 시점에는 아직 어느 회사인지 몰라 이 테이블을 볼 수 없기 때문에 둘이 나뉘어 있다.

CREATE TABLE members (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id        uuid                        NOT NULL,
    role_id        bigint,
    department_id  bigint,
    title          varchar(100),
    status         varchar(20)                 NOT NULL DEFAULT 'active',
    last_active_at timestamp(6) with time zone,
    created_at     timestamp(6) with time zone NOT NULL,
    updated_at     timestamp(6) with time zone NOT NULL,
    CONSTRAINT fk_members_user       FOREIGN KEY (user_id)       REFERENCES shared.users (id) ON DELETE CASCADE,
    -- 역할·부서가 지워져도 구성원은 남아야 한다. 소속이 사라지는 것과 사람이 사라지는 것은
    -- 다르고, 여기서 CASCADE 를 걸면 역할 하나를 지우는 순간 그 역할의 사람들이 사라진다.
    CONSTRAINT fk_members_role       FOREIGN KEY (role_id)       REFERENCES roles (id)       ON DELETE SET NULL,
    CONSTRAINT fk_members_department FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE SET NULL,
    CONSTRAINT ck_members_status     CHECK (status IN ('active', 'invited', 'suspended', 'left'))
);

CREATE UNIQUE INDEX ux_members_user ON members (user_id);
CREATE INDEX ix_members_role        ON members (role_id);
CREATE INDEX ix_members_department  ON members (department_id);

COMMENT ON TABLE  members IS '이 회사의 구성원. user_id 는 shared.users 를 가리키는 크로스 스키마 참조다.';
COMMENT ON COLUMN members.user_id IS '한 사람이 이 회사에 두 번 들어올 수 없다(ux_members_user). 여러 회사에 속하는 것은 스키마가 달라 자연히 허용된다.';

-- ---------------------------------------------------------------------------
-- 기능 권한 — 3층 구조
-- ---------------------------------------------------------------------------
--
-- 유효 권한은 별도 테이블로 두지 않고 세 곳의 교집합으로 계산한다.
--
--   enabled_modules(회사가 켠 기능) ∩ role_module_grants(역할이 위임받은 범위)
--                                  ∩ member_module_grants(개인에게 부여된 기능)
--
-- enabled_modules 는 설정·연동 묶음이라 이 마이그레이션에 없다. 그때까지 유효 권한 계산은
-- 아래 두 테이블만 본다.

CREATE TABLE role_module_grants (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_id     bigint                      NOT NULL,
    module_slug varchar(50)                 NOT NULL,
    created_at  timestamp(6) with time zone NOT NULL,
    CONSTRAINT fk_rmg_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX ux_rmg_role_module ON role_module_grants (role_id, module_slug);

COMMENT ON TABLE role_module_grants IS '역할이 위임받은 기능 범위. 여기 없는 기능은 그 역할의 구성원에게 개별 부여해도 열리지 않는다.';

CREATE TABLE member_module_grants (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    member_id   bigint                      NOT NULL,
    module_slug varchar(50)                 NOT NULL,
    -- 누가 줬는가. 회수 이력을 따질 때 필요하다. 준 사람이 회사를 떠나도 기록은 남아야 해서
    -- SET NULL 이다.
    granted_by  bigint,
    created_at  timestamp(6) with time zone NOT NULL,
    CONSTRAINT fk_mmg_member     FOREIGN KEY (member_id)  REFERENCES members (id) ON DELETE CASCADE,
    CONSTRAINT fk_mmg_granted_by FOREIGN KEY (granted_by) REFERENCES members (id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX ux_mmg_member_module ON member_module_grants (member_id, module_slug);

-- ---------------------------------------------------------------------------
-- 초대에 담긴 기능
-- ---------------------------------------------------------------------------
--
-- invitation_id 는 shared.invitations 를 가리킨다. 초대는 아직 회사를 고르지 않은 사람에게
-- 나가므로 shared 에 있어야 하고, 그 초대에 어떤 기능을 담았는지는 회사 정보라 여기 있다.
--
-- 수락 시점에 이 행들이 member_module_grants 로 복사된다. 옮기지 않고 복사하는 이유는
-- "무엇을 약속했는가" 와 "무엇을 갖고 있는가" 가 나중에 달라질 수 있기 때문이다.

CREATE TABLE invitation_module_grants (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invitation_id uuid                        NOT NULL,
    module_slug   varchar(50)                 NOT NULL,
    created_at    timestamp(6) with time zone NOT NULL,
    CONSTRAINT fk_img_invitation FOREIGN KEY (invitation_id)
        REFERENCES shared.invitations (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX ux_img_invitation_module ON invitation_module_grants (invitation_id, module_slug);

COMMENT ON TABLE invitation_module_grants IS '초대에 담긴 기능 선택. 수락 시 member_module_grants 로 복사된다.';
