#!/bin/sh
# Let's Encrypt 발급·갱신 루프.
#
#   TLS_DOMAINS 비어 있음 → 아무것도 하지 않고 대기 (로컬). nginx 는 자체서명으로 동작한다.
#   인증서 없음           → webroot 방식으로 발급. 실패하면 15분 뒤 재시도 (LE 실패 한도: 시간당 5회).
#   인증서 있음           → 12시간마다 `certbot renew`. 만료 30일 전부터 실제로 갱신된다.
#
# nginx 는 인증서 파일 변경을 스스로 감지해 reload 하므로(nginx/15-tls-bootstrap.sh) 여기서 nginx 를
# 건드리지 않는다. 인증서는 letsencrypt 볼륨(/etc/letsencrypt)에 남는다 — 앱 compose 를 `down -v` 로
# 내리면 같이 지워지고 재발급이 필요하니 주의 (주간 발급 한도: 도메인당 50개).
set -u

WEBROOT=/var/www/certbot
mkdir -p "$WEBROOT"

if [ -z "${TLS_DOMAINS:-}" ]; then
  echo "[certbot] TLS_DOMAINS 가 비어 있어 발급하지 않는다 (로컬 모드). nginx 는 자체서명 인증서로 동작한다."
  while :; do sleep 86400; done
fi

: "${PUBLIC_HOST:?PUBLIC_HOST 환경변수가 필요하다 (인증서 이름, 예: www.axcore.it.kr)}"
: "${CERTBOT_EMAIL:?CERTBOT_EMAIL 환경변수가 필요하다 (만료 안내를 받는 주소)}"

LIVE="/etc/letsencrypt/live/${PUBLIC_HOST}"

# "a.com,b.com" → -d a.com -d b.com
set --
for d in $(printf '%s' "$TLS_DOMAINS" | tr ',' ' '); do
  set -- "$@" -d "$d"
done

# docker stop 에 바로 응답하도록 sleep 을 백그라운드로 두고 기다린다.
trap 'echo "[certbot] 종료"; exit 0' TERM INT
pause() { sleep "$1" & wait $!; }

while :; do
  if [ ! -f "$LIVE/fullchain.pem" ]; then
    echo "[certbot] 인증서 없음 → 발급 시도: ${TLS_DOMAINS} (cert-name=${PUBLIC_HOST})"
    if certbot certonly --webroot -w "$WEBROOT" --cert-name "$PUBLIC_HOST" "$@" \
         --email "$CERTBOT_EMAIL" --agree-tos --no-eff-email --non-interactive; then
      echo "[certbot] 발급 완료. nginx 가 60초 안에 새 인증서로 전환한다."
    else
      echo "[certbot] 발급 실패. 15분 뒤 재시도한다. 확인할 것: DNS 가 이 서버를 가리키는지, ACG 80 이 0.0.0.0/0 인지, axcore-nginx 가 healthy 인지"
      pause 900
      continue
    fi
  fi

  if certbot renew --webroot -w "$WEBROOT" --non-interactive --quiet; then
    echo "[certbot] renew 점검 완료 ($(date '+%F %T')). 다음 점검은 12시간 뒤"
  else
    echo "[certbot] renew 실패. 12시간 뒤 다시 시도한다"
  fi
  pause 43200
done
