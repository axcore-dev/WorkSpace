# CI/CD — Jenkins + docker compose

한 대의 서버(Naver Cloud, Ubuntu 24.04 / 2 vCPU / 8GB / 50GB)에서 Jenkins 가 코드를 받아 검사하고,
같은 서버의 Docker 에 `docker compose` 로 올린다. 외부에서 들어오는 문은 nginx 하나다.

```
[GitHub dev] ──(Jenkins 파라미터 빌드)──▶ Jenkins 컨테이너 ──docker.sock──▶ 호스트 Docker
                                                                           │
                              :80 ──▶ nginx ──┬── /api/ ──▶ axcore-be  (Spring, 8080)
                                              └── /      ──▶ axcore-fe  (Next.js, 8000)
                                                            axcore-postgres (5432, 내부만)
                              :8081 ──▶ axcore-jenkins
```

| 구성 | 파일 | 누가 띄우나 |
| --- | --- | --- |
| Jenkins | `INFRA/docker-compose.jenkins.yml`, `INFRA/jenkins/Dockerfile` | 사람이 서버에서 1회 |
| DB | `INFRA/docker-compose.db.yml` | Jenkins (`APP_WITH_DB` / `DB_ONLY`) |
| BE · FE · nginx | `INFRA/docker-compose.yml`, `BE/Dockerfile`, `FE/Dockerfile`, `INFRA/nginx/` | Jenkins (`APP_*`) |
| 파이프라인 | `Jenkinsfile` (리포 루트) | Jenkins 가 SCM 에서 읽음 |

SonarQube 는 이번에 넣지 않았다. 8GB 에서 Elasticsearch 를 함께 띄우면 빌드 피크가 넘쳐서, 서버를
올린 뒤에 붙인다(「남은 일」). CodeRabbit 은 GitHub App 이라 서버 자원을 쓰지 않는다.

## 1. 서버 준비 (1회)

```bash
# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"      # 재로그인 필요

# 앱·DB 가 공유하는 네트워크
docker network create axcore-net

# Jenkins 홈. 컨테이너 안 jenkins 사용자(uid 1000)가 써야 한다.
sudo mkdir -p /var/jenkins_home && sudo chown 1000:1000 /var/jenkins_home

# docker.sock 의 그룹 ID → INFRA/.env 의 DOCKER_GID
stat -c %g /var/run/docker.sock

# 스왑 4GB (8GB 에서 빌드 피크를 흡수한다)
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

방화벽(Naver Cloud ACG)은 80(nginx), 8081(Jenkins, 가능하면 사무실 IP 만) 만 연다.
5432 · 8080 · 8000 은 열지 않는다 — compose 가 127.0.0.1 에만 묶어 두었다.

## 2. INFRA/.env (서버용)

값은 리포에 넣지 않는다. 서버에서 파일을 만들고, 같은 내용을 Jenkins 크리덴셜(Secret file)로도 등록한다.
파이프라인은 크리덴셜 쪽을 매번 `INFRA/.env` 로 복사해 쓰고 끝나면 지운다.

**compose 파일에는 기본값이 없다.** 아래 24개 키가 전부 `.env` 에 있어야 한다. 빠진 키는 빈 값으로
들어가고(`POSTGRES_PASSWORD` · `JWT_SECRET` 만 compose 가 막는다), 포트 키가 비면 `up` 자체가 실패한다.
compose 가 읽는 키와 `.env` 의 키는 1:1 이다 — `.env` 에 다른 키를 두지 않는다.

| 키 | 용도 | 서버 값 |
| --- | --- | --- |
| `POSTGRES_DB` `POSTGRES_USER` `POSTGRES_PASSWORD` `POSTGRES_PORT` | DB | `workspace` / `workspace` / 32자 랜덤 / `5432`. compose 가 이 값으로 BE 의 `DB_URL` `DB_USERNAME` `DB_PASSWORD` 를 조립한다 |
| `APP_PORT` `FE_PORT` `HTTP_PORT` | 호스트 포트 | `8080` / `8000` / `80`. 앞 둘은 127.0.0.1 에만 묶인다 |
| `SPRING_PROFILES_ACTIVE` | BE 프로필 | `prod` (로컬은 `local`) |
| `BE_HEAP` | BE 힙 상한 | `512m` |
| `JWT_SECRET` | BE 토큰 서명 | 32바이트 이상. 없으면 compose 가 막는다 |
| `PUBLIC_URL` | 사용자가 브라우저에 치는 주소 | `http://<서버IP>` → 도메인·HTTPS 붙이면 `https://...`. CORS 허용 오리진, 메일 링크, OAuth 콜백이 전부 이 값에서 나온다 |
| `AUTH_COOKIE_SECURE` | refresh 쿠키 Secure | HTTP 인 동안 `false`, HTTPS 붙이면 `true` |
| `GOOGLE_CLIENT_ID` `GOOGLE_CLIENT_SECRET` | 소셜 로그인 | 비우면 그 제공자만 비활성. FE 번들에도 같은 client-id 가 들어간다 |
| `NAVER_CLIENT_ID` `NAVER_CLIENT_SECRET` | 소셜 로그인 | 위와 같다 |
| `NEXT_PUBLIC_API_BASE_URL` | FE → API 주소 | nginx 뒤라 **비운다**(빈 문자열). 그러면 같은 오리진 `/api/...` 를 부른다 |
| `MAIL_MODE` `MAIL_FROM` `LOG_REQUESTS` `LOG_APP_LEVEL` | BE 운영 옵션 | `log` / `no-reply@axcore.ai.kr` / `false` / `INFO` |
| `JENKINS_PORT` `JENKINS_HEAP` `DOCKER_GID` | Jenkins compose | `8081` / `1g` / `stat -c %g /var/run/docker.sock` 결과 |

OAuth 콜백 URI 는 `${PUBLIC_URL}/oauth/callback/google` · `/naver` 로 조립된다. Google Cloud
콘솔과 네이버 개발자센터에 등록한 주소가 이와 문자 단위로 같아야 한다.

## 3. Jenkins 띄우기

```bash
cd INFRA
docker compose -f docker-compose.jenkins.yml up -d --build
docker compose -f docker-compose.jenkins.yml logs -f jenkins   # 초기 관리자 비밀번호
```

`http://<서버IP>:8081` 에서 초기 설정 → "Install suggested plugins". 필요한 플러그인(Git, Pipeline,
Credentials Binding)은 모두 그 안에 있다. 이후:

1. **Manage Jenkins → Security** — 가입 허용을 끈다.
2. **Manage Jenkins → Nodes → Built-In Node** — Number of executors 를 **1** 로 둔다.
   `Jenkinsfile` 의 `disableConcurrentBuilds()` 와 이중으로, 8GB 에서 빌드가 겹치지 않게 한다.
3. **크리덴셜** (Manage Jenkins → Credentials → Global):

   | ID | 종류 | 내용 |
   | --- | --- | --- |
   | `github-token` | Username with password | GitHub 사용자명 + Fine-grained PAT (`axcore-dev/WorkSpace` Contents: Read) |
   | `infra-env-file` | Secret file | 위 2절의 `.env` 파일 |

   ID 는 `Jenkinsfile` 의 `environment` 블록과 같아야 한다.
4. **Job** — New Item → Pipeline. "This project is parameterized" 는 켜지 않아도 된다(Jenkinsfile 이
   선언한다). Definition: *Pipeline script from SCM*, Git, 저장소 URL, 크리덴셜 `github-token`,
   Branch `*/dev`, Script Path `Jenkinsfile`.
5. 첫 실행은 **Build Now** 로 한 번 돌린다. 이때 Jenkinsfile 을 읽어 파라미터가 등록되고, 그 다음부터
   **Build with Parameters** 가 보인다. 첫 실행은 기본값(APP_ONLY)으로 돌아가는데 DB 가 없어 BE 헬스체크에서
   실패한다. 정상이다. 두 번째부터 `APP_WITH_DB` 로 돌린다.

GitHub 푸시로 자동 실행하려면 저장소 Webhook 에 `http://<서버IP>:8081/github-webhook/` 를 등록하고
Job 의 Build Triggers 에서 "GitHub hook trigger" 를 켠다. 이 경우 기본 파라미터(APP_ONLY · ALL · dev)로 돈다.

## 4. 파라미터

| 파라미터 | 값 | 설명 |
| --- | --- | --- |
| `BUILD_MODE` | `APP_ONLY` | BE/FE 만 빌드·재시작. DB 는 떠 있어야 한다 (기본) |
| | `APP_WITH_DB` | DB 를 올리고(있으면 유지) 앱을 빌드·재시작. 첫 배포는 이걸로 |
| | `DB_ONLY` | DB 만. 데이터 보존 |
| | `FULL_REBUILD` | **DB 볼륨 삭제** + 캐시 없이 전부 재빌드. `CONFIRM_DESTROY=DELETE` 를 같이 넣어야 돈다 |
| | `STOP_ALL` | 앱·nginx·DB 중지. Jenkins 는 그대로 |
| `TARGET` | `ALL` / `BE` / `FE` | 빌드·교체할 앱. FE 만 고르면 BE 컨테이너는 건드리지 않는다 |
| `BRANCH` | 기본 `dev` | 다른 브랜치를 올려 볼 때 |
| `RUN_CI` | 기본 true | BE 컴파일, FE 타입체크·테스트·lint. 실패하면 배포하지 않는다 |
| `FE_LINT_STRICT` | 기본 false | eslint 오류를 실패로 본다. 기존 오류(`verify-email/page.tsx` set-state-in-effect 2건)가 정리되면 true |
| `REBUILD_NGINX` | 기본 false | `INFRA/nginx/default.conf` 를 바꿨을 때 |
| `PRUNE_IMAGES` | 기본 true | dangling 이미지 삭제 + 빌드 캐시 4GB 초과분 삭제 |
| `VERBOSE_LOG` | 기본 true | 끄면 `docker compose build --quiet` |

### 스테이지 순서

파라미터 검증 → (STOP_ALL: 중지) → (FULL_REBUILD: 워크스페이스 비움) → 체크아웃 → `.env` 복사 →
네트워크 → CI 검사 BE → CI 검사 FE → DB 기동 → 앱 빌드(서비스별 순차) → 앱 배포 + 헬스체크 → 이미지 정리

BE 와 FE 는 **순차로** 빌드한다. Gradle 과 `next build` 를 동시에 돌리면 8GB 를 넘는다.

## 5. 동작 원리에서 헷갈리기 쉬운 것

- **Jenkins 컨테이너가 어떻게 호스트에 컨테이너를 띄우나** — `/var/run/docker.sock` 을 마운트해서
  Jenkins 안의 `docker` CLI 가 호스트 데몬에 명령한다. `docker compose build` 의 빌드 컨텍스트는 CLI 가
  자기 파일시스템(Jenkins 워크스페이스)에서 읽어 데몬에 보내므로 경로 문제가 없다.
- **왜 jenkins_home 을 호스트의 같은 경로(`/var/jenkins_home`)에 바인드하나** — CI 검사 단계가
  `docker run -v "$WORKSPACE/FE:/app"` 처럼 워크스페이스를 다른 컨테이너에 마운트한다. `-v` 의 소스 경로는
  **호스트 기준**으로 풀리므로, 컨테이너 안 경로와 호스트 경로가 같아야 맞는 곳을 가리킨다. 경로를 바꾸면
  CI 검사만 조용히 빈 디렉터리를 보게 된다.
- **왜 nginx 설정을 바인드 마운트하지 않고 이미지에 굽나** — 같은 이유다. 앱 compose 에는 바인드 마운트가
  하나도 없다.
- **FE 만 다시 배포하면 nginx 가 502 를 내지 않나** — `default.conf` 가 `upstream` 대신 변수 + `resolver
  127.0.0.11` 로 매 요청 DNS 를 다시 묻는다. 컨테이너 IP 가 바뀌어도 10초 안에 따라간다.
- **`NEXT_PUBLIC_*` 는 왜 build args 인가** — Next.js 는 이 값을 빌드 시점에 번들에 박는다. 런타임 환경변수로
  바꿀 수 없다. 그래서 `FE/.dockerignore` 가 `.env*` 를 막아 로컬 값이 이미지에 들어가는 것을 차단하고,
  compose 가 `INFRA/.env` 의 값을 build args 로 넘긴다.
- **BE 는 왜 `application.properties` 를 고치지 않았나** — nginx 뒤에서 필요한 `server.forward-headers-strategy=framework`
  는 Spring 의 relaxed binding 으로 환경변수 `SERVER_FORWARD_HEADERS_STRATEGY` 가 대신한다. 나머지
  (허용 오리진, 콜백 URI, 쿠키 Secure)는 이미 `${...}` 치환이라 compose 환경변수로 들어간다.
- **같은 오리진의 의미** — 브라우저는 `http://<PUBLIC_URL>/` 에서 FE 를 받고 `/api/...` 를 부른다. CORS 가
  개입하지 않고, refresh 쿠키(`SameSite=Lax`, path `/api/auth`)가 그대로 동작한다. `NEXT_PUBLIC_API_BASE_URL`
  에 다른 주소를 넣으면 이 전제가 깨진다.

## 6. 로컬에서 같은 구성 띄우기

```bash
cd INFRA
docker network create axcore-net              # 1회
docker compose -f docker-compose.db.yml up -d
docker compose -f docker-compose.yml up -d --build          # BE + FE + nginx → http://localhost
docker compose -f docker-compose.yml up -d --build app      # BE 만 (FE 는 next dev 로)
```

로컬 `INFRA/.env` 도 2절의 24개 키를 전부 가진다(compose 에 기본값이 없다). 로컬 값은 `PUBLIC_URL=http://localhost:8000`
(`next dev` 기준), `SPRING_PROFILES_ACTIVE=local`, `AUTH_COOKIE_SECURE=false`, `DOCKER_GID` 는 아무 값이면 된다.
nginx 까지 compose 로 띄워 `http://localhost` 로 볼 때는 `PUBLIC_URL=http://localhost` 로 바꾼다.

## 7. 문제 해결

| 증상 | 원인 · 조치 |
| --- | --- |
| `permission denied while trying to connect to the Docker daemon socket` | `INFRA/.env` 의 `DOCKER_GID` 가 호스트와 다르다. `stat -c %g /var/run/docker.sock` 값으로 맞추고 Jenkins 를 다시 올린다 |
| 체크아웃에서 `Permission denied` / `deleteDir` 실패 | CI 검사 컨테이너가 root 로 만든 파일이 남았다. 스테이지 끝의 `chown` 이 안 돌았을 때 생긴다. `sudo chown -R 1000:1000 /var/jenkins_home/workspace` |
| nginx 502 | 업스트림 컨테이너가 죽었거나 아직 healthy 전. `docker compose ps`, `docker logs axcore-be` |
| BE 가 `JWT_SECRET` 오류로 안 뜸 | 크리덴셜 `.env` 에 키가 빠졌다. 32바이트 이상이어야 한다 |
| 소셜 로그인 `redirect_uri_mismatch` | 제공자 콘솔의 콜백 URI 와 `${PUBLIC_URL}/oauth/callback/<provider>` 가 다르다 |
| 디스크 부족 | `docker system df` 확인. `PRUNE_IMAGES` 를 켠 채 배포하거나 `docker builder prune -af` |

## 8. 남은 일

- **HTTPS** — 도메인이 정해지면 nginx 에 certbot(또는 Naver Cloud Certificate Manager) 을 붙인다. 그때
  `PUBLIC_URL` 을 `https://` 로, `AUTH_COOKIE_SECURE` 를 `true` 로 바꾼다.
- **SonarQube** — 서버를 4 vCPU / 16GB 로 올린 뒤 `INFRA/docker-compose.sonarqube.yml` 을 추가하고,
  Jenkinsfile 의 CI 검사와 DB 기동 사이에 `withSonarQubeEnv` + `waitForQualityGate` 스테이지를 넣는다.
  BE 는 Gradle `org.sonarqube` + `jacoco` 플러그인, FE 는 `sonar-scanner-cli` 이미지.
- **BE 테스트 실행** — `contextLoads` 가 DataSource 와 Flyway 를 요구해 CI 에서는 컴파일만 한다.
  Testcontainers 로 PostgreSQL 을 띄우거나, 테스트 프로필에서 DB 자동설정을 빼는 쪽으로 정리한 뒤
  `compileJava compileTestJava` 를 `test` 로 바꾼다.
- **FE lint 기존 오류 2건** 정리 후 `FE_LINT_STRICT` 기본값을 true 로.
- **메일 실제 발송** — `MAIL_MODE=log` 는 확인 링크가 컨테이너 로그에 남는다. `MailSender` 구현이 붙으면
  `.env` 의 `MAIL_MODE` 를 바꾼다.
- **Jenkins 접근 제한** — 8081 을 ACG 에서 사무실 IP 로 좁히거나 nginx 뒤 서브도메인으로 옮긴다.
