# 리버스 프록시 + TLS 종단. 설정을 바인드 마운트하지 않고 이미지에 굽는다 —
# Jenkins 컨테이너 안에서 compose 를 실행할 때 호스트 경로와 컨테이너 경로가 달라
# 바인드 마운트가 엉뚱한 곳을 가리키는 문제를 피하기 위함이다.
#
# TLS 는 두 조각으로 나뉜다.
#   - 이 컨테이너: 80 에서 ACME 챌린지 서빙 + HTTPS 리다이렉트, 443 에서 앱 프록시.
#     인증서가 아직 없으면 15-tls-bootstrap.sh 가 임시 자체서명 인증서로 띄우고,
#     certbot 이 발급·갱신하면 파일 변경을 보고 스스로 reload 한다.
#   - certbot 컨테이너(INFRA/certbot): Let's Encrypt 발급·갱신. 인증서는 letsencrypt 볼륨으로 공유한다.
#
# default.conf.template 은 nginx 이미지의 envsubst 단계(20-envsubst-on-templates.sh)가
# ${PUBLIC_HOST} 를 채워 /etc/nginx/conf.d/default.conf 로 만든다. 환경변수로 정의된 이름만
# 치환되므로 $host, $scheme 같은 nginx 변수는 건드리지 않는다.
FROM nginx:1.27-alpine

# 임시 자체서명 인증서 생성용.
RUN apk add --no-cache openssl \
 && rm -f /etc/nginx/conf.d/default.conf \
 && mkdir -p /etc/nginx/snippets /var/www/certbot

COPY default.conf.template /etc/nginx/templates/default.conf.template
COPY tls.conf              /etc/nginx/snippets/tls.conf
COPY 15-tls-bootstrap.sh   /docker-entrypoint.d/15-tls-bootstrap.sh
RUN chmod +x /docker-entrypoint.d/15-tls-bootstrap.sh
