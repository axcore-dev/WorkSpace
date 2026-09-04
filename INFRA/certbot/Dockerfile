# Let's Encrypt 발급·갱신 컨테이너. nginx 와 letsencrypt / certbot-www 볼륨을 공유한다.
#
# 발급 방식은 webroot(HTTP-01)다. certbot 이 /var/www/certbot/.well-known/acme-challenge/ 에 토큰을
# 쓰고, nginx(:80) 가 같은 볼륨을 그 경로로 서빙한다. 그래서 nginx 가 먼저 떠 있어야 하고,
# ACG 에서 80 이 전체 개방(0.0.0.0/0)이어야 한다 — Let's Encrypt 서버가 들어와야 하기 때문이다.
#
# 엔트리포인트는 "없으면 발급, 있으면 12시간마다 renew" 루프다 (entrypoint.sh).
# 설정은 이미지에 굽는다 (바인드 마운트를 쓰지 않는 이유는 nginx/Dockerfile 과 같다).
FROM certbot/certbot:v2.11.0

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
