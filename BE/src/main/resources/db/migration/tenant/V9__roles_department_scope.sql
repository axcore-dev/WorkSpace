-- 직급(roles)을 권한 관리 화면 모델에 맞춘다 — 부서 소속 · 데이터 범위 · 금액 표시 · 연동 관리.
--
-- 화면(설정 › 회사 › 권한 관리)은 「부서 → 직급 → 권한」 3단이다. 직급은 부서에 속하고, 소유자만 부서가 없다(「전사」).
-- V1 의 roles 에는 부서 컬럼이 없어서 화면의 왼쪽 두 열을 저장할 곳이 없었다.
--
-- 결정(2026-09-08):
--   B. owner · member 는 고정(시스템) 직급이다. admin 은 소유자가 고치고 지울 수 있는 보통 직급이 된다 —
--      회사마다 관리자가 무엇을 하는지가 달라서 잠가 두면 쓸 수 없는 직급이 된다. 그래서 admin 의 is_system 을 내린다.
--   D. 데이터 범위 · 금액 표시는 컬럼만 만든다. 업무 데이터가 아직 없어 서버가 걸러 줄 대상이 없다. 도메인 API 가 생길 때 집행한다.
--
-- 회사 권한 세 가지의 자리:
--   is_admin                = 회사 설정(기능 · 부서 · 직급) 과 구성원을 다룬다     (화면 ws:settings)
--   can_invite              = 자기 권한 안에서 구성원을 부른다                   (화면 「구성원 초대 위임」)
--   can_manage_integrations = 워크스페이스 › 연동 을 바꾼다                      (화면 ws:integrations)
--
-- 이 파일에 스키마 이름을 적지 않는다(V1 규칙).

ALTER TABLE roles
    -- 직급이 남아 있는 부서는 지울 수 없다(RESTRICT). 부서만 지우고 직급을 떠돌게 두면 어느 부서에도 없는 직급이 생긴다.
    -- 화면의 deptDeletable 규칙을 DB 가 지킨다. 소유자는 NULL — 회사 전체를 갖는 자리라 부서로 묶이지 않는다.
    ADD COLUMN department_id           bigint,
    ADD COLUMN data_scope              varchar(10) NOT NULL DEFAULT 'own',
    ADD COLUMN show_amounts            boolean     NOT NULL DEFAULT false,
    ADD COLUMN can_manage_integrations boolean     NOT NULL DEFAULT false,
    ADD CONSTRAINT fk_roles_department FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE RESTRICT,
    ADD CONSTRAINT ck_roles_data_scope CHECK (data_scope IN ('all', 'dept', 'own'));

CREATE INDEX ix_roles_department ON roles (department_id);

-- 직급 이름은 회사 안에서 하나다. 화면이 부서와 직급을 이름으로 고르므로 같은 이름이 둘이면 어느 것을 골랐는지 알 수 없다.
CREATE UNIQUE INDEX ux_roles_name ON roles (name);

-- 기본 직급 보정. 소유자·관리자는 전체 범위 · 금액 표시 · 연동 관리.
UPDATE roles
   SET data_scope = 'all', show_amounts = true, can_manage_integrations = true, updated_at = now()
 WHERE code IN ('owner', 'admin');

-- admin 은 보통 직급이 된다(삭제 · 이름 변경 가능). owner · member 만 시스템으로 남는다.
UPDATE roles SET is_system = false, updated_at = now() WHERE code = 'admin';

COMMENT ON COLUMN roles.department_id           IS '소속 부서. NULL 은 부서 없음(소유자). 직급이 있는 부서는 지울 수 없다.';
COMMENT ON COLUMN roles.data_scope              IS '데이터 접근 범위 all · dept · own. 아직 서버가 집행하지 않는다 — 업무 데이터 API 가 생길 때 붙인다.';
COMMENT ON COLUMN roles.show_amounts            IS '단가 · 원가 · 매출 열을 볼 수 있는가. data_scope 와 같이 아직 집행하지 않는다.';
COMMENT ON COLUMN roles.can_manage_integrations IS '워크스페이스 › 연동 을 바꿀 수 있는가.';
COMMENT ON COLUMN roles.is_admin                IS '회사 설정(기능 · 부서 · 직급) 과 구성원을 다룰 수 있는가. 기능 탭 접근은 여기서 나오지 않고 role_module_grants 에서 나온다 — 소유자만 전부다.';
COMMENT ON COLUMN roles.is_system               IS '고정 직급(owner · member). 이름 · 부서를 바꾸거나 지울 수 없다. 권한은 소유자가 member 것만 고칠 수 있다.';
