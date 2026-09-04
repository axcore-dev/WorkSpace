# CI/CD — Jenkins + docker compose

한 대의 서버(Naver Cloud, Ubuntu 24.04 / 2 vCPU / 8GB / 50GB)에서 Jenkins 가 코드를 받아 검사하고,
같은 서버의 Docker 에 `docker compose` 로 올린다. 외부에서 들어오는 문은 nginx 하나다(80 은 HTTPS 로
리다이렉트만, 443 이 실제 서비스). 인증서는 certbot 컨테이너가 Let's Encrypt 에서 받아 nginx 와 볼륨으로 공유한다.

```
[GitHub dev] ──(Jenkins 파라미터 빌드)──▶ Jenkins 컨테이너 ──docker.sock──▶ 호스트 Docker
                                                                           │
                  :80  ──▶ nginx ── /.well-known/acme-challenge/ ← axcore-certbot (Let's Encrypt 발급·갱신)
                                 └─ 그 외 → 301 https://www.axcore.it.kr
                  :443 ──▶ nginx ──┬── /api/ ──▶ axcore-be  (Spring, 8080)
                                   ├── /ai/  ──▶ axcore-fe  Route Handler (SSE, 버퍼링 off)
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

방화벽(Naver Cloud ACG)은 **80 · 443 을 `0.0.0.0/0`**(실제 사용자 + Let's Encrypt 검증 서버가 들어와야 한다),
8081(Jenkins)은 사무실 IP 와 GitHub 웹훅 대역(`api.github.com/meta` 의 `hooks`)만 연다.
5432 · 8080 · 8000 은 열지 않는다 — compose 가 127.0.0.1 에만 묶어 두었다.

## 2. INFRA/.env (서버용)

값은 리포에 넣지 않는다. 서버에서 파일을 만들고, 같은 내용을 Jenkins 크리덴셜(Secret file)로도 등록한다.
파이프라인은 크리덴셜 쪽을 매번 `INFRA/.env` 로 복사해 쓰고 끝나면 지운다.

**compose 파일에는 기본값이 없다.** 아래 32개 키가 전부 `.env` 에 있어야 한다. 빠진 키는 빈 값으로
들어가고(`POSTGRES_PASSWORD` · `JWT_SECRET` 만 compose 가 막는다), 포트 키가 비면 `up` 자체가 실패한다.
compose 가 읽는 키와 `.env` 의 키는 1:1 이다 — `.env` 에 다른 키를 두지 않는다.

| 키 | 용도 | 서버 값 |
| --- | --- | --- |
| `POSTGRES_DB` `POSTGRES_USER` `POSTGRES_PASSWORD` `POSTGRES_PORT` | DB | `workspace` / `workspace` / 32자 랜덤 / `5432`. compose 가 이 값으로 BE 의 `DB_URL` `DB_USERNAME` `DB_PASSWORD` 를 조립한다 |
| `APP_PORT` `FE_PORT` `HTTP_PORT` `HTTPS_PORT` | 호스트 포트 | `8080` / `8000` / `80` / `443`. 앞 둘은 127.0.0.1 에만 묶인다 |
| `PUBLIC_HOST` | nginx 대표 호스트 = 인증서 이름 | `www.axcore.it.kr`. 다른 이름(apex, IP)으로 오면 여기로 301. 로컬은 `localhost` |
| `TLS_DOMAINS` `CERTBOT_EMAIL` | Let's Encrypt 발급 대상(쉼표 구분) · 만료 안내 주소 | `www.axcore.it.kr,axcore.it.kr` / 운영자 메일. **`TLS_DOMAINS` 를 비우면 certbot 이 발급하지 않고 nginx 는 자체서명으로 뜬다**(로컬). 아래 「HTTPS」 |
| `SPRING_PROFILES_ACTIVE` | BE 프로필 | `prod` (로컬은 `local`) |
| `BE_HEAP` | BE 힙 상한 | `512m` |
| `JWT_SECRET` | BE 토큰 서명 | 32바이트 이상. 없으면 compose 가 막는다 |
| `PUBLIC_URL` | 사용자가 브라우저에 치는 주소 | `https://www.axcore.it.kr` (= `https://` + `PUBLIC_HOST`). CORS 허용 오리진, 메일 링크, OAuth 콜백이 전부 이 값에서 나온다 |
| `AUTH_COOKIE_SECURE` | refresh 쿠키 Secure | HTTPS 이므로 `true`. 로컬(`http://localhost:8000`)은 `false` |
| `GOOGLE_CLIENT_ID` `GOOGLE_CLIENT_SECRET` | 소셜 로그인 | 비우면 그 제공자만 비활성. FE 번들에도 같은 client-id 가 들어간다 |
| `NAVER_CLIENT_ID` `NAVER_CLIENT_SECRET` | 소셜 로그인 | 위와 같다 |
| `NEXT_PUBLIC_API_BASE_URL` | FE → API 주소 | nginx 뒤라 **비운다**(빈 문자열). 그러면 같은 오리진 `/api/...` 를 부른다 |
| `MAIL_MODE` `MAIL_FROM` | 메일 발송 방식 · 보내는 주소 | `smtp` / 발송 계정 주소. `log` 면 보내지 않고 BE 로그에 찍는다(확인 링크가 로그에 남는다, 개발 전용) |
| `MAIL_HOST` `MAIL_PORT` `MAIL_USERNAME` `MAIL_PASSWORD` | SMTP 접속 (mode=smtp 일 때만 쓰임) | Google Workspace: `smtp.gmail.com` / `587` / 발송 계정 / **앱 비밀번호 16자**. 아래 「Google Workspace SMTP」 참고. log 모드에서는 비워 둔다 |
| `LOG_REQUESTS` `LOG_APP_LEVEL` | BE 로그 | `false` / `INFO` |
| `JENKINS_PORT` `JENKINS_HEAP` `DOCKER_GID` | Jenkins compose | `8081` / `1g` / `stat -c %g /var/run/docker.sock` 결과 |

### Google Workspace SMTP
`MAIL_MODE=smtp` 로 바꾸면 BE 의 `SmtpMailSender` 가 `spring.mail.*` 로 실제 발송한다. 호스트·계정·비밀번호가
비어 있으면 **BE 가 부팅에서 막힌다**(설정 실수를 조용히 넘기지 않기 위해). 접속 시험은 부팅 때 한 번 하고
실패해도 ERROR 로그만 남긴다 — 메일 서버 장애가 API 를 내리면 안 된다. Actuator 의 메일 헬스 지표는 꺼 두었다.

1. 발송용 계정(예: `no-reply@axcore.ai.kr`)에 **2단계 인증**을 켠다. 앱 비밀번호는 2단계 인증이 켜진 계정에서만 만들 수 있다.
2. Google 계정 → 보안 → 2단계 인증 → **앱 비밀번호** → 이름 아무거나 → 16자 값을 `MAIL_PASSWORD` 에 넣는다(공백 제거).
   Workspace 관리자가 「보안 수준이 낮은 앱」이 아니라 앱 비밀번호를 허용해 두어야 한다(기본 허용).
3. `MAIL_USERNAME` 은 그 계정 주소. `MAIL_FROM` 은 **같은 주소**로 둔다. Gmail 은 인증 계정(또는 Gmail 설정의
   「다른 주소에서 메일 보내기」에 등록된 별칭)이 아닌 From 을 인증 계정 주소로 바꿔 버린다.
4. 서버 아웃바운드 587 이 열려 있어야 한다(Naver Cloud ACG 아웃바운드 규칙). 25 번은 쓰지 않는다.
5. 크리덴셜 `infra-env-file` 을 갱신하고 `TARGET=BE` 로 배포. 부팅 로그에 `SMTP 접속 확인: smtp.gmail.com:587`
   이 찍히면 된다. `http://<PUBLIC_URL>/signup` 에서 가입해 확인 메일이 오는지 본다.

Workspace 발송 한도는 계정당 하루 2,000통이다. 가입·비밀번호 재설정 메일 수준에서는 충분하다.

### HTTPS (nginx + certbot, Let's Encrypt)
도메인은 가비아 DNS 에 A 레코드 `@` · `www` → 서버 IP 로 잡혀 있다(`axcore.it.kr`). 대표 주소는 `https://www.axcore.it.kr`
이고 apex · IP · http 로 들어오면 전부 여기로 301 한다.

**구조** — `INFRA/nginx/`, `INFRA/certbot/`
- nginx 는 80 에서 `/.well-known/acme-challenge/`(certbot 웹루트)와 `/nginx-health` 만 직접 처리하고 나머지는 443 으로 보낸다.
  443 은 `PUBLIC_HOST` 이름의 server 블록이 `/api/` → BE, `/ai/` → FE Route Handler(SSE, `proxy_buffering off` ·
  `proxy_read_timeout 300s`, PR #30), `/` → FE 를 프록시한다. 설정은 `default.conf.template` 이고 nginx 이미지의 envsubst 가
  `${PUBLIC_HOST}` 만 채운다. compose 스택에서 `curl -N -X POST https://.../ai/chat` 로 첫 바이트 43ms · 총 5.5s, 조각이
  0.4~0.5s 간격으로 도착하는 것을 확인했다(버퍼링이 켜져 있으면 총 시간 뒤에 한 번에 온다).
- 인증서 경로는 `/etc/nginx/ssl-current/` 고정 심볼릭 링크다. `15-tls-bootstrap.sh` 가 기동 시 Let's Encrypt 인증서
  (`/etc/letsencrypt/live/<PUBLIC_HOST>/`)가 있으면 그쪽, 없으면 **임시 자체서명**을 가리키게 해 nginx 가 항상 뜬다.
  이후 60초마다 인증서 파일 변경(첫 발급·갱신)을 보고 링크를 바꿔 `nginx -s reload` 한다.
- certbot 컨테이너는 "없으면 webroot 로 발급, 있으면 12시간마다 renew" 루프다. 발급 실패는 15분 뒤 재시도한다
  (Let's Encrypt 실패 한도 시간당 5회). nginx 를 건드리지 않는다 — nginx 가 스스로 reload 하기 때문이다.
- 두 컨테이너는 named volume `letsencrypt`(인증서·계정) · `certbot-www`(챌린지 토큰)를 공유한다. 바인드 마운트가 아니라
  Jenkins 컨테이너 안에서 compose 를 돌려도 경로 문제가 없다. **앱 compose 를 `down -v` 로 내리면 인증서가 지워진다.**
  재발급은 되지만 주간 한도(도메인당 50개)가 있으니 습관적으로 `-v` 를 붙이지 않는다.

**첫 적용 순서**
1. ACG: 80 · 443 을 `0.0.0.0/0` 으로. Let's Encrypt 검증 서버가 80 으로 들어와야 발급된다.
2. 서버 `.env`: `HTTPS_PORT=443` `PUBLIC_HOST=www.axcore.it.kr` `TLS_DOMAINS=www.axcore.it.kr,axcore.it.kr`
   `CERTBOT_EMAIL=<운영자 메일>` `PUBLIC_URL=https://www.axcore.it.kr` `AUTH_COOKIE_SECURE=true`. 크리덴셜 `infra-env-file` 교체.
3. Google Cloud 콘솔 · 네이버 개발자센터의 콜백 URI 를 `https://www.axcore.it.kr/oauth/callback/google` · `/naver` 로 바꾼다
   (IP 항목은 삭제). 허용 자바스크립트 원본도 `https://www.axcore.it.kr`.
4. `TARGET=ALL` 로 배포. `PUBLIC_URL` 이 바뀌어 BE(허용 오리진·콜백) 와 FE(번들) 둘 다 다시 빌드해야 한다. nginx·certbot 은
   `INFRA/` 변경으로 AUTO 가 잡거나 `REBUILD_NGINX=true`.
5. 확인: `docker logs axcore-certbot` 에 `발급 완료`, 1분 안에 `docker logs axcore-nginx` 에 `인증서 변경 감지 → nginx reload`.
   브라우저에서 `https://www.axcore.it.kr` 자물쇠, `http://axcore.it.kr` → `https://www.axcore.it.kr` 리다이렉트.

**운영**
- 갱신은 자동이다. 만료 30일 전부터 certbot 이 갱신하고 nginx 가 따라간다. 만료 안내 메일이 `CERTBOT_EMAIL` 로 오면 갱신이
  실패하고 있다는 뜻이니 `docker logs axcore-certbot` 을 본다.
- 발급이 계속 실패하면 순서대로: DNS 가 서버 IP 인지(`nslookup www.axcore.it.kr`), ACG 80 이 전체 개방인지,
  `curl http://www.axcore.it.kr/.well-known/acme-challenge/test` 가 nginx 404 를 돌려주는지(연결 자체가 되는지).
- 로컬: `.env` 에 `PUBLIC_HOST=localhost`, `TLS_DOMAINS=` 빈 값. nginx 는 자체서명으로 뜨고(`https://localhost` 는 브라우저
  경고, `curl -k` 로 확인), certbot 은 대기만 한다. 평소 로컬 개발은 `next dev` + BE 8080 직접 접근이라 nginx 를 거치지 않는다.
- HSTS 는 처음 1주(`max-age=604800`)로 두었다. HTTPS 가 안정되면 `default.conf.template` 에서 1년으로 올린다.

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
Job 의 Build Triggers 에서 "GitHub hook trigger" 를 켠다. 이 경우 기본 파라미터(APP_ONLY · AUTO · dev)로 돈다 — 바뀐 쪽만 배포된다.

## 4. 파라미터

| 파라미터 | 값 | 설명 |
| --- | --- | --- |
| `BUILD_MODE` | `APP_ONLY` | BE/FE 만 빌드·재시작. DB 는 떠 있어야 한다 (기본) |
| | `APP_WITH_DB` | DB 를 올리고(있으면 유지) 앱을 빌드·재시작. 첫 배포는 이걸로 |
| | `DB_ONLY` | DB 만. 데이터 보존 |
| | `FULL_REBUILD` | **DB 볼륨 삭제** + 캐시 없이 전부 재빌드. `CONFIRM_DESTROY=DELETE` 를 같이 넣어야 돈다 |
| | `STOP_ALL` | 앱·nginx·DB 중지. Jenkins 는 그대로 |
| `TARGET` | `AUTO` (기본) | 마지막 배포 커밋 이후 **바뀐 경로**로 BE/FE 를 정한다. 아래 「AUTO 판정」 |
| | `ALL` / `BE` / `FE` | 판정 없이 강제. `.env` 만 바꿨을 때는 코드 diff 에 안 나오므로 `ALL` 을 고른다 |
| `BRANCH` | 기본 `dev` | 다른 브랜치를 올려 볼 때 |
| `RUN_CI` | 기본 true | BE 컴파일, FE 타입체크·테스트·lint. 실패하면 배포하지 않는다 |
| `FE_LINT_STRICT` | 기본 false | eslint 오류를 실패로 본다. 기존 오류(`verify-email/page.tsx` set-state-in-effect 2건)가 정리되면 true |
| `REBUILD_NGINX` | 기본 false | `INFRA/nginx/` · `INFRA/certbot/` 을 바꿨을 때 nginx·certbot 을 다시 빌드. AUTO 는 경로 변경으로 자동 감지한다 |
| `PRUNE_IMAGES` | 기본 true | dangling 이미지 삭제 + 빌드 캐시 4GB 초과분 삭제 |
| `VERBOSE_LOG` | 기본 true | 끄면 `docker compose build --quiet` |

### AUTO 판정 (TARGET=AUTO)

브랜치 이름(`FE/...`, `BE/...`)이 아니라 **바뀐 파일 경로**로 정한다. squash 머지·직접 push 에서는 브랜치 이름이
커밋에 남지 않고, BE 브랜치가 FE 파일을 고치는 일도 있어서다. 기준점은 마지막으로 배포에 성공한 커밋이고
`/var/jenkins_home/axcore-last-deploy` 에 SHA 로 남는다.

| 기준 커밋 이후 바뀐 경로 | 결과 |
| --- | --- |
| `BE/` 만 | BE 만 CI 검사·빌드·교체 |
| `FE/` 만 | FE 만 |
| `BE/` 와 `FE/` | ALL |
| `INFRA/` 또는 `Jenkinsfile` 포함 | ALL (compose·Dockerfile 이 두 앱에 걸친다). `INFRA/nginx/` 가 끼면 nginx 도 재빌드 |
| 위 경로가 하나도 없음 (`docs/` 등) | 배포 생략, 커밋만 기록 |
| 기준 커밋과 HEAD 가 같음 | 배포 생략 (강제하려면 `ALL`/`BE`/`FE`) |
| 기록이 없음 · 기준 커밋이 얕은 이력(50개)에 없음 | ALL |

- 기록은 **헬스체크까지 통과한 뒤**에만 갱신한다. 실패한 배포를 기준으로 삼으면 그 변경이 다음 판정에서 빠진다.
- `TARGET=BE`/`FE` 로 부분 배포한 경우는 기록을 갱신하지 않는다. 그 커밋을 "다 배포됐다" 고 적으면 반대쪽 변경이
  빠지기 때문이다. 다음 AUTO 실행이 이전 기준으로 판정해 나머지를 덮는다(중복 빌드가 한 번 생길 수 있다).
- **`.env` 만 바꿨을 때**(소셜 client-id, `MAIL_*` 등)는 코드 diff 에 나오지 않는다. 크리덴셜을 교체한 뒤
  `TARGET=ALL`(또는 영향받는 쪽)을 직접 고른다. `NEXT_PUBLIC_*` 는 FE 번들에 굽히므로 FE 도 다시 빌드해야 한다.
- 기준을 초기화하려면 서버에서 `rm /var/jenkins_home/axcore-last-deploy`. 다음 실행이 ALL 로 돈다.

### 스테이지 순서

파라미터 검증 → (STOP_ALL: 중지) → (FULL_REBUILD: 워크스페이스 비움) → 체크아웃 → **배포 대상 판정(AUTO)** →
`.env` 복사 → 네트워크 → CI 검사 BE → CI 검사 FE → DB 기동 → 앱 빌드(서비스별 순차) → 앱 배포 + 헬스체크 →
배포 커밋 기록 → 이미지 정리

BE 와 FE 는 **순차로** 빌드한다. Gradle 과 `next build` 를 동시에 돌리면 8GB 를 넘는다.
CI 검사도 판정을 따른다 — FE 만 바뀌면 BE 컴파일을 건너뛴다.

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
- **FE 만 다시 배포하면 nginx 가 502 를 내지 않나** — `default.conf.template` 이 `upstream` 대신 변수 + `resolver
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

로컬 `INFRA/.env` 도 2절의 32개 키를 전부 가진다(compose 에 기본값이 없다). 로컬 값은 `PUBLIC_URL=http://localhost:8000`
(`next dev` 기준), `SPRING_PROFILES_ACTIVE=local`, `AUTH_COOKIE_SECURE=false`, `DOCKER_GID` 는 아무 값이면 된다.
nginx 까지 compose 로 띄워 `http://localhost` 로 볼 때는 `PUBLIC_URL=http://localhost` 로 바꾼다.

## 7. 문제 해결

| 증상 | 원인 · 조치 |
| --- | --- |
| `permission denied while trying to connect to the Docker daemon socket` | `INFRA/.env` 의 `DOCKER_GID` 가 호스트와 다르다. `stat -c %g /var/run/docker.sock` 값으로 맞추고 Jenkins 를 다시 올린다 |
| 체크아웃에서 `Permission denied` / `deleteDir` 실패 | CI 검사 컨테이너가 root 로 만든 파일이 남았다. 스테이지 끝의 `chown` 이 안 돌았을 때 생긴다. `sudo chown -R 1000:1000 /var/jenkins_home/workspace` |
| nginx 502 | 업스트림 컨테이너가 죽었거나 아직 healthy 전. `docker compose ps`, `docker logs axcore-be` |
| nginx 가 `cannot load certificate /etc/nginx/ssl-current/fullchain.pem` 으로 재시작 반복 | `15-tls-bootstrap.sh` 가 실행되지 않았다. 대부분 Windows 에서 CRLF 로 체크아웃된 셸 스크립트다(`#!/bin/sh\r`). 루트 `.gitattributes` 가 `*.sh` `Dockerfile` `*.template` `*.conf` `*.yml` `Jenkinsfile` 을 LF 로 고정하므로 `git add --renormalize .` 후 다시 빌드. 확인: `git ls-files --eol INFRA/nginx/15-tls-bootstrap.sh` 가 `w/lf` |
| `/ai/chat` 스트림이 끝날 때 한 번에 도착 | nginx `/ai/` location 의 `proxy_buffering off` 가 빠졌거나 앞에 다른 프록시가 끼었다. `curl -N` 으로 첫 바이트 시각과 총 시각을 비교한다 |
| BE 가 `JWT_SECRET` 오류로 안 뜸 | 크리덴셜 `.env` 에 키가 빠졌다. 32바이트 이상이어야 한다 |
| 소셜 로그인 `redirect_uri_mismatch` | 제공자 콘솔의 콜백 URI 와 `${PUBLIC_URL}/oauth/callback/<provider>` 가 다르다 |
| 디스크 부족 | `docker system df` 확인. `PRUNE_IMAGES` 를 켠 채 배포하거나 `docker builder prune -af` |

## 8. 남은 일

- **HTTPS — 붙였다** (2절 「HTTPS」). 남은 운영 작업: 서버 `.env` 에 `PUBLIC_HOST` `TLS_DOMAINS` `CERTBOT_EMAIL` `HTTPS_PORT`
  채우고 `PUBLIC_URL=https://...` · `AUTH_COOKIE_SECURE=true` 로, ACG 80·443 전체 개방, Google·네이버 콘솔 콜백 URI 를
  `https://` 로 교체, `TARGET=ALL` 배포. 안정되면 nginx HSTS `max-age` 를 1년으로 올린다.
- **SonarQube** — 서버를 4 vCPU / 16GB 로 올린 뒤 `INFRA/docker-compose.sonarqube.yml` 을 추가하고,
  Jenkinsfile 의 CI 검사와 DB 기동 사이에 `withSonarQubeEnv` + `waitForQualityGate` 스테이지를 넣는다.
  BE 는 Gradle `org.sonarqube` + `jacoco` 플러그인, FE 는 `sonar-scanner-cli` 이미지.
- **BE 테스트 실행** — `contextLoads` 가 DataSource 와 Flyway 를 요구해 CI 에서는 컴파일만 한다.
  Testcontainers 로 PostgreSQL 을 띄우거나, 테스트 프로필에서 DB 자동설정을 빼는 쪽으로 정리한 뒤
  `compileJava compileTestJava` 를 `test` 로 바꾼다.
- **FE lint 기존 오류 2건** 정리 후 `FE_LINT_STRICT` 기본값을 true 로.
- **메일 실제 발송 — 코드는 붙었다.** `SmtpMailSender`(`MAIL_MODE=smtp`). 남은 것은 발송 계정에 앱 비밀번호를 만들어
  크리덴셜 `.env` 에 `MAIL_HOST/PORT/USERNAME/PASSWORD` 를 채우고 `MAIL_MODE` 를 `smtp` 로 바꾸는 운영 작업이다 (2절 「Google Workspace SMTP」).
- **Jenkins 접근 제한** — 8081 을 ACG 에서 사무실 IP 로 좁히거나 nginx 뒤 서브도메인으로 옮긴다.
