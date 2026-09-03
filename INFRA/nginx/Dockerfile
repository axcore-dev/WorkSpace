# 리버스 프록시. 설정을 바인드 마운트하지 않고 이미지에 굽는다 —
# Jenkins 컨테이너 안에서 compose 를 실행할 때 호스트 경로와 컨테이너 경로가 달라
# 바인드 마운트가 엉뚱한 곳을 가리키는 문제를 피하기 위함이다.
FROM nginx:1.27-alpine
COPY default.conf /etc/nginx/conf.d/default.conf
