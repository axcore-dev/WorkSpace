#!/usr/bin/env bash
#
# 영업 시연용 데모 워크스페이스 시드. 로컬과 배포 서버 둘 다에서 돌린다.
#
# 만드는 것: 데모 회사 1개, 소유자 1명, 구성원 5명(부서: 경영 · IT · 생산 · 물류).
# 전부 실제 사용자 경로(API)로 만든다 — 운영자가 개설 → 담당자가 접속 링크로 합류해 소유자가 되고
# → 소유자가 초대 링크를 만들어 구성원이 들어온다. SQL 은 이메일 확인 처리와 화면용 시각 채우기에만 쓴다.
#
# 보안 (저장소가 공개다)
#   - 계정 이메일·비밀번호는 환경 변수로만 받는다. 기본값이 없고, 비밀번호는 어디에도 찍지 않는다.
#   - 데모 계정 주소는 SEED_DEMO_MAILBOX 의 `+` 별칭이다(예: name+demo-owner@domain). 확인 메일이
#     전부 그 편지함 한 곳으로만 가고 외부로 나가지 않는다.
#   - 서버에서는 운영자 계정이 이미 있어야 한다. 이 스크립트가 운영자 권한을 만들지 않는다.
#
# 사용법 (서버: BE 는 127.0.0.1:8080, DB 컨테이너는 axcore-postgres 가 기본값이다)
#   SEED_ADMIN_EMAIL=<운영자 이메일> SEED_ADMIN_PASSWORD=<운영자 비밀번호> \
#   SEED_DEMO_MAILBOX=<우리 편지함> SEED_DEMO_PASSWORD=<시연용 비밀번호> \
#   bash INFRA/seed/seed-demo-workspace.sh
#
# 여러 번 돌려도 된다. 이미 있는 회사·계정·소속은 건너뛴다.

source "$(dirname "$0")/lib.sh"
require_env SEED_ADMIN_EMAIL SEED_ADMIN_PASSWORD SEED_DEMO_MAILBOX SEED_DEMO_PASSWORD

ADMIN_EMAIL="${SEED_ADMIN_EMAIL,,}"
MAILBOX="${SEED_DEMO_MAILBOX,,}"
DEMO_PW="$SEED_DEMO_PASSWORD"
is_email "$MAILBOX" || die "SEED_DEMO_MAILBOX 가 이메일 형식이 아니다"
is_password "$DEMO_PW" || die "SEED_DEMO_PASSWORD 는 영문·숫자·특수문자를 모두 포함한 8~16자여야 한다"

# name+demo-<alias>@domain
alias_email() { echo "${MAILBOX%@*}+demo-$1@${MAILBOX#*@}"; }

# ─────────────────────────────────────────────────────────── 데모 데이터

COMPANY_NAME="한결정밀 주식회사"
COMPANY_BIZ="8018112344"          # 국세청 체크섬을 통과하는 가상 번호
OWNER_NAME="김한결"
OWNER_EMAIL="$(alias_email owner)"
DEPARTMENTS=(경영 IT 생산 물류)

# 이름|부서|별칭
MEMBERS=(
  "박서연|경영|mgmt"
  "이도현|IT|it"
  "최민준|생산|prod1"
  "정하늘|생산|prod2"
  "강지우|물류|logi"
)

# ─────────────────────────────────────────────────────────── 0. 사전 확인

echo "== 0. 사전 확인"
check_stack

# ─────────────────────────────────────────────────────────── 1. 운영자

echo
echo "== 1. 운영자"
AT=$(operator_token "$ADMIN_EMAIL" "$SEED_ADMIN_PASSWORD")
[ -n "$AT" ] || exit 1

# ─────────────────────────────────────────────────────────── 2. 회사

echo
echo "== 2. 데모 회사"
WS_ID=$(psql_ "select id from shared.workspaces where biz_number = '$COMPANY_BIZ';")
if [ -n "$WS_ID" ]; then
  say "이미 있음: $COMPANY_NAME (id=$WS_ID)"
else
  body=$(cat <<EOF
{"name":"$COMPANY_NAME","bizNumber":"$COMPANY_BIZ","corpNumber":"1101118012345",
 "ceoName":"$OWNER_NAME","bizType":"제조업","bizItem":"정밀 기계부품 제조",
 "address":"경기 안산시 단원구 시화공단로 120","website":"https://hangyeol.example.com",
 "plan":"Growth","operatorName":"운영자","memo":"영업 시연용 데모 워크스페이스. 실제 고객이 아니다.",
 "contacts":{"contactName":"$OWNER_NAME","contactEmail":"$OWNER_EMAIL","contactPhone":"031-000-0000","ccEmails":[]}}
EOF
)
  code=$(api POST /api/admin/workspaces "$body" "$AT")
  [ "$code" = "201" ] || { echo "  [실패] 개설 → HTTP $code"; cat "$TMP/body"; echo; exit 1; }
  WS_ID=$(jget id)
  say "개설: $COMPANY_NAME (id=$WS_ID, $(jget schemaName))"
fi
SCHEMA=$(psql_ "select schema_name from shared.workspaces where id = $WS_ID;")
[ "$(psql_ "select status from shared.workspaces where id = $WS_ID;")" = "active" ] || die "workspace $WS_ID 가 active 가 아니다"

# ─────────────────────────────────────────────────────────── 3. 소유자

echo
echo "== 3. 소유자"
ensure_user "$OWNER_EMAIL" "$OWNER_NAME" "$DEMO_PW" || exit 1
if is_member "$OWNER_EMAIL" "$WS_ID"; then
  say "이미 소속: $OWNER_EMAIL"
else
  # 담당자 주소 앞으로 발급된 운영자 링크를 그 주소의 계정이 수락하면 소유자가 된다(BE 규칙).
  code=$(api POST "/api/admin/workspaces/$WS_ID/invitations" '{}' "$AT")
  [ "$code" = "201" ] || { echo "  [실패] 접속 링크 발급 → HTTP $code"; cat "$TMP/body"; echo; exit 1; }
  link=$(jget link); token="${link##*token=}"
  otoken=$(login_token "$OWNER_EMAIL" "$DEMO_PW")
  code=$(api POST /api/auth/invitations/accept "{\"token\":\"$token\"}" "$otoken")
  [ "$code" = "200" ] || { echo "  [실패] 소유자 합류 → HTTP $code"; cat "$TMP/body"; echo; exit 1; }
  say "합류: $OWNER_EMAIL → 소유자"
fi

# /api/workspace/* 는 회사를 고른 토큰(wsid)이어야 한다.
OT=$(login_token "$OWNER_EMAIL" "$DEMO_PW")
api POST "/api/auth/workspaces/$WS_ID/select" '' "$OT" >/dev/null
OT=$(jget accessToken)
[ -n "$OT" ] || die "소유자로 회사 선택 실패"

# ─────────────────────────────────────────────────────────── 4. 부서·직급

echo
echo "== 4. 부서"
declare -A DEPT_ID=()
for d in "${DEPARTMENTS[@]}"; do
  api GET /api/workspace/departments '' "$OT" >/dev/null
  id=$(jfind name "$d" id)
  if [ -z "$id" ]; then
    code=$(api POST /api/workspace/departments "{\"name\":\"$d\"}" "$OT")
    [ "$code" = "201" ] || [ "$code" = "200" ] || { echo "  [실패] 부서 $d → HTTP $code"; cat "$TMP/body"; echo; exit 1; }
    id=$(jget id); say "부서 생성: $d (id=$id)"
  else
    say "이미 있음: $d (id=$id)"
  fi
  DEPT_ID[$d]="$id"
done

# 소유자의 소속은 API 로 바꿀 수 없다(MemberService: 소유자 보호). 화면에 「미지정」으로 남지 않게만 채운다.
psql_ "update $SCHEMA.members set department_id = ${DEPT_ID[경영]} where user_id = (select id from shared.users where email = '$OWNER_EMAIL') and department_id is null;" >/dev/null

api GET /api/workspace/roles '' "$OT" >/dev/null
MEMBER_ROLE=$(jfind code member id)
[ -n "$MEMBER_ROLE" ] || die "구성원(member) 직급을 찾지 못했다"

# ─────────────────────────────────────────────────────────── 5. 구성원

echo
echo "== 5. 구성원"
for row in "${MEMBERS[@]}"; do
  IFS='|' read -r name dept alias <<< "$row"
  email="$(alias_email "$alias")"

  ensure_user "$email" "$name" "$DEMO_PW" || continue
  if is_member "$email" "$WS_ID"; then
    say "이미 소속: $email"
    continue
  fi

  # 1인용·1일 링크를 사람마다 하나씩 만든다. 남는 링크가 없고, 부서가 링크에 실려 들어간다.
  code=$(api POST /api/workspace/invite-links \
    "{\"roleId\":$MEMBER_ROLE,\"departmentId\":${DEPT_ID[$dept]},\"maxUses\":1,\"expiresInDays\":1}" "$OT")
  [ "$code" = "201" ] || [ "$code" = "200" ] || { echo "  [실패] 초대 링크 $name → HTTP $code"; cat "$TMP/body"; echo; continue; }
  url=$(jget url); token="${url##*token=}"

  mtoken=$(login_token "$email" "$DEMO_PW")
  code=$(api POST /api/auth/invite-links/accept "{\"token\":\"$token\"}" "$mtoken")
  if [ "$code" = "200" ]; then
    say "합류: $name ($dept) $email"
  else
    echo "  [실패] 수락 $email → HTTP $code"; cat "$TMP/body"; echo
  fi
done

# 마지막 접속 시각이 비어 있으면 화면에 "—" 로 보인다. 시연용으로 최근 5일 안의 시각을 채운다.
psql_ "update $SCHEMA.members set last_active_at = now() - (random() * interval '5 days') where last_active_at is null;" >/dev/null

# ─────────────────────────────────────────────────────────── 6. 요약

echo
echo "== 6. 결과 — $COMPANY_NAME (id=$WS_ID, $SCHEMA)"
psql_ "select '  ' || rpad(coalesce(r.name,'-'), 6) || rpad(coalesce(d.name,'미지정'), 6) || rpad(u.name, 8) || u.email
       from $SCHEMA.members m join shared.users u on u.id = m.user_id
       left join $SCHEMA.roles r on r.id = m.role_id left join $SCHEMA.departments d on d.id = m.department_id
       where m.status <> 'left' order by r.id, d.id, u.name;"
echo
echo "  비밀번호는 SEED_DEMO_PASSWORD 로 넘긴 값이다. 확인 메일은 전부 $MAILBOX 로 갔다."
