#!/usr/bin/env bash
#
# 시드 스크립트 공용 함수. 각 시드가 `source "$(dirname "$0")/lib.sh"` 로 불러 쓴다.
#
# 이 저장소는 공개(public)다. 여기와 시드 스크립트에는 계정 이메일·비밀번호·회사 식별정보를
# 기본값으로 두지 않는다. 전부 환경 변수로 받고, 비어 있으면 시작 전에 멈춘다(require_env).
# 비밀번호는 로그·요약 어디에도 찍지 않는다.
#
# 호스트에 필요한 것: bash · curl · docker. JSON 은 node → python3 → FE 컨테이너의 node 순으로
# 있는 것을 쓴다(아래 _json_runner).

set -u

BASE="${API_BASE:-http://localhost:8080}"
PG="${PG_CONTAINER:-axcore-postgres}"
FE_CONTAINER="${FE_CONTAINER:-axcore-fe}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

say() { echo "  $*" >&2; }
die() { echo "  [중단] $*" >&2; exit 1; }

# 빠진 환경 변수가 있으면 무엇이 빠졌는지 전부 알려주고 멈춘다.
require_env() {
  local missing=()
  for name in "$@"; do
    [ -n "${!name:-}" ] || missing+=("$name")
  done
  [ ${#missing[@]} -eq 0 ] || die "환경 변수가 비어 있다: ${missing[*]}"
}

# 로컬 전용 시드가 실수로 서버를 향하지 않게 막는다.
require_local() {
  case "$BASE" in
    http://localhost:*|http://localhost|http://127.0.0.1:*|http://127.0.0.1) ;;
    *) die "이 시드는 로컬 전용이다. API_BASE=$BASE 로는 실행하지 않는다." ;;
  esac
}

# 이메일은 SQL 문자열과 JSON 에 그대로 들어간다. 허용 문자만 통과시킨다.
is_email() { [[ "$1" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; }

# BE 의 SignUpRequest 와 같은 규칙. 서버에서 400 을 보고 알기보다 시작 전에 안다.
is_password() {
  local p="$1"
  [ ${#p} -ge 8 ] && [ ${#p} -le 16 ] && [[ "$p" =~ [A-Za-z] ]] && [[ "$p" =~ [0-9] ]] && [[ "$p" =~ [^A-Za-z0-9] ]]
}

# 본문은 파일로 보낸다. Git Bash 는 인라인 인자의 한글을 로컬 코드페이지로 바꿔 보내서
# JSON 이 깨진다(MALFORMED_REQUEST). 응답 본문은 $TMP/body, 반환값은 HTTP 상태 코드.
api() {
  local method="$1" path="$2" body="${3:-}" token="${4:-}"
  local args=(-s -o "$TMP/body" -w '%{http_code}' -X "$method" "$BASE$path"
              -H 'Content-Type: application/json; charset=UTF-8')
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  if [ -n "$body" ]; then
    printf '%s' "$body" > "$TMP/req.json"
    args+=(--data-binary "@$TMP/req.json")
  fi
  curl "${args[@]}"
}

# JSON 읽기. 호스트에 node 가 있으면 node, 없으면 python3(Ubuntu 서버 기본), 둘 다 없으면
# 떠 있는 FE 컨테이너(node:alpine)의 node 를 빌린다. 응답은 항상 표준입력으로 넘기므로
# 컨테이너 안에서도 호스트 파일 경로가 필요 없고, 질의어를 셸 인자로 넘겨 한글이 깨지는 일도 없다.
_json_runner() {
  if command -v node >/dev/null 2>&1; then echo node
  elif command -v python3 >/dev/null 2>&1 && python3 -c 'import json' >/dev/null 2>&1; then echo python3
  elif docker exec "$FE_CONTAINER" node -v >/dev/null 2>&1; then echo docker-node
  else die "node 나 python3 가 없고 컨테이너 $FE_CONTAINER 도 없다. 셋 중 하나가 필요하다"
  fi
}
JSON_RUNNER="$(_json_runner)"

_node() {
  case "$JSON_RUNNER" in
    node) node "$@" ;;
    docker-node) docker exec -i "$FE_CONTAINER" node "$@" ;;
  esac
}

# jget <경로> — 점으로 이은 키·인덱스. 예: accessToken / invitation.id / 0.id
jget() {
  case "$JSON_RUNNER" in
    node|docker-node) _node -e '
      try { let v = JSON.parse(require("fs").readFileSync(0, "utf8"));
            for (const k of process.argv[1].split(".")) v = v == null ? v : v[k];
            console.log(v == null ? "" : v); } catch (e) { console.log(""); }' "$1" < "$TMP/body" ;;
    python3) python3 -c '
import json, sys
try:
    v = json.load(sys.stdin)
    for k in sys.argv[1].split("."):
        v = v[int(k)] if isinstance(v, list) else v.get(k)
        if v is None: break
    print("" if v is None else (str(v).lower() if isinstance(v, bool) else v))
except Exception:
    print("")' "$1" < "$TMP/body" ;;
  esac
}

# jfind <키> <값> <꺼낼 키> — 최상위 배열에서 키=값인 첫 원소의 필드. 없으면 빈 문자열.
jfind() {
  case "$JSON_RUNNER" in
    node|docker-node) _node -e '
      try { const a = JSON.parse(require("fs").readFileSync(0, "utf8"));
            const e = a.find(x => String(x[process.argv[1]]) === process.argv[2]);
            console.log(e == null || e[process.argv[3]] == null ? "" : e[process.argv[3]]); } catch (e) { console.log(""); }' \
      "$1" "$2" "$3" < "$TMP/body" ;;
    python3) python3 -c '
import json, sys
try:
    a = json.load(sys.stdin)
    e = next((x for x in a if str(x.get(sys.argv[1])) == sys.argv[2]), None)
    v = None if e is None else e.get(sys.argv[3])
    print("" if v is None else v)
except Exception:
    print("")' "$1" "$2" "$3" < "$TMP/body" ;;
  esac
}

psql_() {
  docker exec "$PG" sh -c "psql -qtAX -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -c \"$1\""
}

# BE 와 DB 컨테이너가 살아 있는지. 둘 중 하나라도 없으면 아무것도 만들기 전에 멈춘다.
check_stack() {
  [ "$(api GET /actuator/health)" = "200" ] || die "BE 가 $BASE 에서 응답하지 않는다."
  say "BE 응답 확인 ($BASE)"
  docker exec "$PG" true 2>/dev/null || die "컨테이너 $PG 가 없다."
  say "DB 컨테이너 확인 ($PG)"
  say "JSON 도구: $JSON_RUNNER"
}

# 가입 → 이메일 확인까지. 이미 있으면 건너뛴다.
# 확인 처리는 SQL 로 한다 — 개발 환경은 메일을 보내지 않고, 서버에서는 우리 편지함으로만 보내기 때문이다.
ensure_user() {
  local email="$1" name="$2" password="$3" code
  is_email "$email" || die "이메일 형식이 아니다: $email"
  code=$(api POST /api/auth/signup "{\"email\":\"$email\",\"password\":\"$password\",\"name\":\"$name\"}")
  case "$code" in
    201) say "가입: $email" ;;
    409) say "이미 있음: $email" ;;
    *)   echo "  [실패] 가입 $email → HTTP $code"; cat "$TMP/body"; echo; return 1 ;;
  esac
  psql_ "update shared.users set email_verified_at = coalesce(email_verified_at, now()) where email = '$email';" >/dev/null
}

login_token() {
  local email="$1" password="$2"
  api POST /api/auth/login "{\"email\":\"$email\",\"password\":\"$password\"}" >/dev/null
  jget accessToken
}

# 운영자(내부 관리자) 토큰. 로컬에서는 없으면 만들어 주고, 서버에서는 이미 있어야 한다 —
# 서버의 운영자 권한을 스크립트가 만들어 내면 안 된다.
operator_token() {
  local email="$1" password="$2" token flag
  case "$BASE" in
    http://localhost*|http://127.0.0.1*)
      ensure_user "$email" "운영자" "$password" || return 1
      psql_ "update shared.users set is_internal_admin = true where email = '$email';" >/dev/null ;;
  esac
  flag=$(psql_ "select is_internal_admin from shared.users where email = '$email';")
  [ "$flag" = "t" ] || die "$email 은 내부 운영자가 아니다. 운영자 계정으로 다시 실행한다."
  token=$(login_token "$email" "$password")
  [ -n "$token" ] || die "운영자 로그인 실패: $email"
  say "운영자 로그인: $email"
  echo "$token"
}

# 소속 여부. shared 라우팅 인덱스 기준.
is_member() {
  local email="$1" ws_id="$2" n
  n=$(psql_ "select count(*) from shared.user_workspace_memberships m join shared.users u on u.id = m.user_id where u.email = '$email' and m.workspace_id = $ws_id;")
  [ "$n" != "0" ]
}
