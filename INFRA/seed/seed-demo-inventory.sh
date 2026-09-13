#!/usr/bin/env bash
#
# 재고·물류 데모 데이터 시드. 로컬과 배포 서버 둘 다에서 돌린다.
#
# 넣는 것: 거래처 8 · 품목 16 · 발주 6(라인 10) · 기준 16 · 입출고 이력 12 · 회사 기준 1.
# 값은 `data/inventory-demo.sql` 에 있고 `FE/data/inventory-demo.ts` 와 같다.
#
# **API 가 아니라 SQL 로 넣는다.** 다른 시드와 다른 점이라 이유를 적어 둔다: 발주 라인의 입고 누계와 판정,
# 이력의 시각·작성자가 정해진 값이어야 화면의 기한 넘김 · 부분 입고 배지가 설계대로 나온다. 정상 경로
# (POST /orders → POST /receipts)로 넣으면 입고가 전부 「방금」이 되고 이력 작성자가 시드를 돌린 사람이
# 된다 — 기존 시드가 「대기중」 상태를 SQL 로 만드는 것과 같은 이유다.
#
# 날짜는 고정값이 아니라 **실행 시점 기준 상대값**(current_date - N)이다. 화면의 「오늘」이 서버에 붙으면
# 실제 날짜가 되기 때문에(`inventory-provider.tsx`), 고정 날짜를 넣으면 며칠 뒤 발주가 전부 기한 넘김이 된다.
# 자세한 사정은 data/inventory-demo.sql 머리말에 있다.
#
# 사용법
#   docker compose -f INFRA/docker-compose.db.yml up -d     # DB
#   # BE 를 한 번 띄워 테넌트 마이그레이션(V17)을 적용한 뒤에 돌린다
#   SEED_WORKSPACE='한결정밀 주식회사' bash INFRA/seed/seed-demo-inventory.sh
#
# SEED_WORKSPACE 는 스키마 이름(ax_00008)이나 회사 이름 둘 다 받는다. 비우면 데모 회사를 찾는다.
#
# 여러 번 돌려도 된다. 그 회사의 재고 표를 비우고 다시 넣는다 — **그 회사에 쌓인 재고 데이터는 사라진다.**

source "$(dirname "$0")/lib.sh"

DATA="$(dirname "$0")/data/inventory-demo.sql"
[ -f "$DATA" ] || die "데이터 파일이 없다: $DATA"

# seed-demo-workspace.sh 가 만드는 회사. 기본값으로 둔 이유는 이것이 시연 전용 가상 회사이기 때문이다.
TARGET="${SEED_WORKSPACE:-한결정밀 주식회사}"

docker exec "$PG" true 2>/dev/null || die "컨테이너 $PG 가 없다."

# 작은따옴표를 두 배로 만들어 SQL 문자열에 안전하게 넣는다. 이름에 한글·공백이 들어와도 그대로 맞춘다.
escaped="$(printf '%s' "$TARGET" | sed "s/'/''/g")"
SCHEMA="$(psql_ "select schema_name from shared.workspaces where schema_name = '$escaped' or name = '$escaped' order by id limit 1")"
SCHEMA="$(printf '%s' "$SCHEMA" | tr -d '[:space:]')"

[ -n "$SCHEMA" ] || die "회사를 찾을 수 없다: $TARGET  (SEED_WORKSPACE 에 회사 이름이나 스키마 이름을 넘긴다)"
# search_path 에 문자열로 조립되는 값이라 형태를 여기서도 막는다(BE 의 2단계 검증과 같은 정규식).
case "$SCHEMA" in
  ax_[0-9][0-9][0-9][0-9][0-9]*) ;;
  *) die "스키마 이름이 규칙에 맞지 않는다: $SCHEMA" ;;
esac

NAME="$(psql_ "select name from shared.workspaces where schema_name = '$SCHEMA'")"
say "대상: $NAME ($SCHEMA)"

# 마이그레이션이 아직이면 표가 없다. 여기서 먼저 막는다 — psql 오류 12줄보다 한 줄이 낫다.
HAS="$(psql_ "select count(*) from information_schema.tables where table_schema = '$SCHEMA' and table_name = 'inv_items'")"
[ "$(printf '%s' "$HAS" | tr -d '[:space:]')" = "1" ] \
  || die "$SCHEMA 에 재고 표가 없다. BE 를 새 이미지로 한 번 띄워 tenant V17 을 적용한 뒤 다시 돌린다."

echo
echo "== 재고·물류 데모 데이터"
{
  # 위에서 형태를 확인했으므로 따옴표 없이 넣는다 — psql_ 이 질의를 큰따옴표로 감싸 전달해서
  # 여기에 큰따옴표를 쓰면 그쪽이 깨진다.
  echo "SET search_path TO $SCHEMA;"
  cat "$DATA"
} | docker exec -i "$PG" sh -c 'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  || die "데이터를 넣지 못했다."

echo
echo "== 결과"
psql_ "set search_path to $SCHEMA;
       select '  거래처 ' || (select count(*) from inv_vendors)
           || ' · 품목 '   || (select count(*) from inv_items)
           || ' · 발주 '   || (select count(*) from inv_purchase_orders)
           || '(라인 '     || (select count(*) from inv_po_lines) || ')'
           || ' · 이력 '   || (select count(*) from inv_movements)
           || ' · 기준 '   || (select count(*) from inv_item_standards)"

echo
echo "  이제 데모 계정으로 로그인해 사이드바의 「재고·물류」를 연다."
