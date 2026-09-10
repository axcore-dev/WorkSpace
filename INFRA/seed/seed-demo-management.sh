#!/usr/bin/env bash
#
# 데모 회사(seed-demo-workspace.sh 가 만든 한결정밀)에 경영지원 — 급여 · 회계 — 시연 데이터를 넣는다.
# 인사 탭은 표가 따로 없다. 구성원 · 부서가 그대로 조직도라서 seed-demo-workspace.sh 의 MEMBERS 가 인사 데이터다.
#
# 전부 SQL 이다 — 회차 · 전표를 임의 값으로 만드는 API 가 없고(회차는 최근 회차 복사, 전표는 급여 회차에서만 생긴다),
# 시연 데이터는 "지난 달은 끝났고 이번 달은 처리 대기" 로 보여야 하기 때문이다. 날짜는 실행 시점 기준으로 계산한다:
#   - 급여: 이번 달 정기급여(처리 대기) · 지난 달 정기급여(지급 완료) · 지난 달 성과급(지급 완료) · 두 달 전 정기급여(지급 완료)
#   - 항목 금액 = 1인당 금액 × 실제 구성원 수. 그래서 총액 − 공제 = 실지급이 항상 맞는다
#   - 전표: 이번 달 매입 2(하나는 검토중) · 매출 1, 지난 달 매출 1 · 급여 전표 2(회차와 연결, 승인)
#   - 월별 손익: 지난 6개월
#
# 보안 (저장소가 공개다): 계정 · 비밀번호를 쓰지 않는다. DB 컨테이너에만 붙는다.
#
# 사용법 (서버: DB 컨테이너는 axcore-postgres 가 기본값, SEED_PG 로 바꿀 수 있다)
#   bash INFRA/seed/seed-demo-management.sh
#
# 여러 번 돌려도 된다. 회차가 하나라도 있으면 건너뛴다(시연 중 만든 데이터를 덮지 않는다).

source "$(dirname "$0")/lib.sh"

COMPANY_BIZ="8018112344"   # seed-demo-workspace.sh 와 같은 값

echo "== 0. 사전 확인"
docker exec "$PG" true 2>/dev/null || die "컨테이너 $PG 가 없다."
say "DB 컨테이너 확인 ($PG)"

SCHEMA=$(psql_ "select schema_name from shared.workspaces where biz_number = '$COMPANY_BIZ' and status = 'active';")
[ -n "$SCHEMA" ] || die "데모 회사가 없다. seed-demo-workspace.sh 를 먼저 돌린다."
[[ "$SCHEMA" =~ ^[a-z0-9_]+$ ]] || die "스키마 이름이 이상하다: $SCHEMA"
say "데모 회사 스키마: $SCHEMA"

[ "$(psql_ "select count(*) from information_schema.tables where table_schema = '$SCHEMA' and table_name = 'payroll_runs';")" = "1" ] \
  || die "$SCHEMA 에 payroll_runs 가 없다. BE 를 tenant V14 가 포함된 버전으로 올리고 테넌트 마이그레이션을 먼저 돌린다."

echo
echo "== 1. 급여 · 회계 데이터"
docker exec -i "$PG" sh -c 'psql -qtAX -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<SQL
set search_path to $SCHEMA, shared;

do \$\$
declare
  n        int  := (select count(*) from members where status = 'active');
  m0       date := date_trunc('month', now())::date;                  -- 이번 달 1일
  m1       date := (m0 - interval '1 month')::date;
  m2       date := (m0 - interval '2 month')::date;
  ym0      text := to_char(m0, 'YYYY-MM');
  ym1      text := to_char(m1, 'YYYY-MM');
  ym2      text := to_char(m2, 'YYYY-MM');
  bonus    text := ym1 || '-bonus';
  v0       text := 'V-' || to_char(m0, 'YYMM') || '-';
  v1       text := 'V-' || to_char(m1, 'YYMM') || '-';
  -- 전표 작성자: 부서의 첫 사람. 없으면 부서 이름
  who_mgmt text := coalesce((select u.name from members m join shared.users u on u.id = m.user_id join departments d on d.id = m.department_id
                              where d.name = '경영' and m.status = 'active' order by u.name limit 1), '경영');
  who_logi text := coalesce((select u.name from members m join shared.users u on u.id = m.user_id join departments d on d.id = m.department_id
                              where d.name = '물류' and m.status = 'active' order by u.name limit 1), '물류');
  gross1 bigint; ded1 bigint; grossb bigint; dedb bigint;
begin
  if exists (select 1 from payroll_runs) then
    raise notice '이미 있음: 급여 회차가 있어 건너뛴다';
    return;
  end if;
  if n = 0 then
    raise exception '활성 구성원이 없다. seed-demo-workspace.sh 를 먼저 돌린다';
  end if;

  -- ── 급여 회차
  insert into payroll_runs (id, name, headcount, pay_date, status, paid_at) values
    (ym0,   to_char(m0, 'YYYY"년" FMMM"월"') || ' 정기급여', n, m0 + 24, 'pending', null),
    (ym1,   to_char(m1, 'YYYY"년" FMMM"월"') || ' 정기급여', n, m1 + 24, 'paid',    m1 + 24),
    (bonus, to_char(m1, 'YYYY"년"') || ' 반기 성과급',        n, m1 + 25, 'paid',    m1 + 25),
    (ym2,   to_char(m2, 'YYYY"년" FMMM"월"') || ' 정기급여', n, m2 + 24, 'paid',    m2 + 24);

  -- 정기급여 항목: 1인당 금액 × 인원
  insert into payroll_items (run_id, label, amount, note, sort)
  select r.id, i.label, i.per_head * r.headcount, i.note, i.sort
    from payroll_runs r
    cross join (values
      ('기본급',            2750000, '기본급 · 일할 계산 없음', 0),
      ('연장수당',           250000, '월 평균 연장 12시간',     1),
      ('직책·식대',          300000, '직책수당 · 식대 20만',    2),
      ('국민연금·건강보험', -300000, '공제',                     3),
      ('소득세·지방세',     -155000, '공제',                     4)) as i(label, per_head, note, sort)
   where r.id <> bonus;

  -- 성과급 항목
  insert into payroll_items (run_id, label, amount, note, sort)
  select bonus, i.label, i.per_head * n, i.note, i.sort
    from (values
      ('성과급',            1500000, '반기 성과 평가 반영', 0),
      ('국민연금·건강보험', -100000, '공제',                 1),
      ('소득세·지방세',     -110000, '공제',                 2)) as i(label, per_head, note, sort);

  select sum(amount) filter (where amount > 0), -sum(amount) filter (where amount < 0) into gross1, ded1 from payroll_items where run_id = ym1;
  select sum(amount) filter (where amount > 0), -sum(amount) filter (where amount < 0) into grossb, dedb from payroll_items where run_id = bonus;

  -- ── 전표
  insert into vouchers (no, voucher_date, kind, counterparty, summary, amount, vat, account, owner_name, status, run_id,
                        purchase_item, purchase_code, purchase_qty, purchase_unit, purchase_unit_price) values
    (v0 || '001', m0,     'purchase', 'NSK코리아',  '베어링 608ZZ 5,000EA',          5750000,  575000,  '원재료',   who_logi, 'review',   null, '베어링 608ZZ',      'PRT-BRG-608', 5000, 'EA', 1150),
    (v0 || '002', m0,     'sales',    '한빛모터스', '정밀 샤프트 납품',               86400000, 8640000, '제품매출', who_mgmt, 'approved', null, null, null, null, null, null),
    (v0 || '003', m0,     'purchase', '한국알루텍', '알루미늄 합금 6061 5,000kg',     24250000, 2425000, '원재료',   who_logi, 'approved', null, '알루미늄 합금 6061', 'MAT-AL-6061', 5000, 'kg', 4850),
    (v1 || '089', m0 - 1, 'sales',    '세진전자',   '브래킷 어셈블리',                42120000, 4212000, '제품매출', who_mgmt, 'approved', null, null, null, null, null, null),
    (v1 || '001', m1 + 23,'payroll',  '임직원',     to_char(m1, 'YYYY"년" FMMM"월"') || ' 정기급여 (' || n || '명)', gross1, null, '급여', who_mgmt, 'approved', ym1,  null, null, null, null, null),
    (v1 || '014', m1 + 24,'payroll',  '임직원',     to_char(m1, 'YYYY"년"') || ' 반기 성과급 (' || n || '명)',       grossb, null, '급여', who_mgmt, 'approved', bonus, null, null, null, null, null);

  insert into voucher_lines (voucher_no, account, debit, credit, memo, sort) values
    (v0 || '001', '원재료',       5750000,  null,     '베어링 608ZZ 5,000EA', 0),
    (v0 || '001', '부가세대급금', 575000,   null,     '매입 부가세',           1),
    (v0 || '001', '외상매입금',   null,     6325000,  'NSK코리아',             2),
    (v0 || '002', '외상매출금',   95040000, null,     '한빛모터스',            0),
    (v0 || '002', '제품매출',     null,     86400000, '정밀 샤프트',           1),
    (v0 || '002', '부가세예수금', null,     8640000,  '매출 부가세',           2),
    (v0 || '003', '원재료',       24250000, null,     '알루미늄 합금 6061',    0),
    (v0 || '003', '부가세대급금', 2425000,  null,     '매입 부가세',           1),
    (v0 || '003', '외상매입금',   null,     26675000, '한국알루텍',            2),
    (v1 || '089', '외상매출금',   46332000, null,     '세진전자',              0),
    (v1 || '089', '제품매출',     null,     42120000, '브래킷 어셈블리',       1),
    (v1 || '089', '부가세예수금', null,     4212000,  '매출 부가세',           2),
    (v1 || '001', '급여',         gross1,   null,     n || '명',               0),
    (v1 || '001', '예수금',       null,     ded1,     '4대보험 · 소득세',      1),
    (v1 || '001', '보통예금',     null,     gross1 - ded1, '실지급',           2),
    (v1 || '014', '급여',         grossb,   null,     n || '명',               0),
    (v1 || '014', '예수금',       null,     dedb,     '4대보험 · 소득세',      1),
    (v1 || '014', '보통예금',     null,     grossb - dedb, '실지급',           2);

  update payroll_runs set voucher_no = v1 || '001' where id = ym1;
  update payroll_runs set voucher_no = v1 || '014' where id = bonus;

  -- ── 월별 손익(지난 6개월). 화면(FE)에 있던 값의 1/10 — 여섯 명 회사 규모에 맞춘다
  insert into monthly_pl (month, sales, cost)
  select (m0 - (k || ' month')::interval)::date, sales, cost
    from (values (6, 182000000, 159000000), (5, 175000000, 158000000), (4, 198000000, 172000000),
                 (3, 213000000, 184000000), (2, 206000000, 181000000), (1, 224000000, 206000000)) as v(k, sales, cost)
  on conflict (month) do nothing;

  raise notice '급여 회차 4 · 전표 6 · 월별 손익 6 (구성원 % 명 기준)', n;
end
\$\$;
SQL
[ $? -eq 0 ] || die "SQL 실패"

echo
echo "== 2. 결과 — $SCHEMA"
psql_ "select '  ' || rpad(id, 16) || rpad(status, 11) || name from $SCHEMA.payroll_runs order by pay_date desc;"
psql_ "select '  ' || rpad(no, 12) || rpad(status, 10) || rpad(kind, 10) || summary from $SCHEMA.vouchers order by voucher_date desc, no desc;"
