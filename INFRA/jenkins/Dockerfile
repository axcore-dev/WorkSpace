# Jenkins 컨트롤러 + docker CLI.
#
# 빌드·배포는 이 컨테이너 안에서 `docker compose` 를 실행해 호스트의 Docker 데몬(소켓 마운트)에
# 시키는 구조다. 데몬은 넣지 않고 CLI 와 compose/buildx 플러그인만 얹는다.
# 소켓 접근 권한은 docker-compose.jenkins.yml 의 group_add(DOCKER_GID) 로 준다.
FROM jenkins/jenkins:lts-jdk21

USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
 && install -m 0755 -d /etc/apt/keyrings \
 && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
 && chmod a+r /etc/apt/keyrings/docker.asc \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
      https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
      > /etc/apt/sources.list.d/docker.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin docker-buildx-plugin \
 && rm -rf /var/lib/apt/lists/*
USER jenkins
