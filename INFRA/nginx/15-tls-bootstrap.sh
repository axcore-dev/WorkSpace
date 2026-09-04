#!/bin/sh
# TLS 부트스트랩 (nginx 이미지의 /docker-entrypoint.d 에서 nginx 기동 전에 실행된다).
#
# 문제: 443 server 블록은 인증서 파일이 없으면 nginx 가 뜨지 않는다. 그런데 Let's Encrypt 는
# nginx 가 80 에서 챌린지를 서빙해야 발급된다 — 닭과 달걀이다.
#
# 해결: 인증서가 없으면 임시 자체서명 인증서로 먼저 뜬다. certbot 컨테이너가 letsencrypt 볼륨에
# 발급하면, 아래 감시 루프가 60초 안에 알아채서 링크를 바꾸고 reload 한다. 갱신도 같은 경로로
# 처리된다(파일 mtime 변화). nginx 설정은 /etc/nginx/ssl-current/ 고정 경로만 본다.
set -eu

: "${PUBLIC_HOST:?PUBLIC_HOST 환경변수가 필요하다 (예: www.axcore.it.kr, 로컬은 localhost)}"

LIVE="/etc/letsencrypt/live/${PUBLIC_HOST}"
SELF="/etc/nginx/selfsigned"
CUR="/etc/nginx/ssl-current"

has_live() { [ -f "$LIVE/fullchain.pem" ] && [ -f "$LIVE/privkey.pem" ]; }
live_stamp() { stat -L -c %Y "$LIVE/fullchain.pem" 2>/dev/null || echo 0; }

last=""
if has_live; then
  ln -sfn "$LIVE" "$CUR"
  last="$(live_stamp)"
  echo "[tls] Let's Encrypt 인증서 사용: $LIVE"
else
  mkdir -p "$SELF"
  # 30일짜리 임시 인증서. 컨테이너 파일시스템에만 있어 재시작마다 새로 만든다.
  openssl req -x509 -nodes -newkey rsa:2048 -days 30 -subj "/CN=${PUBLIC_HOST}" \
    -keyout "$SELF/privkey.pem" -out "$SELF/fullchain.pem" >/dev/null 2>&1
  ln -sfn "$SELF" "$CUR"
  echo "[tls] 인증서가 없어 임시 자체서명으로 시작한다. certbot 이 발급하면 60초 안에 자동 전환된다."
fi

# 감시 루프. 백그라운드로 남겨 두면 엔트리포인트가 nginx 를 exec 한 뒤에도 살아 있다.
# nginx -s reload 는 pid 파일로 마스터에 신호를 보내므로 여기서도 동작한다.
(
  while sleep 60; do
    has_live || continue
    now="$(live_stamp)"
    if [ "$(readlink "$CUR" 2>/dev/null || true)" != "$LIVE" ] || [ "$now" != "$last" ]; then
      ln -sfn "$LIVE" "$CUR"
      if nginx -t >/dev/null 2>&1 && nginx -s reload; then
        echo "[tls] 인증서 변경 감지 → nginx reload ($LIVE)"
        last="$now"
      else
        echo "[tls] 인증서 변경을 감지했지만 reload 에 실패했다. nginx -t 출력을 확인하라"
      fi
    fi
  done
) &
