-- =====================================================================================================
-- ERP 데모 — Supabase(Postgres) 에 "외부 고객사 ERP(경영지원)" 역할로 올리는 스키마 + 시드.
--
-- 무엇인가: 경영지원 모듈의 세 탭(인사 · 급여 · 회계)에 대응하는 데이터다. 부서 · 직원 · 근태 · 휴가 · 월 급여 · 계정과목 ·
--          전표 · 전표 라인 · 부서별 예산. 한 회사(한빛제철) 기준으로 직원 32명, 최근 120일 근태, 최근 4개월 급여 · 전표.
--
-- 표 · 컬럼마다 COMMENT 를 달았다. 운영 콘솔의 「DB 에서 초안 만들기」가 주석을 개념 이름 · 속성 라벨로 그대로 쓰므로,
-- 이 스키마는 초안이 처음부터 한글로 나온다 — 주석 없는 MES 데모와 대조하는 용도로도 쓴다.
--
-- 어떻게 올리나 (Supabase):
--   1. SQL Editor → New query → 이 파일 전체를 붙여넣고 Run. (다시 돌리면 erp 스키마를 지우고 새로 만든다)
--   2. 맨 아래 「읽기 전용 롤」의 YOUR_PASSWORD 를 바꾼다. 이미 mes_reader 가 있으면 그 롤에도 SELECT 를 준다 —
--      운영 콘솔에 ERP 시스템을 등록할 때 같은 계정(mes_reader.<프로젝트ID>)을 써도 된다.
--   3. 운영 콘솔 › 워크스페이스 › 연동 › 「등록」: 종류 ERP · 호스트(Session pooler) · DB postgres · 사용자 · 비밀번호
--      → 「연결 테스트」 → 온톨로지 「DB 에서 초안 만들기」 → 스키마 erp → 표 체크 → 접두어 erp_ · 권한 탭 경영지원.
--   4. erp 스키마는 PostgREST 에 노출하지 않는다(API Settings → Exposed schemas 에 넣지 않음). JDBC 로만 읽는다.
--
-- 시드는 결정적이다(setseed). 같은 날 돌리면 같은 값이 나온다. 날짜는 실행 시점 기준이다.
-- =====================================================================================================

set time zone 'Asia/Seoul';

drop schema if exists erp cascade;
create schema erp;

-- ───────────────────────────────────────────── 마스터 ─────────────────────────────────────────────

create table erp.departments (
    code        text primary key,
    name        text not null,
    parent_code text references erp.departments(code),
    head_emp_no text,
    cost_center text not null
);
comment on table  erp.departments is '부서';
comment on column erp.departments.code is '부서 코드';
comment on column erp.departments.name is '부서 이름';
comment on column erp.departments.parent_code is '상위 부서 코드';
comment on column erp.departments.head_emp_no is '부서장 사번';
comment on column erp.departments.cost_center is '코스트센터';

create table erp.employees (
    emp_no          text primary key,
    name            text not null,
    department_code text not null references erp.departments(code),
    position        text not null,
    job_title       text,
    employment_type text not null,
    hire_date       date not null,
    resign_date     date,
    status          text not null,
    email           text,
    phone           text
);
comment on table  erp.employees is '직원';
comment on column erp.employees.emp_no is '사번';
comment on column erp.employees.name is '이름';
comment on column erp.employees.department_code is '부서 코드';
comment on column erp.employees.position is '직급(사원 · 대리 · 과장 · 차장 · 부장 · 이사)';
comment on column erp.employees.job_title is '직책(팀장 · 파트장 등)';
comment on column erp.employees.employment_type is '고용 형태(정규직 · 계약직)';
comment on column erp.employees.hire_date is '입사일';
comment on column erp.employees.resign_date is '퇴사일';
comment on column erp.employees.status is '재직 상태(재직 · 휴직 · 퇴직)';
comment on column erp.employees.email is '이메일';
comment on column erp.employees.phone is '연락처';

create table erp.accounts (
    code text primary key,
    name text not null,
    kind text not null
);
comment on table  erp.accounts is '계정과목';
comment on column erp.accounts.code is '계정 코드';
comment on column erp.accounts.name is '계정 이름';
comment on column erp.accounts.kind is '구분(자산 · 부채 · 자본 · 수익 · 비용)';

-- ───────────────────────────────────────────── 트랜잭션 ───────────────────────────────────────────

create table erp.attendance (
    id           bigserial primary key,
    emp_no       text not null references erp.employees(emp_no),
    work_date    date not null,
    clock_in     time,
    clock_out    time,
    overtime_min int  not null default 0,
    status       text not null,
    unique (emp_no, work_date)
);
comment on table  erp.attendance is '근태';
comment on column erp.attendance.id is '기록 id';
comment on column erp.attendance.emp_no is '사번';
comment on column erp.attendance.work_date is '근무일';
comment on column erp.attendance.clock_in is '출근 시각';
comment on column erp.attendance.clock_out is '퇴근 시각';
comment on column erp.attendance.overtime_min is '연장 근무 분';
comment on column erp.attendance.status is '근태 상태(정상 · 지각 · 조퇴 · 휴가 · 결근)';

create table erp.leaves (
    id         bigserial primary key,
    emp_no     text not null references erp.employees(emp_no),
    kind       text not null,
    start_date date not null,
    end_date   date not null,
    days       numeric(4,1) not null,
    status     text not null,
    reason     text
);
comment on table  erp.leaves is '휴가';
comment on column erp.leaves.id is '휴가 id';
comment on column erp.leaves.emp_no is '사번';
comment on column erp.leaves.kind is '종류(연차 · 반차 · 병가 · 경조 · 공가)';
comment on column erp.leaves.start_date is '시작일';
comment on column erp.leaves.end_date is '종료일';
comment on column erp.leaves.days is '일수';
comment on column erp.leaves.status is '상태(승인 · 대기 · 반려)';
comment on column erp.leaves.reason is '사유';

create table erp.payroll_runs (
    id           bigserial primary key,
    pay_month    text not null,
    emp_no       text not null references erp.employees(emp_no),
    base_pay     int  not null,
    overtime_pay int  not null default 0,
    bonus        int  not null default 0,
    deductions   int  not null default 0,
    net_pay      int  not null,
    paid_on      date,
    status       text not null,
    unique (pay_month, emp_no)
);
comment on table  erp.payroll_runs is '월 급여';
comment on column erp.payroll_runs.id is '급여 id';
comment on column erp.payroll_runs.pay_month is '급여 월(YYYY-MM)';
comment on column erp.payroll_runs.emp_no is '사번';
comment on column erp.payroll_runs.base_pay is '기본급(원)';
comment on column erp.payroll_runs.overtime_pay is '연장 수당(원)';
comment on column erp.payroll_runs.bonus is '상여(원)';
comment on column erp.payroll_runs.deductions is '공제 합계(원, 4대보험 · 소득세)';
comment on column erp.payroll_runs.net_pay is '실지급액(원)';
comment on column erp.payroll_runs.paid_on is '지급일';
comment on column erp.payroll_runs.status is '상태(확정 · 지급완료 · 작성중)';

create table erp.vouchers (
    voucher_no      text primary key,
    voucher_date    date not null,
    kind            text not null,
    description     text not null,
    department_code text not null references erp.departments(code),
    counterparty    text,
    amount          int  not null,
    status          text not null,
    created_by      text not null references erp.employees(emp_no),
    approved_by     text references erp.employees(emp_no),
    created_at      timestamp not null default now()
);
comment on table  erp.vouchers is '전표';
comment on column erp.vouchers.voucher_no is '전표 번호(V-YYMM-NNNN)';
comment on column erp.vouchers.voucher_date is '전표 일자';
comment on column erp.vouchers.kind is '종류(입금 · 출금 · 대체)';
comment on column erp.vouchers.description is '적요';
comment on column erp.vouchers.department_code is '귀속 부서 코드';
comment on column erp.vouchers.counterparty is '거래처';
comment on column erp.vouchers.amount is '금액(원)';
comment on column erp.vouchers.status is '상태(승인 · 대기 · 반려)';
comment on column erp.vouchers.created_by is '작성자 사번';
comment on column erp.vouchers.approved_by is '승인자 사번';
comment on column erp.vouchers.created_at is '작성 시각';

create table erp.voucher_lines (
    id           bigserial primary key,
    voucher_no   text not null references erp.vouchers(voucher_no) on delete cascade,
    line_no      int  not null,
    account_code text not null references erp.accounts(code),
    debit        int  not null default 0,
    credit       int  not null default 0,
    memo         text
);
comment on table  erp.voucher_lines is '전표 라인(분개)';
comment on column erp.voucher_lines.id is '라인 id';
comment on column erp.voucher_lines.voucher_no is '전표 번호';
comment on column erp.voucher_lines.line_no is '라인 순번';
comment on column erp.voucher_lines.account_code is '계정 코드';
comment on column erp.voucher_lines.debit is '차변(원)';
comment on column erp.voucher_lines.credit is '대변(원)';
comment on column erp.voucher_lines.memo is '메모';

create table erp.budgets (
    id              bigserial primary key,
    year_month      text not null,
    department_code text not null references erp.departments(code),
    account_code    text not null references erp.accounts(code),
    amount          int  not null,
    unique (year_month, department_code, account_code)
);
comment on table  erp.budgets is '부서 예산';
comment on column erp.budgets.id is '예산 id';
comment on column erp.budgets.year_month is '연월(YYYY-MM)';
comment on column erp.budgets.department_code is '부서 코드';
comment on column erp.budgets.account_code is '계정 코드';
comment on column erp.budgets.amount is '예산(원)';

-- ───────────────────────────────────────────── 시드: 마스터 ─────────────────────────────────────

select setseed(0.42);

insert into erp.departments (code, name, parent_code, head_emp_no, cost_center) values
  ('D000', '경영진',    null,   'E001', 'CC-000'),
  ('D100', '경영지원팀', 'D000', 'E002', 'CC-100'),
  ('D200', '생산팀',    'D000', 'E010', 'CC-200'),
  ('D300', '품질팀',    'D000', 'E020', 'CC-300'),
  ('D400', '영업팀',    'D000', 'E026', 'CC-400'),
  ('D500', '설계팀',    'D000', 'E029', 'CC-500');

insert into erp.employees (emp_no, name, department_code, position, job_title, employment_type, hire_date, resign_date, status, email, phone) values
  ('E001', '김대표', 'D000', '이사', '대표이사', '정규직', '2015-03-02', null, '재직', 'ceo@hanbit-steel.example', '010-1000-0001'),
  ('E002', '박경영', 'D100', '부장', '팀장',   '정규직', '2016-01-04', null, '재직', 'park.k@hanbit-steel.example', '010-1000-0002'),
  ('E003', '이회계', 'D100', '과장', '회계파트장', '정규직', '2018-05-14', null, '재직', 'lee.h@hanbit-steel.example', '010-1000-0003'),
  ('E004', '최인사', 'D100', '대리', null,     '정규직', '2020-09-01', null, '재직', 'choi.i@hanbit-steel.example', '010-1000-0004'),
  ('E005', '정총무', 'D100', '사원', null,     '정규직', '2023-02-13', null, '재직', 'jung.c@hanbit-steel.example', '010-1000-0005'),
  ('E006', '한급여', 'D100', '사원', null,     '계약직', '2025-07-01', null, '재직', 'han.g@hanbit-steel.example', '010-1000-0006'),
  ('E010', '오생산', 'D200', '부장', '팀장',   '정규직', '2014-06-16', null, '재직', 'oh.s@hanbit-steel.example', '010-1000-0010'),
  ('E011', '강프레스', 'D200', '차장', '1라인장', '정규직', '2015-11-02', null, '재직', 'kang.p@hanbit-steel.example', '010-1000-0011'),
  ('E012', '윤성형', 'D200', '과장', '2라인장', '정규직', '2017-03-06', null, '재직', 'yoon.s@hanbit-steel.example', '010-1000-0012'),
  ('E013', '조블랭킹', 'D200', '대리', null,   '정규직', '2019-08-19', null, '재직', 'cho.b@hanbit-steel.example', '010-1000-0013'),
  ('E014', '임트리밍', 'D200', '대리', null,   '정규직', '2020-04-01', null, '재직', 'lim.t@hanbit-steel.example', '010-1000-0014'),
  ('E015', '서피어싱', 'D200', '사원', null,   '정규직', '2021-10-05', null, '재직', 'seo.p@hanbit-steel.example', '010-1000-0015'),
  ('E016', '남용접',  'D200', '사원', null,    '정규직', '2022-03-14', null, '재직', 'nam.y@hanbit-steel.example', '010-1000-0016'),
  ('E017', '문금형',  'D200', '사원', null,    '계약직', '2024-01-08', null, '재직', 'moon.g@hanbit-steel.example', '010-1000-0017'),
  ('E018', '배야간',  'D200', '사원', null,    '정규직', '2022-11-21', null, '휴직', 'bae.y@hanbit-steel.example', '010-1000-0018'),
  ('E019', '홍퇴직',  'D200', '대리', null,    '정규직', '2018-02-05', current_date - 40, '퇴직', null, null),
  ('E020', '신품질',  'D300', '차장', '팀장',  '정규직', '2016-09-12', null, '재직', 'shin.q@hanbit-steel.example', '010-1000-0020'),
  ('E021', '류검사',  'D300', '과장', null,    '정규직', '2018-07-02', null, '재직', 'ryu.i@hanbit-steel.example', '010-1000-0021'),
  ('E022', '전측정',  'D300', '대리', null,    '정규직', '2021-05-10', null, '재직', 'jeon.m@hanbit-steel.example', '010-1000-0022'),
  ('E023', '황게이지', 'D300', '사원', null,   '정규직', '2023-06-01', null, '재직', 'hwang.g@hanbit-steel.example', '010-1000-0023'),
  ('E024', '노불량',  'D300', '사원', null,    '계약직', '2025-03-03', null, '재직', 'noh.b@hanbit-steel.example', '010-1000-0024'),
  ('E026', '차영업',  'D400', '부장', '팀장',  '정규직', '2015-04-20', null, '재직', 'cha.y@hanbit-steel.example', '010-1000-0026'),
  ('E027', '유수주',  'D400', '과장', null,    '정규직', '2019-01-14', null, '재직', 'yoo.s@hanbit-steel.example', '010-1000-0027'),
  ('E028', '송납품',  'D400', '사원', null,    '정규직', '2022-08-01', null, '재직', 'song.n@hanbit-steel.example', '010-1000-0028'),
  ('E029', '권설계',  'D500', '차장', '팀장',  '정규직', '2016-02-15', null, '재직', 'kwon.d@hanbit-steel.example', '010-1000-0029'),
  ('E030', '손도면',  'D500', '과장', null,    '정규직', '2018-10-08', null, '재직', 'son.d@hanbit-steel.example', '010-1000-0030'),
  ('E031', '백금형',  'D500', '대리', null,    '정규직', '2021-02-01', null, '재직', 'baek.g@hanbit-steel.example', '010-1000-0031'),
  ('E032', '안BOM',   'D500', '사원', null,    '정규직', '2023-09-04', null, '재직', 'ahn.b@hanbit-steel.example', '010-1000-0032'),
  ('E033', '탁신입',  'D500', '사원', null,    '정규직', current_date - 25, null, '재직', 'tak.n@hanbit-steel.example', '010-1000-0033'),
  ('E034', '장계약',  'D400', '사원', null,    '계약직', '2025-05-12', null, '재직', 'jang.k@hanbit-steel.example', '010-1000-0034'),
  ('E035', '표외주',  'D200', '사원', null,    '계약직', '2025-09-01', null, '재직', 'pyo.o@hanbit-steel.example', '010-1000-0035'),
  ('E036', '허품질',  'D300', '사원', null,    '정규직', '2024-04-15', null, '재직', 'heo.q@hanbit-steel.example', '010-1000-0036');

insert into erp.accounts (code, name, kind) values
  ('1010', '보통예금',     '자산'), ('1100', '외상매출금', '자산'), ('1200', '원재료',   '자산'), ('1300', '제품',     '자산'),
  ('2010', '외상매입금',   '부채'), ('2100', '미지급금',   '부채'), ('2200', '예수금',   '부채'),
  ('4010', '제품매출',     '수익'), ('4020', '임가공매출', '수익'),
  ('5010', '원재료비',     '비용'), ('5020', '외주가공비', '비용'), ('5030', '급여',     '비용'), ('5040', '상여금',   '비용'),
  ('5050', '복리후생비',   '비용'), ('5060', '수도광열비', '비용'), ('5070', '소모품비', '비용'), ('5080', '수선비',   '비용'),
  ('5090', '운반비',       '비용'), ('5100', '접대비',     '비용'), ('5110', '여비교통비', '비용'), ('5120', '통신비', '비용');

-- ───────────────────────────────────────────── 시드: 근태 (최근 120일, 평일) ─────────────────────

insert into erp.attendance (emp_no, work_date, clock_in, clock_out, overtime_min, status)
select e.emp_no, d::date,
       case when s.r1 < 0.03 then null else time '08:30' + ((s.r2 * 40)::int || ' minutes')::interval end,
       case when s.r1 < 0.03 then null else time '17:30' + ((s.r3 * 150)::int || ' minutes')::interval end,
       case when s.r1 < 0.03 then 0 else greatest(0, (s.r3 * 150)::int - 30) end,
       case when s.r1 < 0.03 then '결근' when s.r1 < 0.08 then '휴가' when s.r2 > 0.85 then '지각' when s.r3 < 0.05 then '조퇴' else '정상' end
from erp.employees e
cross join generate_series(current_date - 120, current_date - 1, interval '1 day') d
cross join lateral (select random() r1, random() r2, random() r3 where e.emp_no = e.emp_no) s
where extract(isodow from d) < 6
  and e.status = '재직'
  and e.hire_date <= d::date;

-- ───────────────────────────────────────────── 시드: 휴가 ────────────────────────────────────────

insert into erp.leaves (emp_no, kind, start_date, end_date, days, status, reason)
select e.emp_no,
       (array['연차','연차','연차','반차','병가','경조','공가'])[1 + floor(s.r1 * 7)::int],
       current_date - (s.r2 * 110)::int,
       current_date - (s.r2 * 110)::int + (s.r3 * 2)::int,
       case when s.r1 < 0.45 then 1 + (s.r3 * 2)::int else 0.5 end,
       (array['승인','승인','승인','승인','대기','반려'])[1 + floor(s.r3 * 6)::int],
       (array['개인 사정','가족 행사','통원 치료','자녀 학교 행사','예비군',null])[1 + floor(s.r2 * 6)::int]
from erp.employees e
cross join generate_series(1, 3) n
cross join lateral (select random() r1, random() r2, random() r3 where n = n) s
where e.status <> '퇴직' and s.r1 < 0.8;

-- ───────────────────────────────────────────── 시드: 급여 (최근 4개월) ────────────────────────────

insert into erp.payroll_runs (pay_month, emp_no, base_pay, overtime_pay, bonus, deductions, net_pay, paid_on, status)
select to_char(m, 'YYYY-MM'), e.emp_no, base, ot, bonus, ded, base + ot + bonus - ded,
       case when m < date_trunc('month', current_date) then (m + interval '1 month' - interval '6 days')::date else null end,
       case when m < date_trunc('month', current_date) then '지급완료' else '작성중' end
from erp.employees e
cross join generate_series(date_trunc('month', current_date) - interval '3 months', date_trunc('month', current_date), interval '1 month') m
cross join lateral (
  select (case e.position when '이사' then 9000000 when '부장' then 6500000 when '차장' then 5500000 when '과장' then 4600000
                          when '대리' then 3800000 else 3100000 end
          * case when e.employment_type = '계약직' then 0.9 else 1 end)::int as base,
         ((random() * 40)::int * 10000) as ot,
         case when extract(month from m) in (1, 7) then 1000000 else 0 end as bonus
  where e.emp_no = e.emp_no
) p
cross join lateral (select ((p.base + p.ot + p.bonus) * 0.11)::int as ded) d
where e.status <> '퇴직' and e.hire_date <= (m + interval '1 month')::date;

-- ───────────────────────────────────────────── 시드: 전표 (최근 120일) ───────────────────────────

insert into erp.vouchers (voucher_no, voucher_date, kind, description, department_code, counterparty, amount, status, created_by, approved_by, created_at)
select 'V-' || to_char(vd, 'YYMM') || '-' || lpad((row_number() over (partition by to_char(vd, 'YYMM') order by vd, n))::text, 4, '0'),
       vd, kind, descr, dept, cp, amt, st, 'E003', case when st = '승인' then 'E002' end, vd + time '10:00' + ((n * 7) || ' minutes')::interval
from (
  select n, (current_date - (s.r1 * 119)::int) as vd,
         (array['출금','출금','출금','입금','대체'])[1 + floor(s.r2 * 5)::int] as kind,
         (array['원재료 매입 (SPFC590 코일)','외주 가공비 지급','소모품 구매','전기요금 납부','제품 매출 입금','임가공 매출 입금','설비 수선비',
                '운반비 정산','거래처 접대','출장 교통비','통신비 자동이체','복리후생 식대'])[1 + floor(s.r3 * 12)::int] as descr,
         (array['D100','D200','D200','D200','D300','D400','D500'])[1 + floor(s.r1 * 7)::int] as dept,
         (array['포스코','현대제철','대한외주가공','한전','현대모비스','기아','아이다코리아','CJ대한통운','KT',null])[1 + floor(s.r2 * 10)::int] as cp,
         ((s.r3 * 180 + 5)::int * 50000) as amt,
         (array['승인','승인','승인','승인','승인','대기','반려'])[1 + floor(s.r1 * 7)::int] as st
  from generate_series(1, 180) n
  cross join lateral (select random() r1, random() r2, random() r3 where n = n) s
) v;

-- 분개: 출금 = 비용 차변 / 예금 대변, 입금 = 예금 차변 / 매출 대변, 대체 = 미지급금 차변 / 예금 대변
insert into erp.voucher_lines (voucher_no, line_no, account_code, debit, credit, memo)
select voucher_no, 1,
       case kind when '출금' then (array['5010','5020','5070','5060','5080','5090','5100','5110','5120','5050'])[1 + (abs(hashtext(voucher_no)) % 10)]
                 when '입금' then '1010' else '2100' end,
       amount, 0, description
from erp.vouchers
union all
select voucher_no, 2,
       case kind when '입금' then (case when description like '임가공%' then '4020' else '4010' end) else '1010' end,
       0, amount, null
from erp.vouchers;

-- ───────────────────────────────────────────── 시드: 예산 (최근 4개월, 부서 × 주요 비용) ──────────

insert into erp.budgets (year_month, department_code, account_code, amount)
select to_char(m, 'YYYY-MM'), d.code, a.code,
       (case a.code when '5010' then 120000000 when '5020' then 30000000 when '5030' then 40000000 when '5060' then 8000000 else 3000000 end
        * case d.code when 'D200' then 1.0 when 'D100' then 0.5 else 0.3 end)::int
from generate_series(date_trunc('month', current_date) - interval '3 months', date_trunc('month', current_date), interval '1 month') m
cross join erp.departments d
cross join erp.accounts a
where a.code in ('5010','5020','5030','5050','5060','5070','5080','5110') and d.code <> 'D000';

-- ───────────────────────────────────────────── 뷰 ─────────────────────────────────────────────────

create view erp.v_headcount_by_department as
select d.code as department_code, d.name as department_name,
       count(*) filter (where e.status = '재직') as active,
       count(*) filter (where e.status = '휴직') as on_leave,
       count(*) filter (where e.employment_type = '계약직' and e.status = '재직') as contractors
from erp.departments d
left join erp.employees e on e.department_code = d.code
group by d.code, d.name;
comment on view erp.v_headcount_by_department is '부서별 인원(재직 · 휴직 · 계약직)';

create view erp.v_payroll_monthly as
select p.pay_month, e.department_code, d.name as department_name,
       count(*) as headcount, sum(p.base_pay) as base_pay, sum(p.overtime_pay) as overtime_pay, sum(p.bonus) as bonus,
       sum(p.deductions) as deductions, sum(p.net_pay) as net_pay
from erp.payroll_runs p
join erp.employees e on e.emp_no = p.emp_no
join erp.departments d on d.code = e.department_code
group by p.pay_month, e.department_code, d.name;
comment on view erp.v_payroll_monthly is '월 · 부서별 급여 합계';

create view erp.v_expense_by_department_month as
select to_char(v.voucher_date, 'YYYY-MM') as year_month, v.department_code, d.name as department_name,
       l.account_code, a.name as account_name,
       sum(l.debit) as spent,
       max(b.amount) as budget,
       max(b.amount) - sum(l.debit) as remaining
from erp.vouchers v
join erp.voucher_lines l on l.voucher_no = v.voucher_no and l.debit > 0
join erp.accounts a on a.code = l.account_code and a.kind = '비용'
join erp.departments d on d.code = v.department_code
left join erp.budgets b on b.year_month = to_char(v.voucher_date, 'YYYY-MM') and b.department_code = v.department_code and b.account_code = l.account_code
where v.status = '승인'
group by 1, 2, 3, 4, 5;
comment on view erp.v_expense_by_department_month is '월 · 부서 · 계정별 지출과 예산 잔액(승인 전표만)';

-- ───────────────────────────────────────────── 읽기 전용 롤(우리 BE 가 붙는 계정) ────────────────

-- YOUR_PASSWORD 를 바꾼다. 비밀번호는 여기 파일에 남기지 말고, 운영 콘솔의 시스템 등록에만 넣는다.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'erp_reader') then
    create role erp_reader login password 'YOUR_PASSWORD';
  end if;
end $$;
grant usage on schema erp to erp_reader;
grant select on all tables in schema erp to erp_reader;
alter default privileges in schema erp grant select on tables to erp_reader;
alter role erp_reader set statement_timeout = '10s';

-- MES 데모 계정이 이미 있으면 그 계정으로도 읽게 한다 — 운영 콘솔에 같은 계정으로 ERP 를 등록할 수 있다
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'mes_reader') then
    grant usage on schema erp to mes_reader;
    grant select on all tables in schema erp to mes_reader;
    alter default privileges in schema erp grant select on tables to mes_reader;
  end if;
end $$;

-- ───────────────────────────────────────────── 확인 ───────────────────────────────────────────────

select 'departments' t, count(*) from erp.departments
union all select 'employees', count(*) from erp.employees
union all select 'accounts', count(*) from erp.accounts
union all select 'attendance', count(*) from erp.attendance
union all select 'leaves', count(*) from erp.leaves
union all select 'payroll_runs', count(*) from erp.payroll_runs
union all select 'vouchers', count(*) from erp.vouchers
union all select 'voucher_lines', count(*) from erp.voucher_lines
union all select 'budgets', count(*) from erp.budgets;
