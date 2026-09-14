#!/usr/bin/env bash
#
# 재고·물류 + 제품설계 데모 데이터 시드. 로컬과 배포 서버 둘 다에서 돌린다.
#
# 제품설계(도면 · 리비전 · BOM, data/design-demo.sql)를 같은 스크립트가 넣는 이유: BOM 의 item_code 가 재고 품목을
# 가리켜서 두 데이터는 한 몸이다. 따로 돌리면 어느 한쪽만 새로 넣어 매핑이 끊긴다.
#
# 넣는 것: 거래처 8 · 품목 16 · 발주 6(라인 10) · 기준 16 · 입출고 이력 12 · 회사 기준 1 · 도면 8(리비전 15 · BOM 16).
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
# 그래서 지울 것이 있으면 행 수를 보이고 확인을 받는다(#95). 회사 상태가 active 면 스키마 이름을 그대로
# 입력해야 진행한다. 자동화에서는 SEED_FORCE=1 로 확인을 건너뛴다.
#   SEED_FORCE=1 SEED_WORKSPACE=ax_00008 bash INFRA/seed/seed-demo-inventory.sh

source "$(dirname "$0")/lib.sh"

DATA="$(dirname "$0")/data/inventory-demo.sql"
DESIGN="$(dirname "$0")/data/design-demo.sql"
[ -f "$DATA" ] || die "데이터 파일이 없다: $DATA"
[ -f "$DESIGN" ] || die "데이터 파일이 없다: $DESIGN"

# seed-demo-workspace.sh 가 만드는 회사. 기본값으로 둔 이유는 이것이 시연 전용 가상 회사이기 때문이다.
TARGET="${SEED_WORKSPACE:-한결정밀 주식회사}"

docker exec "$PG" true 2>/dev/null || die "컨테이너 $PG 가 없다."

# 작은따옴표를 두 배로 만들어 SQL 문자열에 안전하게 넣는다. 이름에 한글·공백이 들어와도 그대로 맞춘다.
escaped="$(printf '%s' "$TARGET" | sed "s/'/''/g")"
SCHEMA="$(psql_ "select schema_name from shared.workspaces where schema_name = '$escaped' or name = '$escaped' order by id limit 1")"
SCHEMA="$(printf '%s' "$SCHEMA" | tr -d '[:space:]')"

[ -n "$SCHEMA" ] || die "회사를 찾을 수 없다: $TARGET  (SEED_WORKSPACE 에 회사 이름이나 스키마 이름을 넘긴다)"
# search_path 에 문자열로 조립되는 값이라 형태를 여기서도 막는다. BE 의 SchemaName(^ax_[0-9]{5,}$)과 같은 정규식 —
# 예전 글롭(ax_[0-9]*5*)은 뒤에 무엇이든 붙을 수 있어 그보다 느슨했다(#97).
[[ "$SCHEMA" =~ ^ax_[0-9]{5,}$ ]] || die "스키마 이름이 규칙에 맞지 않는다: $SCHEMA"

NAME="$(psql_ "select name from shared.workspaces where schema_name = '$SCHEMA'")"
say "대상: $NAME ($SCHEMA)"

# 마이그레이션이 아직이면 표가 없다. 여기서 먼저 막는다 — psql 오류 12줄보다 한 줄이 낫다.
HAS="$(psql_ "select count(*) from information_schema.tables where table_schema = '$SCHEMA' and table_name in ('inv_items', 'dsg_drawings')")"
[ "$(printf '%s' "$HAS" | tr -d '[:space:]')" = "2" ] \
  || die "$SCHEMA 에 재고 · 설계 표가 없다. BE 를 새 이미지로 한 번 띄워 tenant V17 · V18 을 적용한 뒤 다시 돌린다."

# 이 시드는 표를 비우고 다시 넣는다. 다른 시드는 「이미 있으면 건너뛴다」라 이 위험이 없고 이 시드만 다르다.
# SEED_WORKSPACE 를 잘못 넘기면 실제 재고 데이터가 사라지고 되돌릴 수 없으므로, 지울 것이 있을 때만 묻는다(#95).
# 라인·품목-거래처 표는 부모(발주·품목)가 있어야 존재하므로 세지 않는다. inv_settings 는 독립 표라 따로 센다.
COUNTS="$(psql_ "set search_path to $SCHEMA;
       select (select count(*) from inv_vendors) || ' ' || (select count(*) from inv_items) || ' '
           || (select count(*) from inv_purchase_orders) || ' ' || (select count(*) from inv_movements) || ' '
           || (select count(*) from inv_item_standards) || ' ' || (select count(*) from inv_settings) || ' '
           || (select count(*) from dsg_drawings)" | tr -d '\r')"
# 질의가 실패하면 빈 값이 산술에서 0 이 되어 확인 없이 지우게 된다. 숫자 일곱이 아니면 여기서 멈춘다(닫힌 실패).
[[ "$COUNTS" =~ ^[0-9]+(\ [0-9]+){6}$ ]] || die "재고 · 설계 표의 행 수를 읽지 못했다: '$COUNTS'"
read -r N_VENDORS N_ITEMS N_ORDERS N_MOVES N_STDS N_SETTINGS N_DRAWINGS <<< "$COUNTS"
TOTAL=$((N_VENDORS + N_ITEMS + N_ORDERS + N_MOVES + N_STDS + N_SETTINGS + N_DRAWINGS))
if [ "$TOTAL" -gt 0 ] && [ "${SEED_FORCE:-}" != "1" ]; then
  STATUS="$(psql_ "select status from shared.workspaces where schema_name = '$SCHEMA'" | tr -d '[:space:]')"
  echo
  say "이 회사에 재고 · 설계 데이터가 있다: 거래처 $N_VENDORS · 품목 $N_ITEMS · 발주 $N_ORDERS · 이력 $N_MOVES · 기준 $N_STDS · 설정 $N_SETTINGS · 도면 $N_DRAWINGS"
  say "전부 지우고 데모 데이터로 바꾼다. 되돌릴 수 없다."
  # 파이프 안에서 돌아도 사람에게 묻도록 터미널에서 직접 읽는다. 터미널이 없으면(CI) SEED_FORCE=1 을 쓰라는 뜻이다.
  if [ "$STATUS" = "active" ]; then
    say "[주의] 회사 상태가 active 다 — 운영 중인 회사일 수 있다. 실수로 y 를 치는 것까지 막기 위해 이름을 받는다."
    read -r -p "  스키마 이름($SCHEMA)을 그대로 입력하면 진행한다: " ANSWER < /dev/tty || die "확인을 받을 수 없다. 자동화라면 SEED_FORCE=1."
    [ "$ANSWER" = "$SCHEMA" ] || die "중단했다. 아무것도 바꾸지 않았다."
  else
    read -r -p "  지우고 다시 넣을까? [y/N] " ANSWER < /dev/tty || die "확인을 받을 수 없다. 자동화라면 SEED_FORCE=1."
    case "$ANSWER" in y|Y) ;; *) die "중단했다. 아무것도 바꾸지 않았다." ;; esac
  fi
fi

echo
echo "== 재고·물류 + 제품설계 데모 데이터"
{
  # 위에서 형태를 확인했으므로 따옴표 없이 넣는다. 재고가 먼저다 — 설계의 BOM 이 재고 품목을 가리킨다.
  echo "SET search_path TO $SCHEMA;"
  cat "$DATA"
  cat "$DESIGN"
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
           || ' · 기준 '   || (select count(*) from inv_item_standards)
           || ' · 도면 '   || (select count(*) from dsg_drawings)
           || ' · BOM '    || (select count(*) from dsg_bom_lines)
           || ' (미매핑 '  || (select count(*) from dsg_bom_lines where item_code is null) || ')'"

echo
echo "  이제 데모 계정으로 로그인해 사이드바의 「제품설계」 · 「재고·물류」를 연다. 제품설계 기능은 이 시드가 켠다."
