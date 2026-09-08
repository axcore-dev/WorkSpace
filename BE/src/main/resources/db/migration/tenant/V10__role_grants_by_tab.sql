-- 직급의 기능 권한을 모듈 단위에서 탭(서브기능) 단위로 내린다.
--
-- 화면의 권한은 「생산관리 전부」가 아니라 「모니터링 · 작업지시 · 보고 자동화」처럼 탭 하나하나다. 권한을 준다는 것은
-- 그 탭을 볼 수 있게 한다는 뜻이다(role-editor.tsx 「권한 = 탭 접근」). V1 의 role_module_grants 는 module_slug 만 있었다.
--
-- 기존 행은 지운다. 이 표에 INSERT 하는 코드가 지금까지 하나도 없었다(운영자 콘솔 · 초대 수락 어디에도) — 비어 있는 표라
-- 모듈 단위 행을 탭으로 펼치는 변환이 필요하지 않다. 만약 손으로 넣은 행이 있었다면 여기서 사라지고, 아래 관리자 심기가
-- 그 자리를 채운다.
--
-- 관리자(admin) 직급에는 탭 전부를 심는다. V10 전에는 is_admin 이면 모든 모듈이 열렸는데, 이제 기능 탭 접근은 이 표에서만
-- 나온다(ModuleAccessReader). 심지 않으면 배포 순간 기존 관리자가 모든 화면을 잃는다. 소유자는 심지 않는다 — 소유자는
-- 표를 보지 않고 전부다.
--
-- 아래 탭 목록은 FeatureCatalog(= FE/data/modules.ts) 의 2026-09-08 스냅샷이다. 카탈로그는 코드에 있고(결정 A) 이 목록은
-- 한 번 심는 데이터일 뿐이라 이후 카탈로그가 바뀌어도 이 파일은 고치지 않는다 — 새 탭은 소유자가 화면에서 켠다.

DELETE FROM role_module_grants;

ALTER TABLE role_module_grants ADD COLUMN subfunction_id varchar(50) NOT NULL DEFAULT '';
ALTER TABLE role_module_grants ALTER COLUMN subfunction_id DROP DEFAULT;
ALTER TABLE role_module_grants ADD CONSTRAINT ck_rmg_tab CHECK (subfunction_id ~ '^[a-z][a-z0-9_-]*$');

DROP INDEX ux_rmg_role_module;
CREATE UNIQUE INDEX ux_rmg_role_tab ON role_module_grants (role_id, module_slug, subfunction_id);

COMMENT ON TABLE  role_module_grants IS '직급이 볼 수 있는 기능 탭. 한 행이 탭 하나. 소유자(owner)는 이 표를 보지 않고 전부다.';
COMMENT ON COLUMN role_module_grants.subfunction_id IS '그 모듈 안의 탭 id (FeatureCatalog). 모듈 전체 = 그 모듈의 탭 전부를 행으로.';

INSERT INTO role_module_grants (role_id, module_slug, subfunction_id, created_at)
SELECT r.id, t.module_slug, t.subfunction_id, now()
  FROM roles r
 CROSS JOIN (VALUES
    ('management', 'hr'), ('management', 'payroll'), ('management', 'materials'), ('management', 'accounting'),
    ('design', 'drawings'), ('design', 'specs'), ('design', 'bom'),
    ('production', 'monitoring'), ('production', 'workorders'), ('production', 'bottleneck'), ('production', 'reporting'),
    ('equipment', 'predict'), ('equipment', 'maintenance'),
    ('quality', 'defects'), ('quality', 'control'),
    ('inventory', 'items'), ('inventory', 'stock'), ('inventory', 'safety'), ('inventory', 'receiving'),
    ('inventory', 'movements'), ('inventory', 'purchasing'),
    ('sales', 'orders'), ('sales', 'forecast'), ('sales', 'quotes'),
    ('support', 'tickets'), ('support', 'tracking'), ('support', 'voc')
 ) AS t (module_slug, subfunction_id)
 WHERE r.code = 'admin';
