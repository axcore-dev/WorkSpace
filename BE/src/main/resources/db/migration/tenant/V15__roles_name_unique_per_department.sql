-- 직급 이름은 부서 안에서만 유일하다.
--
-- V9 는 회사 전체에서 하나로 잡았다("화면이 부서와 직급을 이름으로 고르므로 같은 이름이 둘이면 어느 것을 골랐는지 알 수 없다").
-- 그런데 부서마다 같은 이름의 직급이 필요하다 — 생산팀의 「팀장」과 물류팀의 「팀장」은 서로 다른 직급이고 권한도 다르다.
-- 화면은 이미 직급을 id 로 고르고 부서 이름을 함께 보여 주므로 이름이 겹쳐도 어느 쪽인지 가릴 수 있다.
--
-- department_id 가 NULL 인 직급(소유자 · 관리자 · 구성원, 그리고 부서 없는 「전사」 직급)은 한 묶음으로 본다.
-- NULLS NOT DISTINCT 가 없으면 NULL <> NULL 이라 그 묶음에는 아무 제약도 걸리지 않는다. PostgreSQL 15 부터 쓸 수 있고
-- 이 저장소는 pg18 을 쓴다(INFRA/docker-compose.db.yml).
--
-- 기존 데이터는 회사 전체에서 유일했으므로 부서 단위로도 유일하다 — 이 마이그레이션으로 깨질 행이 없다.
-- 이 파일에 스키마 이름을 적지 않는다(V1 규칙).

DROP INDEX ux_roles_name;

CREATE UNIQUE INDEX ux_roles_dept_name ON roles (department_id, name) NULLS NOT DISTINCT;

COMMENT ON INDEX ux_roles_dept_name IS '직급 이름은 부서 안에서 하나. 부서 없는 직급(전사)끼리도 하나.';
