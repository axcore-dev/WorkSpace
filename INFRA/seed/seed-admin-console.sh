#!/usr/bin/env bash
#
# 운영자 콘솔 개발용 시드. **로컬 전용** — API_BASE 가 localhost 가 아니면 시작하지 않는다.
#
# 로컬에서 화면을 실제 데이터로 보려면 최소한 (1) 운영자 계정과 (2) 회사 몇 개가 있어야 한다.
# 이 스크립트는 둘 다 만든다.
#
# **API 로 만든다.** 워크스페이스를 SQL 로 직접 INSERT 하면 테넌트 스키마가 생기지 않아
# 구성원 탭이 영원히 비어 있는 반쪽 데이터가 된다. 실제 개설 경로를 그대로 태워야 스키마와
# 기본 역할까지 선다.
#
# SQL 을 쓰는 곳은 세 군데뿐이다.
#   - is_internal_admin 켜기 — 애플리케이션에 그 경로가 없다(의도된 설계)
#   - 이메일 확인 처리   — 메일을 보내지 않는 개발 환경에서 토큰을 긁어오지 않으려고
#   - 상태 되돌리기      — 대기중(provisioning) 은 정상 경로로 만들 수 없다
#
# 사용법:
#   docker compose -f INFRA/docker-compose.db.yml up -d
#   cd BE && ./gradlew bootRun          # 다른 터미널에서
#   SEED_ADMIN_EMAIL=<운영자 이메일> SEED_ADMIN_PASSWORD=<비밀번호> bash INFRA/seed/seed-admin-console.sh
#
# 계정 정보는 환경 변수로만 받는다(저장소가 공개라 기본값을 두지 않는다). 가상 회사의 담당자
# 주소는 예약 도메인(example.com)이라 어디로도 배달되지 않는다.
# 여러 번 돌려도 된다. 이미 있는 계정·사업자번호는 건너뛴다.

source "$(dirname "$0")/lib.sh"
require_local
require_env SEED_ADMIN_EMAIL SEED_ADMIN_PASSWORD

ADMIN_EMAIL="${SEED_ADMIN_EMAIL,,}"
ADMIN_PW="$SEED_ADMIN_PASSWORD"
is_password "$ADMIN_PW" || die "SEED_ADMIN_PASSWORD 는 영문·숫자·특수문자를 모두 포함한 8~16자여야 한다"

# ─────────────────────────────────────────────────────────── 0. 사전 확인

echo "== 0. 사전 확인"
check_stack

# ─────────────────────────────────────────────────────────── 1. 운영자

echo
echo "== 1. 운영자 계정"
AT=$(operator_token "$ADMIN_EMAIL" "$ADMIN_PW")
[ -n "$AT" ] || exit 1

# ─────────────────────────────────────────────────────────── 2. 회사

echo
echo "== 2. 회사 개설"

# 사업자등록번호는 국세청 체크섬을 통과하는 값이다. 화면의 조회 버튼이 실제로 검증한다.
# (FE data/admin.ts 의 isValidBizNumber 와 같은 식)
#
# 형식: 상호|사업자번호|법인번호|업태|종목|주소|홈페이지|요금제|담당자명|담당이메일|전화|메모
COMPANIES=(
  "한빛제철 주식회사|1234567891|1101111234567|제조업|1차 철강 제조|경북 포항시 남구 철강로 12|https://hanbit-steel.example.com|Enterprise|김구매|kim@hanbit.example.com|054-000-0000|포항 2공장 MES 인증 정보 재발급 대기 중."
  "대성화학 주식회사|2148801232|1101112345678|제조업|기초 화학물질 제조|울산 남구 여천로 88|https://daesung-chem.example.com|Growth|정관리|jung@daesung.example.com|052-000-0000|"
  "서진모빌리티 주식회사|3058155511|1101113456789|제조업|자동차 부품 제조|경기 화성시 동탄산단로 7||Growth|오총무|oh@seojin.example.com|031-000-0000|접속 링크 미개봉. 유선 확인 예정."
  "청림식품 주식회사|4128677123|1101114567890|제조업|기타 식품 제조|전남 나주시 식품로 3|https://cheongrim-food.example.com|Growth|강대리|kang@cheongrim-food.example.com|061-000-0000|7월분 미수금. 입금 확인 후 재개."
  "남양정밀 주식회사|5018112347|1101115678901|제조업|금속 가공기계 제조|경남 창원시 성산구 공단로 41|https://ny-precision.example.com|Starter|윤사원|yoon@ny-precision.example.com|055-000-0000|"
  "태양전자 주식회사|6068623450|1101116789012|제조업|전자부품 제조|충북 청주시 흥덕구 산단로 22|https://ty-electronics.example.com|Enterprise|노팀장|noh@ty-electronics.example.com|043-000-0000|"
  "신흥포장 주식회사|7188134560|1101117890123|제조업|골판지 상자 제조|인천 서구 검단로 9||Starter|임과장|lim@sinheung.example.com|032-000-0000|"
)

declare -a WS_IDS=()
declare -a WS_EMAILS=()

for row in "${COMPANIES[@]}"; do
  IFS='|' read -r name biz corp btype bitem addr site plan cname cmail cphone memo <<< "$row"

  existing=$(psql_ "select id from shared.workspaces where biz_number = '$biz';")
  if [ -n "$existing" ]; then
    say "이미 있음: $name (id=$existing)"
    WS_IDS+=("$existing"); WS_EMAILS+=("$cmail")
    continue
  fi

  body=$(node -e '
    const [name,biz,corp,btype,bitem,addr,site,plan,cname,cmail,cphone,memo] = process.argv.slice(1);
    process.stdout.write(JSON.stringify({
      name, bizNumber: biz, corpNumber: corp || undefined,
      bizType: btype, bizItem: bitem, address: addr,
      website: site || undefined, plan, operatorName: "운영자",
      memo: memo || undefined,
      contacts: { contactName: cname, contactEmail: cmail, contactPhone: cphone, ccEmails: [] },
    }));
  ' "$name" "$biz" "$corp" "$btype" "$bitem" "$addr" "$site" "$plan" "$cname" "$cmail" "$cphone" "$memo")

  code=$(api POST /api/admin/workspaces "$body" "$AT")
  if [ "$code" != "201" ]; then
    echo "  [실패] 개설 $name → HTTP $code"; cat "$TMP/body"; echo
    continue
  fi
  id=$(jget id); schema=$(jget schemaName)
  say "개설: $name (id=$id, $schema)"
  WS_IDS+=("$id"); WS_EMAILS+=("$cmail")
done

# ─────────────────────────────────────────────────────────── 3. 구성원

echo
echo "== 3. 구성원 (앞 4개 회사에 담당자 합류)"

for i in 0 1 2 3; do
  id="${WS_IDS[$i]:-}"; email="${WS_EMAILS[$i]:-}"
  [ -z "$id" ] && continue

  already=$(psql_ "select count(*) from shared.user_workspace_memberships where workspace_id = $id;")
  if [ "$already" != "0" ]; then
    say "이미 구성원 있음: workspace $id"
    continue
  fi

  # 링크는 운영 중인 회사에만 발급된다. 이전 실행에서 중지·해지된 회사가 남아 있으면
  # 여기서 409 가 나므로 먼저 걸러 낸다.
  st=$(psql_ "select status from shared.workspaces where id = $id;")
  if [ "$st" != "active" ]; then
    say "건너뜀: workspace $id 는 $st 상태라 링크를 발급할 수 없다"
    continue
  fi

  code=$(api POST "/api/admin/workspaces/$id/invitations" '{}' "$AT")
  if [ "$code" != "201" ]; then
    echo "  [실패] 링크 발급 workspace $id → HTTP $code"; continue
  fi
  link=$(jget link); token="${link##*token=}"

  ensure_user "$email" "담당자" "$ADMIN_PW" || continue
  mtoken=$(login_token "$email" "$ADMIN_PW")
  code=$(api POST /api/auth/invitations/accept "{\"token\":\"$token\"}" "$mtoken")
  if [ "$code" = "200" ]; then
    say "합류: $email → workspace $id"
    # 마지막 접속 시각이 없으면 목록의 「마지막 활동」이 전부 "—" 로 보인다.
    schema=$(psql_ "select schema_name from shared.workspaces where id = $id;")
    psql_ "update $schema.members set last_active_at = now() - (random() * interval '5 days');" >/dev/null
  else
    echo "  [실패] 수락 $email → HTTP $code"; cat "$TMP/body"; echo
  fi
done

# ─────────────────────────────────────────────────────────── 4. 상태 다양화

echo
echo "== 4. 상태 섞기 (화면에서 배지·필터를 보려면 상태가 골고루 있어야 한다)"

# 청림식품 → 비활성화
if [ -n "${WS_IDS[3]:-}" ]; then
  code=$(api POST "/api/admin/workspaces/${WS_IDS[3]}/suspend" '' "$AT")
  [ "$code" = "200" ] && say "비활성화: workspace ${WS_IDS[3]}" || say "비활성화 건너뜀 (HTTP $code)"
fi

# 신흥포장 → 개설 직후 그대로 두면 active 다. 대기중(pending)을 보려면 프로비저닝 전
# 상태가 필요한데, 정상 경로로는 만들 수 없다(성공하면 곧바로 active). 화면 확인용으로만
# 마지막 회사를 provisioning 으로 되돌린다.
if [ -n "${WS_IDS[6]:-}" ]; then
  psql_ "update shared.workspaces set status = 'provisioning' where id = ${WS_IDS[6]};" >/dev/null
  say "대기중으로 표시: workspace ${WS_IDS[6]} (화면 확인용)"
fi

# ─────────────────────────────────────────────────────────── 5. 요약

echo
echo "== 5. 결과"
psql_ "select '  ' || w.id || '  ' || rpad(w.schema_name, 10) || rpad(w.status, 14) || w.name from shared.workspaces w order by w.id;"

echo
echo "  감사 기록 $(psql_ "select count(*) from shared.admin_audit_logs;")건"
echo
echo "  이제 FE 를 띄우고 운영자 계정($ADMIN_EMAIL)으로 로그인하면 /admin 으로 들어간다."
echo "     cd FE && npm run dev        # http://localhost:8000"
