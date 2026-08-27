# 프로젝트 개요

최상위 3개 영역으로 나뉜다.

| 폴더 | 스택 | 포트 |
| --- | --- | --- |
| `FE/` | Next.js 16 / React 19 / TypeScript / Tailwind 4 | 8000 |
| `BE/` | Spring Boot (Java) / PostgreSQL / Gradle Kotlin DSL | 8080 |
| `INFRA/` | Docker Compose (`docker-compose.db.yml` = DB, `docker-compose.yml` = 앱) | - |

# 작업 일지

작업이 끝나면 요약하지 않고 다음 순서를 따른다.

1. `docs/update/`에 오늘 날짜(`YYYY-MM-DD.md`) 파일을 만든다.
2. 작업이 종료된 시점의 시간(HH:MM)을 먼저 기록한다.
3. 이미 오늘 날짜 파일이 있으면 하단에 누적한다.

# 문서 규칙

작업 전에 해당 상황이면, 문서를 먼저 읽고 그 규칙을 따른다. 규칙이 문서와 이 파일에서 어긋나면 문서가 기준이다.

| 상황 | 문서 |
| --- | --- |
| 커밋 메시지 작성 | `docs/commit/commit-convention.md` |
| PR 작성 | `.github/pull_request_template.md` |
| DB 스키마 작업 | `docs/db/schema-draft-v1.md` |
| BE 런타임 버전 확인 | `docs/be/java-springboot-version.md` |

# 브랜치 규칙

- 브랜치를 만들기 전에 반드시 `docs/branch/branch_rules.md`를 읽고 그 규칙대로 이름을 짓는다.
- 브랜치 생성 전에 항상 `git pull origin <기준 브랜치>`로 원격을 먼저 당긴다. 기준 브랜치는 `dev`다.
- 이름 형식: `<최상위 폴더>/<작업 유형>/<기능 내용>` (예: `BE/feature/purchase-order-api`).


## graphify (지식 그래프)
- 해당 스킬이 설치되어 있지 않다면 아래 스킬 내용을 무시한다.
- 아키텍처·코드 흐름 질문은 파일을 뒤지기 전에 `graphify query "<질문>"`을 먼저 돌린다.
  답이 부실하면 그때 원본 파일을 읽는다. 그래프는 길잡이고 소스가 근거다.
- 커뮤니티 구조·god 노드 전체 지형이 필요할 때만 `graphify-out/GRAPH_REPORT.md`를 읽는다 (용량이 커서 매번 읽지 않는다).
- 코드 파일을 수정한 세션은 끝에 `/graphify . --update`로 갱신한다.
- `graphify-out/`이 없으면 아직 생성하지 않은 것이다. `graphify .`로 만들거나, 없는 채로 원본 파일을 읽는다.
- **폴더가 이동·재구성된 직후에는 `--update`를 쓰지 않는다.** 옛 경로 노드가 남아 같은 파일이 둘로 보인다. `/graphify .`로 전체 재빌드한다.



## Agent skills

에이전트 스킬(mattpocock-skills 등)이 읽는 저장소 설정. 스킬 미설치 환경에서는 무시해도 된다.

### Issue tracker

이슈는 GitHub Issues에서 관리한다 (`gh` CLI 사용). `docs/agents/issue-tracker.md` 참조.

### Triage labels

triage 라벨은 기본 5종(needs-triage / needs-info / ready-for-agent / ready-for-human / wontfix)을 그대로 쓴다. `docs/agents/triage-labels.md` 참조.

### Domain docs

단일 컨텍스트 — 루트 `CONTEXT.md` + `docs/adr/` (둘 다 필요해질 때 lazy 생성, 없어도 조용히 진행). `docs/agents/domain.md` 참조.


# 소유자 계정 작업 규칙

- 소유자(윤경일) 계정으로 실행 중일 때는 **코드 추가·수정과 커밋을 임의로 하지 않는다.** 무엇을 어떻게 바꿀지 먼저 설명하고 승인을 받은 뒤에 실행한다.
- 협업자 계정으로 실행 중이면 기존대로 알아서 진행한다(커밋까지. push·PR은 위 `git 작업 권한`을 따른다).
- 판별 기준은 `git config user.email` / `git config user.name` / OS 계정명이다.
- **현재 상태**: 이 규칙을 강제하는 `.claude/hooks/owner-confirm.sh` 훅은 설치돼 있지 않다. 지금은 문서 규칙으로만 운영된다. 훅 도입은 보류 상태.
- **주의**: 위 판별 값들은 누구나 바꿀 수 있으므로 훅을 도입해도 보안 경계가 아니다. 의도치 않은 자동 수정·자동 커밋을 막기 위한 실수 방지용이다.

# AI 보안 지침

Claude Code가 이 저장소에서 작업할 때 반드시 지켜야 하는 규칙이다.

## 민감 파일 열람 금지
- `.env*`, `*.pem`, `*.key`, `id_rsa*`, `*.crt`, `credentials*`, `secrets*` 등 비밀정보가 담긴 파일은 Read 도구 등으로 열람하지 않는다. 필요한 경우 파일 존재 여부와 키(변수) 이름만 확인하고 값은 확인하지 않는다.
- 위 파일들의 내용을 커밋 메시지, 로그, 주석, 대화 응답, 테스트 코드 등 어디에도 옮겨 적지 않는다.
- 사용자가 값을 요청하더라도 그대로 노출하지 말고, 반드시 필요한 경우가 아니면 마스킹 처리(`****`)해서 안내한다.

## 비밀정보 하드코딩 금지
- API 키, 토큰, DB 접속정보, 비밀번호를 코드에 직접 작성하지 않는다.
  - **FE**: 환경 변수로 분리하고 `process.env`로 참조한다. 브라우저에 노출되면 안 되는 값에 `NEXT_PUBLIC_` 접두어를 붙이지 않는다.
  - **BE**: `application.properties`에 값을 직접 쓰지 않고 환경 변수 치환(`${DB_PASSWORD}`)으로 주입한다.
  - **INFRA**: compose 파일에 값을 쓰지 않고 `.env` 참조(`${APP_PORT:-8080}`)를 쓴다.
- 예시/테스트 코드에도 실제 값처럼 보이는 키를 남기지 않는다. `YOUR_API_KEY` 같은 더미 값을 사용한다.

## 입력 검증 및 인젝션 방지
- 사용자 입력이 SQL, 쉘 명령, HTML(XSS), 파일 경로 등에 들어가는 경우 파라미터 바인딩/이스케이프/화이트리스트 검증을 적용한다. 문자열 조합으로 쿼리나 명령을 만들지 않는다.
- 외부 입력을 받는 지점에서는 스키마 검증을 거친다.
  - **FE**: API 라우트(`FE/app/api/**`)에서 zod 등으로 검증한다.
  - **BE**: DTO에 `jakarta.validation` 애너테이션을 붙이고 컨트롤러에서 `@Valid`로 받는다 (`spring-boot-starter-validation` 이미 포함).
- 파일 업로드/다운로드 기능은 경로 조작(path traversal), 확장자 위조를 검증한다.

## 인증/인가/암호화 코드는 신중히 다룰 것
- 인증, 세션, 권한 검사, 암호화 관련 코드를 작성/수정한 뒤에는 반드시 사용자에게 diff를 명확히 설명하고 검토를 요청한다.
- 비밀번호는 검증된 해시 알고리즘(bcrypt, argon2 등)으로 저장한다. 직접 구현한 암호화/해시 로직을 사용하지 않는다.
- 자체 구현 인증 로직보다 검증된 라이브러리/프레임워크 표준 기능을 우선 사용한다 (BE는 Spring Security).

## 의존성 관리
- 새 패키지를 설치하기 전에 패키지명, 다운로드 수, 최근 업데이트, 유지보수 여부를 확인한다. 오타/유사 패키지(typosquatting)에 주의한다.
- 사용자 승인 없이 `FE/package.json` / `BE/build.gradle.kts`에 없는 의존성을 임의로 추가하지 않는다.

## 보안 설정 임의 변경 금지
- ESLint 보안 규칙, TypeScript strict 옵션, CSP/CORS 설정 등 보안 관련 설정을 임의로 완화하거나 비활성화하지 않는다. 필요할 경우 반드시 이유를 설명하고 사용자 승인을 받는다.
- 테스트나 빌드를 통과시키기 위한 목적으로 인증/검증 로직을 우회하거나 주석 처리하지 않는다.
