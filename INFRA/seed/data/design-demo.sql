-- 제품설계 데모 데이터 — 도면(리비전마다 한 행) · BOM. `FE/data/drawings.ts` 의 DRAWINGS 를 그대로 옮긴 것이다.
--
-- **이 파일은 스키마를 열어 두고 실행해야 한다** — `seed-demo-inventory.sh` 가 `SET search_path` 를 먼저 하고,
-- 재고 데이터(inventory-demo.sql) 다음에 넣는다. BOM 의 item_code 가 inv_items 를 가리키기 때문이다.
-- 직접 psql 로 돌리지 않는다.
--
-- 리비전 하나가 도면 하나다 — 옛 리비전도 자기 BOM 을 갖는다. 화면은 같은 도면번호 중 rev 가 가장 큰 행을 「지금 도면」으로 본다.
-- 매핑은 화면 시연 순서에 맞춰 두었다.
--   - 26MSX-S03-20 Rev.C 의 GAUGE 는 품목(ITM-GA-0005)이 있는데도 미매핑이다 — BOM 관리에서 눌러 맺는 것을 보여 준다.
--     그 전까지 이 도면으로는 발주서를 쓸 수 없다(재고·물류 발주서 작성이 막는다).
--   - HEIGHT BLOCK(현장 제작품) · BACKUP KEY 는 품목 마스터에 없어 미매핑이 정상이다.
--   - 26MSX-S03-20-P1 은 Rev.B 기준인데 원본이 Rev.C 라 「확인 필요」다.
-- 날짜는 고정이다. 도면 날짜는 기한 판단에 쓰이지 않아 재고처럼 상대값으로 둘 이유가 없다.
--
-- 여러 번 돌려도 된다. 앞에서 이 회사의 설계 표를 비우고 다시 넣는다.

BEGIN;

DELETE FROM dsg_bom_lines;
DELETE FROM dsg_drawings;

-- ─────────────────────────────────────────────── 원본 (파생이 parent_code · parent_rev 로 가리키므로 먼저)

INSERT INTO dsg_drawings (code, rev, name, vehicle, project_code, has_excel, author, status, change_note, requester, revised_on) VALUES
  ('26MSX-S03-20', 'Rev.A', 'S03 OP20 (FO) LH 조립도', '미창 SX3e 88528-XD010', '26MSX-S03 OP20', true, '설계 외주', 'approved', '최초 등록',                          '고객사(미창)', DATE '2026-06-11'),
  ('26MSX-S03-20', 'Rev.B', 'S03 OP20 (FO) LH 조립도', '미창 SX3e 88528-XD010', '26MSX-S03 OP20', true, '설계 외주', 'approved', '리프트 스프링 위치 12mm 이동',       '사내 설계',    DATE '2026-06-24'),
  ('26MSX-S03-20', 'Rev.C', 'S03 OP20 (FO) LH 조립도', '미창 SX3e 88528-XD010', '26MSX-S03 OP20', true, '설계 외주', 'approved', '가이드 포스트 Φ30 → Φ32 상향',      '고객사(미창)', DATE '2026-07-02'),
  ('26MSX-S04-20', 'Rev.A', 'S04 OP20 (FO) RH 조립도', '미창 SX3e 88628-XD010', '26MSX-S04 OP20', true, '설계 외주', 'approved', '최초 등록',                          '고객사(미창)', DATE '2026-06-15'),
  ('26MSX-S04-20', 'Rev.B', 'S04 OP20 (FO) RH 조립도', '미창 SX3e 88628-XD010', '26MSX-S04 OP20', true, '설계 외주', 'approved', 'S03 대칭 반영 (LH → RH)',            '사내 설계',    DATE '2026-07-02'),
  ('26PNQ-S16-10', 'Rev.A', 'S16 OP10 조립도',         '미창 PNQ 88512-XA010',  '26PNQ-S16 OP10', true, '설계 외주', 'approved', '최초 등록',                          '고객사(미창)', DATE '2026-05-08'),
  ('26PNQ-S16-10', 'Rev.B', 'S16 OP10 조립도',         '미창 PNQ 88512-XA010',  '26PNQ-S16 OP10', true, '설계 외주', 'approved', '백업 키 추가',                       '사내 설계',    DATE '2026-05-20'),
  ('26PNQ-S16-10', 'Rev.C', 'S16 OP10 조립도',         '미창 PNQ 88512-XA010',  '26PNQ-S16 OP10', true, '설계 외주', 'approved', '웨어 플레이트 규격 변경',            '사내 설계',    DATE '2026-06-02'),
  ('26PNQ-S16-10', 'Rev.D', 'S16 OP10 조립도',         '미창 PNQ 88512-XA010',  '26PNQ-S16 OP10', true, '설계 외주', 'approved', '가이드 핀 SGPH 20-120 수량 8 → 16', '고객사(미창)', DATE '2026-06-18'),
  ('26PNQ-S18-10', 'Rev.A', 'S18 OP10 조립도',         '미창 PNQ 88512-XA020',  '26PNQ-S18 OP10', true, '설계 외주', 'approved', '최초 등록',                          '고객사(미창)', DATE '2026-07-06');

-- ─────────────────────────────────────────────── 파생(가공도) — 근거 도면의 특정 리비전을 가리킨다

INSERT INTO dsg_drawings (code, rev, name, parent_code, parent_rev, has_excel, author, status, change_note, requester, revised_on) VALUES
  ('26MSX-S03-20-P1', 'Rev.A', 'S03 OP20 상형 가공도',          '26MSX-S03-20', 'Rev.B', true,  '설계 외주', 'approved',  '최초 등록',                 '사내 설계', DATE '2026-06-24'),
  ('26MSX-S03-20-P1', 'Rev.B', 'S03 OP20 상형 가공도',          '26MSX-S03-20', 'Rev.B', true,  '설계 외주', 'review',    '포켓 깊이 18 → 20 수정',    '사내 설계', DATE '2026-07-02'),
  ('26MSX-S03-20-P2', 'Rev.A', 'S03 OP20 하형 가공도',          '26MSX-S03-20', 'Rev.C', true,  '설계 외주', 'approved',  '최초 등록',                 '사내 설계', DATE '2026-06-30'),
  ('26MSX-S03-20-P0', 'Rev.A', 'S03 OP20 상형 가공도 (구버전)', '26MSX-S03-20', 'Rev.A', true,  '설계 외주', 'discarded', '최초 등록 — 기준면 오적용', '사내 설계', DATE '2026-06-24'),
  ('26MSX-S04-20-P1', 'Rev.A', 'S04 OP20 상형 가공도',          '26MSX-S04-20', 'Rev.B', false, '설계 외주', 'approved',  '최초 등록',                 '사내 설계', DATE '2026-07-01');

-- ─────────────────────────────────────────────── BOM (item_code 는 inv_items 를 가리킨다 — 재고 시드가 먼저 들어가 있어야 한다)

INSERT INTO dsg_bom_lines (drawing_code, drawing_rev, item_name, spec, size_text, qty, item_code, sort) VALUES
  -- 26MSX-S03-20 Rev.A · Rev.B — 가이드 포스트가 Φ30 이라 품목 마스터(Φ32)에 없다
  ('26MSX-S03-20', 'Rev.A', 'GUIDE POST',  'MYKP', 'Φ30-140L',  4, NULL,          0),
  ('26MSX-S03-20', 'Rev.A', 'SPRING-LIFT', 'SWF',  '12-50',     3, 'ITM-SP-0001', 1),
  ('26MSX-S03-20', 'Rev.A', 'LIFT PIN',    'LP',   '10-58',     3, 'ITM-LP-0011', 2),
  ('26MSX-S03-20', 'Rev.A', 'GAUGE',       'HMD',  '20*65*35t', 7, NULL,          3),
  ('26MSX-S03-20', 'Rev.B', 'GUIDE POST',  'MYKP', 'Φ30-140L',  4, NULL,          0),
  ('26MSX-S03-20', 'Rev.B', 'SPRING-LIFT', 'SWF',  '12-50',     3, 'ITM-SP-0001', 1),
  ('26MSX-S03-20', 'Rev.B', 'LIFT PIN',    'LP',   '10-58',     3, 'ITM-LP-0011', 2),
  ('26MSX-S03-20', 'Rev.B', 'GAUGE',       'HMD',  '20*65*35t', 7, NULL,          3),
  -- 26MSX-S03-20 Rev.C — 지금 도면. GAUGE 는 시연용 미매핑
  ('26MSX-S03-20', 'Rev.C', 'GUIDE POST',  'MYKP', 'Φ32-140L',  4, 'ITM-GP-0032', 0),
  ('26MSX-S03-20', 'Rev.C', 'SPRING-LIFT', 'SWF',  '12-50',     3, 'ITM-SP-0001', 1),
  ('26MSX-S03-20', 'Rev.C', 'LIFT PIN',    'LP',   '10-58',     3, 'ITM-LP-0011', 2),
  ('26MSX-S03-20', 'Rev.C', 'GAUGE',       'HMD',  '20*65*35t', 7, NULL,          3),
  -- 파생 — 현장 제작
  ('26MSX-S03-20-P1', 'Rev.A', 'UPPER HEIGHT BLOCK', 'S45C', 'Φ40-95L', 2, NULL, 0),
  ('26MSX-S03-20-P1', 'Rev.B', 'UPPER HEIGHT BLOCK', 'S45C', 'Φ40-95L', 2, NULL, 0),
  ('26MSX-S03-20-P2', 'Rev.A', 'LOWER HEIGHT BLOCK', 'S45C', 'Φ40-95L', 2, NULL, 0),
  -- 26MSX-S04-20
  ('26MSX-S04-20', 'Rev.A', 'GUIDE POST',  'MYKP', 'Φ32-140L',  4, 'ITM-GP-0032', 0),
  ('26MSX-S04-20', 'Rev.A', 'SPRING-LIFT', 'SWF',  '12-50',     3, 'ITM-SP-0001', 1),
  ('26MSX-S04-20', 'Rev.A', 'LIFT PIN',    'LP',   '10-58',     3, 'ITM-LP-0011', 2),
  ('26MSX-S04-20', 'Rev.A', 'GAUGE',       'HMD',  '20*65*35t', 7, 'ITM-GA-0005', 3),
  ('26MSX-S04-20', 'Rev.B', 'GUIDE POST',  'MYKP', 'Φ32-140L',  4, 'ITM-GP-0032', 0),
  ('26MSX-S04-20', 'Rev.B', 'SPRING-LIFT', 'SWF',  '12-50',     3, 'ITM-SP-0001', 1),
  ('26MSX-S04-20', 'Rev.B', 'LIFT PIN',    'LP',   '10-58',     3, 'ITM-LP-0011', 2),
  ('26MSX-S04-20', 'Rev.B', 'GAUGE',       'HMD',  '20*65*35t', 7, 'ITM-GA-0005', 3),
  -- 26PNQ-S16-10 — Rev.B 에서 백업 키가 붙고, Rev.C 에서 웨어 플레이트가 38-100 으로, Rev.D 에서 가이드 핀이 16 으로
  ('26PNQ-S16-10', 'Rev.A', 'GUIDE PIN',  'SGPH',  '20-120',     8, 'ITM-GP-0007', 0),
  ('26PNQ-S16-10', 'Rev.A', 'WEAR PLATE', 'STW',   '28-100',    14, 'ITM-WP-0004', 1),
  ('26PNQ-S16-10', 'Rev.A', 'GAS SPRING', 'PX',    '1500-80-MH', 4, 'ITM-GS-0014', 2),
  ('26PNQ-S16-10', 'Rev.B', 'GUIDE PIN',  'SGPH',  '20-120',     8, 'ITM-GP-0007', 0),
  ('26PNQ-S16-10', 'Rev.B', 'WEAR PLATE', 'STW',   '28-100',    14, 'ITM-WP-0004', 1),
  ('26PNQ-S16-10', 'Rev.B', 'GAS SPRING', 'PX',    '1500-80-MH', 4, 'ITM-GS-0014', 2),
  ('26PNQ-S16-10', 'Rev.B', 'BACKUP KEY', 'SKD11', '20*20*80',   2, NULL,          3),
  ('26PNQ-S16-10', 'Rev.C', 'GUIDE PIN',  'SGPH',  '20-120',     8, 'ITM-GP-0007', 0),
  ('26PNQ-S16-10', 'Rev.C', 'WEAR PLATE', 'STW',   '38-100',    14, 'ITM-WP-0003', 1),
  ('26PNQ-S16-10', 'Rev.C', 'GAS SPRING', 'PX',    '1500-80-MH', 4, 'ITM-GS-0014', 2),
  ('26PNQ-S16-10', 'Rev.C', 'BACKUP KEY', 'SKD11', '20*20*80',   2, NULL,          3),
  ('26PNQ-S16-10', 'Rev.D', 'GUIDE PIN',  'SGPH',  '20-120',    16, 'ITM-GP-0007', 0),
  ('26PNQ-S16-10', 'Rev.D', 'WEAR PLATE', 'STW',   '38-100',    14, 'ITM-WP-0003', 1),
  ('26PNQ-S16-10', 'Rev.D', 'GAS SPRING', 'PX',    '1500-80-MH', 4, 'ITM-GS-0014', 2),
  ('26PNQ-S16-10', 'Rev.D', 'BACKUP KEY', 'SKD11', '20*20*80',   2, NULL,          3),
  -- 26PNQ-S18-10
  ('26PNQ-S18-10', 'Rev.A', 'GUIDE PIN',  'SGPH', '20-120', 16, 'ITM-GP-0007', 0),
  ('26PNQ-S18-10', 'Rev.A', 'WEAR PLATE', 'STW',  '28-100', 20, 'ITM-WP-0004', 1),
  ('26PNQ-S18-10', 'Rev.A', 'GAS SPRING', 'MH',   '1500',   30, 'ITM-GS-0021', 2);

-- ─────────────────────────────────────────────── 기능 켜기
-- 제품설계는 기본 OFF 모듈이다(FeatureCatalog.DEFAULT_ON 에 없다). 시연 계정에서 사이드바에 보이려면 켜 둔다.
-- 소유자는 직급 권한을 보지 않으므로 role_module_grants 는 건드리지 않는다.

INSERT INTO enabled_features (module_slug, subfunction_id, enabled, updated_at) VALUES
  ('design', 'drawings', true, now()),
  ('design', 'bom',      true, now())
ON CONFLICT (module_slug, subfunction_id) DO UPDATE SET enabled = true, updated_at = now();

COMMIT;
