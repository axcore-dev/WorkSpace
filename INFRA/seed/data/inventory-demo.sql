-- 재고·물류 데모 데이터. `FE/data/inventory-demo.ts` 를 그대로 옮긴 것이다.
--
-- **이 파일은 스키마를 열어 두고 실행해야 한다** — `seed-demo-inventory.sh` 가 `SET search_path` 를 먼저 한다.
-- 직접 psql 로 돌리지 않는다(어느 회사에 들어갈지 여기서는 정하지 않는다).
--
-- ── 날짜는 「오늘」에서 며칠 전인지로 잡는다 ─────────────────────────────────────────
-- FE 의 데모 데이터는 2026-07-08 을 「오늘」로 놓고 짠 표다(`DEMO_TODAY`). 그런데 화면이 서버에 붙으면
-- 「오늘」이 실제 날짜가 된다(`inventory-provider.tsx`: mode === "demo" ? DEMO_TODAY : todayIso()).
-- 그래서 원본 날짜를 그대로 넣으면 며칠만 지나도 발주가 전부 「기한 넘김 73일」로 새빨개진다 —
-- 기한 넘김 · 부분 입고 · 대기가 섞인 그림을 보여 주려고 만든 데이터인데 그림이 사라진다.
--
-- 그래서 `current_date - N` 으로 넣는다. N 은 원본에서 2026-07-08 기준 며칠 전이었는지 그대로다.
-- 발주번호의 연월(PO-YYMM-)도 옮겨진 발주일에서 뽑는다 — 번호와 날짜가 어긋나면 눈에 띈다.
-- 언제 시드하든 시연 화면이 같게 나온다.
--
-- 여러 번 돌려도 된다. 앞에서 이 회사의 재고 표를 비우고 다시 넣는다.

BEGIN;

-- 자식 → 부모 순서로 비운다. FK CASCADE 에 기대지 않는다 — 어느 표가 남는지 눈에 보이는 편이 낫다.
DELETE FROM inv_movements;
DELETE FROM inv_po_lines;
DELETE FROM inv_purchase_orders;
DELETE FROM inv_item_standards;
DELETE FROM inv_item_vendors;
DELETE FROM inv_items;
DELETE FROM inv_vendors;
DELETE FROM inv_settings;

-- 발주 여섯 건의 날짜와 번호. 아래 세 INSERT 가 이 표를 키(`p21` …)로 참조한다 —
-- 발주번호를 세 곳에 따로 적으면 하나만 고쳤을 때 조용히 어긋난다.
CREATE TEMP TABLE _po AS
SELECT key,
       (current_date - days)::date                                          AS ordered_on,
       'PO-' || to_char(current_date - days, 'YYMM') || '-' || suffix       AS po_no
  FROM (VALUES
          ('p21', 6, '0021'),   -- 원본 2026-07-02
          ('p22', 6, '0022'),   --      2026-07-02
          ('p23', 3, '0023'),   --      2026-07-05
          ('p24', 6, '0024'),   --      2026-07-02
          ('p25', 2, '0025'),   --      2026-07-06
          ('p18', 8, '0018')    --      2026-06-30
       ) AS v(key, days, suffix);

-- ─────────────────────────────────────────────── 거래처

INSERT INTO inv_vendors (id, name, kind, initial, lead_time_days, owner_name, active) VALUES
  ('v-powertec', 'POWERTEC',    'parts',       'PT',  5,    '구매 담당',  true),
  ('v-jinyang',  'JINYANG',     'outsourcing', 'JY',  7,    '구매 담당',  true),
  ('v-daesung',  '대성정공',      'parts',       'DS',  5,    '구매 담당',  true),
  ('v-kgs',      '한국가스스프링', 'parts',       'KG',  10,   '공구실 담당', true),
  ('v-mirae',    '미래베어링',    'parts',       'MB',  3,    '구매 담당',  true),
  -- 품목 수정 팝업의 「만들기」로 생긴 거래처 — 리드타임이 비어 있어 기한 넘김을 판단하지 않는다
  ('v-sinsung',  '신성금속',      'material',    'SS',  NULL, '구매 담당',  true),
  ('v-hanil',    '한일스프링',    'parts',       'HI',  7,    '구매 담당',  false),
  ('v-inhouse',  '자체 제작',     'inhouse',     '',    NULL, '생산 담당',  true);

-- ─────────────────────────────────────────────── 품목

INSERT INTO inv_items (code, name, spec, size_text, unit, category, location, discontinued) VALUES
  ('ITM-GS-0014', 'GAS SPRING',       'PX',    '1500-80-MH', 'EA', '금형 부품', '공구실 A-1',  false),
  ('ITM-GS-0015', 'GAS SPRING',       'PX',    '500-100-MH', 'EA', '금형 부품', '공구실 A-1',  false),
  ('ITM-GS-0016', 'GAS SPRING',       'PX',    '2400-80',    'EA', '금형 부품', '공구실 A-2',  false),
  ('ITM-GS-0021', 'GAS SPRING',       'MH',    '1500',       'EA', '금형 부품', '공구실 A-1',  false),
  ('ITM-GS-0022', 'GAS SPRING',       'MH',    '2500',       'EA', '금형 부품', '공구실 A-2',  false),
  ('ITM-WP-0003', 'WEAR PLATE',       'STW',   '38-100',     'EA', '금형 부품', '공구실 B-2',  false),
  ('ITM-WP-0004', 'WEAR PLATE',       'STW',   '28-100',     'EA', '금형 부품', '공구실 B-2',  false),
  ('ITM-GP-0007', 'GUIDE PIN',        'SGPH',  '20-120',     'EA', '금형 부품', '공구실 B-1',  false),
  ('ITM-GB-0004', 'GUIDE BUSH',       'SGBT',  '25-25',      'EA', '금형 부품', '공구실 B-1',  false),
  ('ITM-SP-0001', 'SPRING (D25이상)', 'SWF',   '12-50',      'EA', '금형 부품', '공구실 C-1',  false),
  ('ITM-GP-0032', 'GUIDE POST',       'MYKP',  'Φ32-140L',   'EA', '금형 부품', '공구실 A-3',  false),
  ('ITM-LP-0011', 'LIFT PIN',         'LP',    '10-58',      'EA', '금형 부품', '공구실 C-2',  false),
  ('ITM-GA-0005', 'GAUGE',            'HMD',   '20*65*35t',  'EA', '가공품',   '검사실',      false),
  ('PRT-BRG-608', '베어링 608ZZ',      'NSK',   '8×22×7',     'EA', '표준 부품', '자재창고 R-2', false),
  ('MAT-AL-6061', '알루미늄 합금 6061', 'T6',    '20mm',       'kg', '소재',     '자재창고 R-1', false),
  ('ITM-ER-0009', 'END RETAINER',     'DP-AN', '16',         'EA', '금형 부품', '공구실 D-1',  true);

-- 품목 ↔ 거래처. sort 0 이 기본 거래처다.
INSERT INTO inv_item_vendors (item_code, vendor_id, sort) VALUES
  ('ITM-GS-0014', 'v-kgs',      0),
  ('ITM-GS-0015', 'v-kgs',      0),
  ('ITM-GS-0016', 'v-kgs',      0),
  ('ITM-GS-0021', 'v-kgs',      0),
  ('ITM-GS-0021', 'v-hanil',    1),
  ('ITM-GS-0022', 'v-kgs',      0),
  ('ITM-WP-0003', 'v-daesung',  0),
  ('ITM-WP-0003', 'v-powertec', 1),
  ('ITM-WP-0004', 'v-daesung',  0),
  ('ITM-GP-0007', 'v-daesung',  0),
  ('ITM-GB-0004', 'v-daesung',  0),
  ('ITM-SP-0001', 'v-powertec', 0),
  ('ITM-GP-0032', 'v-powertec', 0),
  ('ITM-LP-0011', 'v-powertec', 0),
  ('ITM-GA-0005', 'v-jinyang',  0),
  ('ITM-GA-0005', 'v-inhouse',  1),
  ('PRT-BRG-608', 'v-mirae',    0),
  ('MAT-AL-6061', 'v-sinsung',  0),
  ('ITM-ER-0009', 'v-daesung',  0);

-- ─────────────────────────────────────────────── 발주

INSERT INTO inv_purchase_orders (po_no, ordered_on, vendor_id, project_code, drawing, rev, requester)
SELECT p.po_no, p.ordered_on, o.vendor_id, o.project_code, o.drawing, o.rev, o.requester
  FROM (VALUES
          ('p21', 'v-powertec', '26MSX-S03 OP20', '26MSX-S03-20', 'Rev.C', '구매 담당'),
          ('p22', 'v-jinyang',  '26MSX-S03 OP20', '26MSX-S03-20', 'Rev.C', '구매 담당'),
          ('p23', 'v-powertec', '26MSX-S04 OP20', '26MSX-S04-20', 'Rev.B', '구매 담당'),
          ('p24', 'v-jinyang',  '26MSX-S04 OP20', '26MSX-S04-20', 'Rev.B', '구매 담당'),
          ('p25', 'v-sinsung',  '26PNQ-S17 OP20', '26PNQ-S17-20', 'Rev.A', '구매 담당'),
          ('p18', 'v-daesung',  '26PNQ-S16 OP10', '26PNQ-S16-10', 'Rev.D', '구매 담당')
       ) AS o(key, vendor_id, project_code, drawing, rev, requester)
  JOIN _po p USING (key);

-- name_at_order 는 발주 시점 표기다. ITM-SP-0001 은 품목 마스터가 「SPRING (D25이상)」인데
-- 발주서에는 'SPRING-LIFT' 로 나갔다 — 스냅샷이 살아 있는지 보여 주는 자리라 그대로 둔다.
INSERT INTO inv_po_lines (po_no, line_no, item_code, name_at_order, spec_at_order, size_at_order, ordered, received, judgement, note, sort)
SELECT p.po_no, l.line_no, l.item_code, l.name_at_order, l.spec_at_order, l.size_at_order,
       l.ordered, l.received, l.judgement, l.note, l.sort
  FROM (VALUES
          ('p21', '30', 'ITM-GP-0032', 'GUIDE POST',       'MYKP', 'Φ32-140L',  4,   4, 'pass'::varchar, '',                                       0),
          ('p21', '31', 'ITM-SP-0001', 'SPRING-LIFT',      'SWF',  '12-50',     3,   2, 'pass',          '1 EA 미입고 — 업체 취합 대기',             1),
          ('p21', '32', 'ITM-LP-0011', 'LIFT PIN',         'LP',   '10-58',     3,   0, NULL,            '',                                       2),
          ('p22', '13', 'ITM-GA-0005', 'GAUGE',            'HMD',  '20*65*35t', 7,   7, 'pass',          'DETAIL 가공분',                           0),
          ('p23', '30', 'ITM-GP-0032', 'GUIDE POST',       'MYKP', 'Φ32-140L',  4,   0, NULL,            '',                                       0),
          ('p23', '31', 'ITM-SP-0001', 'SPRING-LIFT',      'SWF',  '12-50',     3,   0, NULL,            '',                                       1),
          ('p23', '32', 'ITM-LP-0011', 'LIFT PIN',         'LP',   '10-58',     3,   0, NULL,            '',                                       2),
          ('p24', '13', 'ITM-GA-0005', 'GAUGE',            'HMD',  '20*65*35t', 7,   4, 'pass',          '트럭 적재 중량 제한 — 3 EA 분할 입고 예정',   0),
          ('p25', '01', 'MAT-AL-6061', '알루미늄 합금 6061', 'T6',   '20mm',      600, 0, NULL,            '',                                       0),
          ('p18', '21', 'ITM-GP-0007', 'GUIDE PIN',        'SGPH', '20-120',    8,   8, 'pass',          '',                                       0)
       ) AS l(key, line_no, item_code, name_at_order, spec_at_order, size_at_order, ordered, received, judgement, note, sort)
  JOIN _po p USING (key);

-- ─────────────────────────────────────────────── 기준 (기초 재고 · 안전 재고)

-- 기초 재고 기준일. 원본은 2026-06-01 — 「오늘」에서 37일 전이다. 이 날 이후의 이력만 재고 계산에 들어간다.
INSERT INTO inv_item_standards (item_code, baseline, as_of, safety)
SELECT item_code, baseline, current_date - 37, safety
  FROM (VALUES
          ('ITM-GS-0014', 2,    NULL::integer),
          ('ITM-GS-0015', 0,    NULL),
          ('ITM-GS-0016', 0,    NULL),
          ('ITM-GS-0021', 29,   29),
          ('ITM-GS-0022', 33,   30),
          ('ITM-WP-0003', 7,    12),
          ('ITM-WP-0004', 16,   NULL),
          ('ITM-GP-0007', 4,    10),
          ('ITM-GB-0004', 6,    0),
          ('ITM-SP-0001', 1,    NULL),
          ('ITM-GP-0032', 0,    NULL),
          ('ITM-LP-0011', 0,    NULL),
          ('ITM-GA-0005', 0,    NULL),
          ('PRT-BRG-608', 8240, 10000),
          ('MAT-AL-6061', 3420, 4000),
          ('ITM-ER-0009', 3,    NULL)
       ) AS s(item_code, baseline, safety);

-- ─────────────────────────────────────────────── 입출고 이력

-- id 는 데모가 쓰던 값 그대로다('m-'). 서버가 새로 만드는 이력은 'mv-' 라 섞이지 않는다.
-- days 는 「오늘」에서 며칠 전, 시각은 원본 그대로다.
INSERT INTO inv_movements (id, moved_at, item_code, kind, qty, actor, ref, note, po_no, judgement)
SELECT m.id, (current_date - m.days) + m.tm, m.item_code, m.kind, m.qty, m.actor, m.ref, m.note,
       p.po_no, m.judgement
  FROM (VALUES
          ('m-0101', 5,  '10:20'::time, 'ITM-GP-0032', 'in',     4,  '검사 담당',  '26MSX-S03 OP20', '',                                       'p21'::varchar, 'pass'::varchar),
          ('m-0102', 5,  '10:20',       'ITM-SP-0001', 'in',     2,  '검사 담당',  '26MSX-S03 OP20', '1 EA 미입고 — 업체 취합 대기',             'p21',          'pass'),
          ('m-0103', 4,  '15:40',       'ITM-GA-0005', 'in',     7,  '검사 담당',  '26MSX-S03 OP20', 'DETAIL 가공분',                           'p22',          'pass'),
          ('m-0104', 2,  '09:10',       'ITM-GA-0005', 'in',     4,  '검사 담당',  '26MSX-S04 OP20', '트럭 적재 중량 제한 — 3 EA 분할 입고 예정', 'p24',          'pass'),
          ('m-0095', 8,  '14:20',       'ITM-GP-0007', 'in',     8,  '구매 담당',  '26PNQ-S16 OP10', '',                                       'p18',          'pass'),
          ('m-0094', 8,  '14:05',       'ITM-WP-0003', 'in',     4,  '구매 담당',  '26PNQ-S16 OP10', '',                                       NULL,           'pass'),
          ('m-0093', 8,  '11:40',       'ITM-GS-0015', 'in',     4,  '구매 담당',  '26PNQ-S17 OP20', '',                                       NULL,           'pass'),
          ('m-0092', 9,  '16:10',       'ITM-GS-0022', 'in',     2,  '공구실 담당', '26MSX-S03 OP20', '',                                       NULL,           'pass'),
          ('m-0091', 9,  '15:30',       'ITM-GS-0021', 'out',   -2,  '공구실 담당', '26MSX-S03 OP20', '',                                       NULL,           NULL),
          ('m-0090', 9,  '15:05',       'ITM-GS-0014', 'out',   -1,  '공구실 담당', '26MSX-S03 OP20', '',                                       NULL,           NULL),
          ('m-0089', 9,  '10:00',       'ITM-GS-0016', 'in',     1,  '구매 담당',  '26MSX-S04 OP20', '',                                       NULL,           'pass'),
          ('m-0088', 13, '09:00',       'ITM-WP-0004', 'adjust', -1, '공구실 담당', '실사 차이 반영',   '',                                       NULL,           NULL)
       ) AS m(id, days, tm, item_code, kind, qty, actor, ref, note, key, judgement)
  LEFT JOIN _po p ON p.key = m.key;

-- ─────────────────────────────────────────────── 회사 기준

INSERT INTO inv_settings (id, safety_method, avg_window_days, doc_rules) VALUES (
  true, 'manual', 30,
  -- 26MSX-S03 OP20 — 거래처 이니셜은 조각 후보에는 있으나 기본 순서에는 없다
  '{"codeSegments":["year","model","team","seq"],
    "separators":{"beforeTeam":"-","beforeOp":" "},
    "formats":{"material":["품명","규격","수량","비고"],
               "parts":["품명","호칭","규격","수량","비고"]},
    "processTags":["열처리","연마","도금","방전"]}'::jsonb
);

COMMIT;
