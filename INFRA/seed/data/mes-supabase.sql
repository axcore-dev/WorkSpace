-- =====================================================================================================
-- MES 데모 — Supabase(Postgres) 에 "외부 고객사 MES" 역할로 올리는 스키마 + 시드.
--
-- 무엇인가: 프레스 생산라인의 MES 다. 제품설계의 금형 도면(26MSX-S03-20 = S03 OP20 (FO) LH 금형)으로
--          부품을 찍는 작업지시 · 공정 실적 · 설비 · 비가동 · 불량 · 센서 기록이 들어 있다. 도면 코드가
--          우리 제품설계와 같아서 AI 가 "이 도면(금형)으로 찍은 작업지시" 를 이을 수 있다.
--
-- 어떻게 올리나 (Supabase):
--   1. Supabase 대시보드 → SQL Editor → New query → 이 파일 전체를 붙여넣고 Run.
--      (한 번에 실행된다. 다시 돌리면 mes 스키마를 지우고 새로 만든다 — 아래 DROP 참고)
--   2. 맨 아래 「읽기 전용 롤」의 YOUR_PASSWORD 를 바꾼 뒤 실행한다. 그 롤이 우리 BE 가 붙는 계정이다.
--   3. Project Settings → Database → Connection string 에서 **Session pooler**(IPv4, 5432) 주소를 받아
--      user 를 mes_reader 로 바꿔 BE 의 .env 에 넣는다. Direct(6543/5432 db.xxx.supabase.co)는 IPv6 라
--      로컬 · 네이버클라우드에서 안 붙을 수 있다.
--   4. mes 스키마는 PostgREST 에 노출하지 않는다(API Settings → Exposed schemas 에 넣지 않음). JDBC 로만 읽는다.
--
-- 시드는 결정적이다(setseed). 같은 날 돌리면 같은 값이 나온다. 날짜는 실행 시점 기준 최근 120일이다.
-- =====================================================================================================

set time zone 'Asia/Seoul';   -- MES 관행대로 현지 시각을 timestamp(무 tz)로 저장한다

drop schema if exists mes cascade;
create schema mes;

-- ───────────────────────────────────────────── 마스터 ─────────────────────────────────────────────

-- 설비. kind 가 라우팅의 근거다(블랭킹 → BL, 성형/트리밍/피어싱 → PR, 검사 → INS).
create table mes.equipment (
  code          text primary key,
  name          text not null,
  kind          text not null,             -- BL 블랭킹 · PR 프레스 · WD 용접 · INS 검사
  line          text not null,             -- 1라인 · 2라인
  capacity_ton  int,                       -- 프레스 톤수
  status        text not null default '가동',   -- 가동 · 정지 · 정비중
  installed_on  date,
  maker         text
);

create table mes.workers (
  id     text primary key,
  name   text not null,
  team   text not null,                    -- A조 · B조
  role   text not null                     -- 반장 · 작업자 · 검사원
);

-- 제품 = 금형으로 찍는 프레스 부품. die_drawing_code 가 제품설계 도면번호와 같다.
create table mes.products (
  product_code      text primary key,
  name              text not null,
  die_drawing_code  text not null,
  customer          text not null,
  material          text not null,         -- 소재
  std_cycle_sec     numeric(6,1) not null, -- 표준 사이클(초/개)
  unit_weight_kg    numeric(6,3) not null
);

-- ───────────────────────────────────────────── 트랜잭션 ───────────────────────────────────────────

create table mes.work_orders (
  wo_no          text primary key,         -- WO-YYMM-NNN
  product_code   text not null references mes.products,
  planned_qty    int  not null,
  priority       text not null,            -- 긴급 · 보통 · 낮음
  status         text not null,            -- 대기 · 진행 · 완료 · 보류
  planned_start  date not null,
  planned_end    date not null,
  actual_start   timestamp,
  actual_end     timestamp,
  line           text not null,
  note           text,
  created_at     timestamp not null
);

-- 작업지시의 공정(라우팅). seq 순으로 흐른다.
create table mes.work_order_operations (
  id              bigserial primary key,
  wo_no           text not null references mes.work_orders,
  seq             int  not null,           -- 10 20 30 40 50
  process         text not null,           -- 블랭킹 · 성형 · 트리밍 · 피어싱 · 검사
  equipment_code  text not null references mes.equipment,
  status          text not null,           -- 대기 · 진행 · 완료
  started_at      timestamp,
  ended_at        timestamp,
  unique (wo_no, seq)
);

-- 공정 실적. 교대(주간/야간)마다 한 줄.
create table mes.production_results (
  id              bigserial primary key,
  wo_no           text not null references mes.work_orders,
  op_seq          int  not null,
  equipment_code  text not null references mes.equipment,
  worker_id       text not null references mes.workers,
  shift           text not null,           -- 주간 · 야간
  recorded_at     timestamp not null,
  good_qty        int not null,
  defect_qty      int not null,
  run_minutes     int not null
);

create table mes.downtime_events (
  id              bigserial primary key,
  equipment_code  text not null references mes.equipment,
  started_at      timestamp not null,
  ended_at        timestamp not null,
  reason_code     text not null,           -- BRK 고장 · CHG 금형교체 · MAT 자재대기 · QC 검사대기 · PM 예방정비 · PWR 정전
  reason          text not null,
  wo_no           text references mes.work_orders,
  note            text
);

-- 불량. 실적 한 줄에서 불량이 났으면 여기 한 줄(합계가 실적의 defect_qty 와 같다).
create table mes.defects (
  id              bigserial primary key,
  result_id       bigint not null references mes.production_results,
  wo_no           text not null,
  op_seq          int  not null,
  equipment_code  text not null,
  recorded_at     timestamp not null,
  defect_type     text not null,           -- 크랙 · 주름 · 버 · 스크래치 · 치수불량 · 소재불량
  qty             int  not null,
  cause           text,
  disposition     text not null            -- 폐기 · 재작업 · 특채
);

-- PLC/센서 시간별 기록(프레스 4대, 최근 14일).
create table mes.sensor_readings (
  id              bigserial primary key,
  equipment_code  text not null references mes.equipment,
  recorded_at     timestamp not null,
  load_pct        numeric(5,1) not null,   -- 부하율 %
  slide_temp_c    numeric(5,1) not null,   -- 슬라이드 온도
  vibration_mm_s  numeric(5,2) not null,   -- 진동
  strokes         int not null             -- 그 시간의 스트로크 수
);

create index on mes.work_order_operations (wo_no);
create index on mes.production_results (wo_no, op_seq);
create index on mes.production_results (equipment_code, recorded_at);
create index on mes.downtime_events (equipment_code, started_at);
create index on mes.defects (wo_no);
create index on mes.sensor_readings (equipment_code, recorded_at);

-- ───────────────────────────────────────────── 시드: 마스터 ───────────────────────────────────────

insert into mes.equipment (code, name, kind, line, capacity_ton, status, installed_on, maker) values
  ('BL-01',  '블랭킹 프레스 400t',   'BL',  '1라인', 400,  '가동',   '2019-03-12', '심팩'),
  ('PR-01',  '1호기 프레스 600t',    'PR',  '1라인', 600,  '가동',   '2018-07-02', '심팩'),
  ('PR-02',  '2호기 프레스 800t',    'PR',  '1라인', 800,  '가동',   '2020-01-20', '아이다'),
  ('PR-03',  '3호기 프레스 1000t',   'PR',  '2라인', 1000, '가동',   '2021-05-10', '아이다'),
  ('PR-04',  '4호기 트랜스퍼 1200t', 'PR',  '2라인', 1200, '가동',   '2022-11-01', '고마츠'),
  ('PR-05',  '5호기 프레스 400t',    'PR',  '2라인', 400,  '정비중', '2016-09-15', '심팩'),
  ('WD-01',  '스폿 용접기 1',        'WD',  '1라인', null, '가동',   '2019-03-12', '한국오바라'),
  ('WD-02',  '스폿 용접기 2',        'WD',  '2라인', null, '가동',   '2021-05-10', '한국오바라'),
  ('INS-01', '검사대 1 (3D 측정)',    'INS', '1라인', null, '가동',   '2020-06-01', '자이스'),
  ('INS-02', '검사대 2 (게이지)',     'INS', '2라인', null, '가동',   '2018-07-02', '자체');

insert into mes.workers (id, name, team, role) values
  ('W01', '김현수', 'A조', '반장'),   ('W02', '박지훈', 'A조', '작업자'), ('W03', '이서연', 'A조', '작업자'),
  ('W04', '최민재', 'A조', '작업자'), ('W05', '정다은', 'A조', '검사원'), ('W06', '한지우', 'A조', '작업자'),
  ('W07', '오세훈', 'B조', '반장'),   ('W08', '윤아름', 'B조', '작업자'), ('W09', '장민호', 'B조', '작업자'),
  ('W10', '서지원', 'B조', '작업자'), ('W11', '강예린', 'B조', '검사원'), ('W12', '임도현', 'B조', '작업자'),
  ('W13', '조은비', 'A조', '작업자'), ('W14', '신우진', 'B조', '작업자'), ('W15', '백승아', 'A조', '검사원'),
  ('W16', '문준혁', 'B조', '작업자');

insert into mes.products (product_code, name, die_drawing_code, customer, material, std_cycle_sec, unit_weight_kg) values
  ('P-S03-20L', 'S03 OP20 (FO) LH',  '26MSX-S03-20', '현대모비스', 'SPFC590 1.2t', 6.5, 1.840),
  ('P-S03-20R', 'S03 OP20 (FO) RH',  '26MSX-S03-21', '현대모비스', 'SPFC590 1.2t', 6.5, 1.840),
  ('P-S04-20L', 'S04 OP20 (FO) LH',  '26MSX-S04-20', '현대모비스', 'SPFC780 1.4t', 7.2, 2.310),
  ('P-S04-30L', 'S04 OP30 (TR) LH',  '26MSX-S04-30', '현대모비스', 'SPFC780 1.4t', 5.8, 2.120),
  ('P-S05-20L', 'S05 OP20 (DR) LH',  '26MSX-S05-20', '기아',       'SPCC 0.8t',    5.0, 0.960),
  ('P-S05-30L', 'S05 OP30 (TR) LH',  '26MSX-S05-30', '기아',       'SPCC 0.8t',    4.6, 0.910),
  ('P-S06-20R', 'S06 OP20 (FO) RH',  '26MSX-S06-20', '기아',       'SPFC590 1.0t', 6.0, 1.420),
  ('P-S07-40L', 'S07 OP40 (PI) LH',  '26MSX-S07-40', '현대모비스', 'SPFC980 1.6t', 8.1, 2.870);

-- ───────────────────────────────────────────── 시드: 작업지시 ─────────────────────────────────────

select setseed(0.42);

-- 60건. 최근 120일에 흩뿌리고, 계획 종료가 지났으면 완료 · 시작했으면 진행 · 아니면 대기. 5% 는 보류.
create temporary table gen_wo as
with base as (
  select n,
         (current_date - (floor(random() * 120))::int) as ps,
         (7 + floor(random() * 14))::int               as days,
         (array['P-S03-20L','P-S03-20R','P-S04-20L','P-S04-30L','P-S05-20L','P-S05-30L','P-S06-20R','P-S07-40L'])[1 + floor(random() * 8)] as product_code,
         (500 + 50 * floor(random() * 70))::int        as planned_qty,
         random() as r1, random() as r2
  from generate_series(1, 60) n
)
select n, ps, ps + days as pe, days, product_code, planned_qty, r1, r2,
       case when r1 < 0.85 then '보통' when r1 < 0.95 then '긴급' else '낮음' end as priority,
       case when r2 < 0.05 then '보류'
            when ps + days < current_date - 2 then '완료'
            when ps <= current_date then '진행'
            else '대기' end as status
from base;

insert into mes.work_orders (wo_no, product_code, planned_qty, priority, status, planned_start, planned_end, actual_start, actual_end, line, note, created_at)
select 'WO-' || to_char(ps, 'YYMM') || '-' || lpad((row_number() over (partition by to_char(ps, 'YYMM') order by ps, n))::text, 3, '0'),
       product_code, planned_qty, priority, status, ps, pe,
       case when status in ('완료', '진행') then ps + time '08:00' + (floor(r1 * 90) || ' minutes')::interval end,
       -- 완료는 계획 종료 -3 ~ +2 일에 끝난다. 약 1/3 이 지연(delayed) 으로 잡힌다
       case when status = '완료' then pe + ((floor(r2 * 6))::int - 3) + time '17:30' - (floor(r1 * 120) || ' minutes')::interval end,
       case when product_code in ('P-S04-20L', 'P-S04-30L', 'P-S07-40L') then '2라인' else '1라인' end,
       case when status = '보류' then '고객사 설변 대기' when priority = '긴급' then '납기 단축 요청' end,
       ps - interval '3 days' + time '14:00'
from gen_wo;

drop table gen_wo;

-- 공정 라우팅: 10 블랭킹(BL) → 20 성형(PR) → 30 트리밍(PR) → 40 피어싱(PR) → 50 검사(INS). 2라인 제품은 2라인 설비.
insert into mes.work_order_operations (wo_no, seq, process, equipment_code, status, started_at, ended_at)
select w.wo_no, r.seq, r.process, e.code,
       case when w.status = '완료' then '완료'
            when w.status = '진행' and r.idx <= w.done_ops then '완료'
            when w.status = '진행' and r.idx = w.done_ops + 1 then '진행'
            else '대기' end,
       case when w.status = '완료' or (w.status = '진행' and r.idx <= w.done_ops + 1)
            then w.actual_start + ((r.idx - 1) * w.span / 5) end,
       case when w.status = '완료' or (w.status = '진행' and r.idx <= w.done_ops)
            then w.actual_start + ((r.idx - 1) * w.span / 5) + (w.span / 5) * 0.9 end
from (
  select wo_no, status, line, actual_start,
         coalesce(actual_end, now()) - actual_start as span,
         floor(random() * 4)::int as done_ops
  from mes.work_orders
) w
cross join (values (1, 10, '블랭킹', 'BL'), (2, 20, '성형', 'PR'), (3, 30, '트리밍', 'PR'), (4, 40, '피어싱', 'PR'), (5, 50, '검사', 'INS')) as r(idx, seq, process, kind)
cross join lateral (
  select code from mes.equipment
   where kind = r.kind and (kind not in ('PR', 'INS') or line = w.line) and status <> '정비중'
   order by random() limit 1
) e
order by w.wo_no, r.seq;

-- ───────────────────────────────────────────── 시드: 실적 ─────────────────────────────────────────

-- 시작된 공정마다 날짜 × 교대(주간 · 야간)로 한 줄. 수량은 계획을 일수로 나눠 ±10% 흔든다. 불량 0~3%.
insert into mes.production_results (wo_no, op_seq, equipment_code, worker_id, shift, recorded_at, good_qty, defect_qty, run_minutes)
select o.wo_no, o.seq, o.equipment_code,
       (select id from mes.workers where role <> '검사원' or o.seq = 50 order by random() limit 1),
       s.shift,
       d.day + s.at,
       -- 진행 중인 공정은 아직 다 못 찍었다 — 계획의 절반 안팎만
       greatest(1, round(w.planned_qty::numeric / (o.ndays * 2) * (0.9 + random() * 0.2)
                         * case when o.status = '진행' then 0.35 + random() * 0.4 else 1 end))::int as good_qty,
       floor(w.planned_qty::numeric / (o.ndays * 2) * random() * 0.03)::int                     as defect_qty,
       (300 + floor(random() * 180))::int
from (
  select *, greatest(1, (coalesce(ended_at, now())::date - started_at::date) + 1) as ndays
  from mes.work_order_operations where started_at is not null
) o
join mes.work_orders w on w.wo_no = o.wo_no
cross join lateral generate_series(o.started_at::date, least(coalesce(o.ended_at, now())::date, current_date), interval '1 day') as d(day)
cross join (values ('주간', time '15:40'), ('야간', time '23:50')) as s(shift, at)
order by o.wo_no, o.seq, d.day, s.shift;

-- 불량은 실적에서 파생한다. 불량이 난 실적 한 줄 = 불량 한 줄(수량 같음). 유형은 공정에 따라 다르다.
insert into mes.defects (result_id, wo_no, op_seq, equipment_code, recorded_at, defect_type, qty, cause, disposition)
select r.id, r.wo_no, r.op_seq, r.equipment_code, r.recorded_at,
       case r.op_seq
         when 10 then (array['소재불량', '버', '치수불량'])[1 + floor(random() * 3)]
         when 20 then (array['크랙', '주름', '주름', '스크래치'])[1 + floor(random() * 4)]
         when 30 then (array['버', '치수불량', '스크래치'])[1 + floor(random() * 3)]
         when 40 then (array['치수불량', '버', '피어싱 누락'])[1 + floor(random() * 3)]
         else          (array['치수불량', '스크래치', '크랙'])[1 + floor(random() * 3)] end,
       r.defect_qty,
       (array['금형 마모', '소재 로트 편차', '윤활 부족', '셋업 불량', '이물 혼입', null])[1 + floor(random() * 6)],
       (array['폐기', '폐기', '재작업', '특채'])[1 + floor(random() * 4)]
from mes.production_results r
where r.defect_qty > 0;

-- ───────────────────────────────────────────── 시드: 비가동 ───────────────────────────────────────

-- 최근 60일, 220건. 사유별로 길이가 다르다. 진행 중이던 작업지시가 있으면 붙인다.
insert into mes.downtime_events (equipment_code, started_at, ended_at, reason_code, reason, wo_no, note)
select g.equipment_code, g.started_at, g.started_at + (g.minutes || ' minutes')::interval,
       g.reason_code,
       case g.reason_code when 'BRK' then '설비 고장' when 'CHG' then '금형 교체' when 'MAT' then '자재 대기'
                          when 'QC' then '검사 대기' when 'PM' then '예방 정비' else '정전' end,
       (select wo_no from mes.work_orders w
         where w.actual_start <= g.started_at and coalesce(w.actual_end, now()) >= g.started_at
         order by random() limit 1),
       case g.reason_code when 'BRK' then (array['유압 누유', '클러치 이상', '센서 오류', '슬라이드 밸런스 불량'])[1 + floor(random() * 4)]
                          when 'CHG' then '다음 작업지시 금형으로 교체' end
from (
  select eq.code as equipment_code,
         current_date - (floor(random() * 60))::int + time '06:00' + (floor(random() * 15 * 60) || ' minutes')::interval as started_at,
         rc.reason_code,
         case rc.reason_code when 'BRK' then 30 + floor(random() * 210) when 'CHG' then 20 + floor(random() * 70)
                             when 'MAT' then 10 + floor(random() * 50)  when 'QC'  then 10 + floor(random() * 35)
                             when 'PM'  then 60 + floor(random() * 120) else 5 + floor(random() * 25) end as minutes
  from generate_series(1, 220) n
  -- n 을 참조해야 행마다 다시 뽑는다. 참조가 없으면 플래너가 한 번만 평가해 전부 같은 설비가 된다
  cross join lateral (select code from mes.equipment where status <> '정비중' and n = n order by random() limit 1) eq
  cross join lateral (
    select (array['BRK', 'CHG', 'CHG', 'CHG', 'MAT', 'MAT', 'QC', 'PM', 'PWR'])[1 + floor(random() * 9)] as reason_code
     where n = n
  ) rc
) g
order by g.started_at;

-- ───────────────────────────────────────────── 시드: 센서 ─────────────────────────────────────────

-- 프레스 4대, 최근 14일, 시간 단위. 야간 02~05시는 부하가 낮다. PR-03 은 진동이 서서히 오른다(정비 예측 질문용).
insert into mes.sensor_readings (equipment_code, recorded_at, load_pct, slide_temp_c, vibration_mm_s, strokes)
select e.code, t.at,
       round((case when extract(hour from t.at) between 2 and 5 then 20 else 55 end + random() * 30)::numeric, 1),
       round((38 + random() * 12 + case when extract(hour from t.at) between 13 and 17 then 4 else 0 end)::numeric, 1),
       round((1.2 + random() * 0.8 + case when e.code = 'PR-03' then (14 - (current_date - t.at::date)) * 0.15 else 0 end)::numeric, 2),
       (case when extract(hour from t.at) between 2 and 5 then 120 else 380 end + floor(random() * 120))::int
from (values ('PR-01'), ('PR-02'), ('PR-03'), ('PR-04')) as e(code)
cross join generate_series(current_date - interval '13 days', now(), interval '1 hour') as t(at)
order by e.code, t.at;

-- ───────────────────────────────────────────── 뷰(AI 가 개념으로 읽기 좋은 모양) ──────────────────

-- 작업지시 진행률. produced 는 실적이 있는 마지막 공정의 양품 합(병목 기준).
create view mes.v_work_order_progress as
with op as (
  select wo_no, op_seq, sum(good_qty) good, sum(defect_qty) defect
  from mes.production_results group by wo_no, op_seq
),
last_op as (
  select distinct on (wo_no) wo_no, good from op order by wo_no, op_seq desc
)
select w.wo_no, w.product_code, p.name as product_name, p.die_drawing_code, w.status, w.priority, w.line,
       w.planned_qty,
       coalesce(l.good, 0) as produced_qty,
       coalesce((select sum(defect) from op where op.wo_no = w.wo_no), 0) as defect_qty,
       round(100.0 * coalesce(l.good, 0) / w.planned_qty, 1) as progress_pct,
       w.planned_start, w.planned_end, w.actual_start, w.actual_end,
       case when w.status = '완료' and w.actual_end::date > w.planned_end then true else false end as delayed
from mes.work_orders w
join mes.products p on p.product_code = w.product_code
left join last_op l on l.wo_no = w.wo_no;

-- 설비별 최근 30일 비가동 합계.
create view mes.v_equipment_downtime_30d as
select e.code as equipment_code, e.name, e.line, e.status,
       count(d.id) as events,
       coalesce(sum(extract(epoch from (d.ended_at - d.started_at)) / 60), 0)::int as downtime_minutes,
       coalesce(sum(case when d.reason_code = 'BRK' then extract(epoch from (d.ended_at - d.started_at)) / 60 end), 0)::int as breakdown_minutes
from mes.equipment e
left join mes.downtime_events d on d.equipment_code = e.code and d.started_at >= now() - interval '30 days'
group by e.code, e.name, e.line, e.status;

-- 공정 · 설비별 불량률(최근 30일).
create view mes.v_defect_rate_30d as
select r.op_seq, o.process, r.equipment_code,
       sum(r.good_qty) as good_qty, sum(r.defect_qty) as defect_qty,
       round(100.0 * sum(r.defect_qty) / nullif(sum(r.good_qty + r.defect_qty), 0), 2) as defect_rate_pct
from mes.production_results r
join (select distinct seq, process from mes.work_order_operations) o on o.seq = r.op_seq
where r.recorded_at >= now() - interval '30 days'
group by r.op_seq, o.process, r.equipment_code;

-- ───────────────────────────────────────────── 읽기 전용 롤(우리 BE 가 붙는 계정) ────────────────

-- YOUR_PASSWORD 를 바꾼다. 비밀번호는 여기 파일에 남기지 말고, BE 의 .env 에만 둔다.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'mes_reader') then
    create role mes_reader login password 'YOUR_PASSWORD';
  end if;
end $$;
grant usage on schema mes to mes_reader;
grant select on all tables in schema mes to mes_reader;
alter default privileges in schema mes grant select on tables to mes_reader;
alter role mes_reader set statement_timeout = '10s';   -- 고객 DB 에 부하를 주지 않게

-- ───────────────────────────────────────────── 확인 ───────────────────────────────────────────────

select 'equipment' t, count(*) from mes.equipment
union all select 'workers', count(*) from mes.workers
union all select 'products', count(*) from mes.products
union all select 'work_orders', count(*) from mes.work_orders
union all select 'work_order_operations', count(*) from mes.work_order_operations
union all select 'production_results', count(*) from mes.production_results
union all select 'defects', count(*) from mes.defects
union all select 'downtime_events', count(*) from mes.downtime_events
union all select 'sensor_readings', count(*) from mes.sensor_readings;
