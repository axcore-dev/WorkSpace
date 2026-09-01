# 워크스페이스 관리 API — Postman 테스트 가이드

`/api/admin/workspaces/*` 엔드포인트 10개를 Postman으로 검증하는 절차다. 요청마다 **BE 내부에서
어떤 클래스의 어떤 메서드를 지나는지**를 함께 적었다. 응답이 이상할 때 어디를 봐야 하는지가
바로 나오게 하려는 것이다.

워크스페이스는 **고객이 직접 만들지 않는다.** 계약이 끝난 회사를 운영자가 대신 열고 접속 링크를
보낸다. 그래서 이 API는 전부 운영자 전용이다.

설계 배경은 [tenant-provisioning.md](tenant-provisioning.md), 스키마 규칙은
[../db/schema-draft-v2.md](../db/schema-draft-v2.md)에 있다.

대상 코드: `BE/src/main/java/com/axcore/workspace/workspace/admin/**`,
`BE/src/main/java/com/axcore/workspace/workspace/provisioning/**`

---

## 0. 시작 전 확인

### 0-1. 서버가 떠 있는가

```
GET http://localhost:8080/actuator/health
→ 200 {"status":"UP"}
```

이게 200이 아니면 아래는 전부 의미가 없다.

### 0-2. 마이그레이션이 V10까지 올라갔는가

부팅 로그에 이게 보여야 한다.

```
Successfully applied N migrations to schema "shared", now at version v10
```

```sql
SELECT version, description FROM shared.flyway_schema_history ORDER BY installed_rank DESC LIMIT 4;
-- 10 | tenant schema functions
--  9 | workspace schema comment
--  8 | workspace details
--  7 | internal admin
```

### 0-3. 프로비저닝 전용 풀이 떴는가

```
axcore-provisioning - Start completed.
```

이 줄이 없으면 `ProvisioningDataSourceConfig`가 로드되지 않은 것이고, 개설이 500으로 떨어진다.

### 0-4. 운영자 계정 만들기 ← **이걸 안 하면 전부 403이다**

`is_internal_admin`을 켜는 API는 **없다.** 값을 바꾸는 경로를 애플리케이션에 두지 않았기
때문에 DB에서 직접 켠다.

```bash
# 1) 평범하게 가입
curl -X POST http://localhost:8080/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"ops.test@axcore.ai.kr","password":"OpsTest1234!","name":"Ops Tester"}'

# 2) 운영자로 승격
docker exec axcore-postgres psql -U workspace -d workspace \
  -c "UPDATE shared.users SET is_internal_admin = true WHERE email='ops.test@axcore.ai.kr';"
```

> **이메일 확인은 필요 없다.** 운영자 API는 `is_internal_admin`만 본다. 회사 진입
> (`/api/auth/workspaces/{id}/select`)과는 판정 기준이 다르다.

---

## 1. Postman 환경(Environment) 만들기

**Environments → Create Environment**, 이름 `axpoint-admin`.

| Variable | Initial value | 용도 |
|---|---|---|
| `baseUrl` | `http://localhost:8080` | 모든 요청의 앞부분 |
| `accessToken` | (비움) | login 응답에서 스크립트가 자동으로 채운다 |
| `opsEmail` | `ops.test@axcore.ai.kr` | 운영자 계정 |
| `opsPassword` | `OpsTest1234!` | 위 계정 비밀번호 |
| `workspaceId` | (비움) | create 응답에서 스크립트가 자동으로 채운다 |
| `bizNumber` | `1234567891` | **하이픈 없이 10자리.** 매 테스트마다 바꿔야 한다 |

`accessToken`과 `workspaceId`는 **Current value**만 쓰이도록 둔다. Initial value에 넣으면
환경을 export할 때 파일에 실려 나간다.

우측 상단 환경 드롭다운에서 `axpoint-admin`을 선택해야 `{{baseUrl}}`이 치환된다.

---

## 2. 컬렉션 구조

**Collections → Create Collection**, 이름 `AXpoint Workspace Admin`.

| # | 이름 | Method | URL |
|---|---|---|---|
| 0 | login | POST | `{{baseUrl}}/api/auth/login` |
| 1 | list | GET | `{{baseUrl}}/api/admin/workspaces` |
| 2 | create | POST | `{{baseUrl}}/api/admin/workspaces` |
| 3 | get | GET | `{{baseUrl}}/api/admin/workspaces/{{workspaceId}}` |
| 4 | update | PUT | `{{baseUrl}}/api/admin/workspaces/{{workspaceId}}` |
| 5 | retry provisioning | POST | `{{baseUrl}}/api/admin/workspaces/{{workspaceId}}/provision` |
| 6 | suspend | POST | `{{baseUrl}}/api/admin/workspaces/{{workspaceId}}/suspend` |
| 7 | resume | POST | `{{baseUrl}}/api/admin/workspaces/{{workspaceId}}/resume` |
| 8 | link-sent | POST | `{{baseUrl}}/api/admin/workspaces/{{workspaceId}}/link-sent` |
| 9 | terminate | DELETE | `{{baseUrl}}/api/admin/workspaces/{{workspaceId}}` |
| 10 | migrate all | POST | `{{baseUrl}}/api/admin/workspaces/migrate` |

### 컬렉션 레벨 Auth 설정 (권장)

컬렉션 **Authorization** 탭 → Type `Bearer Token` → Token에 `{{accessToken}}`.
`login`만 `No Auth`로 바꾸고 나머지 10개는 `Inherit from parent`로 둔다.

### login 요청의 Scripts → Post-response

```javascript
const json = pm.response.json();
pm.environment.set("accessToken", json.accessToken);
pm.test("access token 확보", () => pm.expect(json.accessToken).to.be.a("string"));
```

Body:

```json
{
  "email": "{{opsEmail}}",
  "password": "{{opsPassword}}",
  "rememberMe": false
}
```

---

## 3. 공통 — 모든 요청이 지나는 길

```
요청
  → SecurityConfig            /api/admin/** → .authenticated()   ← 여기까지는 "로그인했는가"만 본다
  → JwtPrincipal.of(jwt)      sub → userId
  → AdminWorkspaceService#requireInternalAdmin(userId)
        UserRepository#findById → User#isInternalAdmin()
        false 면 InternalAdminRequiredException → 403
  → (엔드포인트별 처리)
  → GlobalExceptionHandler    예외를 {code, message} 로
```

**운영자 여부를 토큰이 아니라 DB에서 본다.** access 토큰은 15분 살아 있어서 클레임으로 두면
권한을 회수해도 그동안 계속 통한다. 그래서 컨트롤러의 **모든 메서드가 첫 줄에서**
`requireInternalAdmin`을 부른다 — 애너테이션 하나로 처리하지 않는 이유는 빠뜨렸을 때 조용히
열리기 때문이다.

> 확인해 보려면: 로그인해서 토큰을 받아 둔 뒤 DB에서 `is_internal_admin = false`로 되돌리고
> **같은 토큰**으로 다시 호출한다. 즉시 403이 나온다.

---

## 4. 요청별 상세

Body가 있는 요청은 전부 **Body → raw → JSON**이다.

### 4-1. POST /api/admin/workspaces — 개설

가장 중요한 요청이다. 이거 하나가 DB 행 + PostgreSQL 스키마 + 테넌트 테이블 6개 + 기본
데이터를 한 번에 만든다.

```json
{
  "name": "한빛제철 주식회사",
  "bizNumber": "{{bizNumber}}",
  "corpNumber": "1101111234567",
  "ceoName": "홍길동",
  "bizType": "제조업",
  "bizItem": "1차 철강 제조",
  "address": "경북 포항시 남구 철강로 12",
  "website": "https://hanbit-steel.co.kr",
  "taxEmail": "tax@hanbit.co.kr",
  "plan": "Enterprise",
  "operatorName": "김운영",
  "memo": "포항 2공장 MES 인증 정보 재발급 대기 중.",
  "contacts": {
    "linkName": "홍길동",
    "linkEmail": "hong@hanbit.co.kr",
    "contactName": "김구매",
    "contactEmail": "kim@hanbit.co.kr",
    "contactPhone": "054-000-0000",
    "ccEmails": ["it@hanbit.co.kr"]
  },
  "sites": [
    {
      "name": "포항 2공장",
      "bizNumber": "{{bizNumber}}",
      "address": "경북 포항시 남구 공단로 55",
      "bizType": "제조업",
      "bizItem": "철강 압연"
    }
  ]
}
```

**201 Created** — 응답이 온 시점에는 스키마까지 다 서 있다.

```json
{
  "id": 3,
  "name": "한빛제철 주식회사",
  "bizNumber": "1234567891",
  "status": "active",
  "schemaName": "ax_00003",
  "schemaVersion": "2",
  "plan": "Enterprise",
  "contacts": { "ccEmails": ["it@hanbit.co.kr"], "...": "..." },
  "sites": [ { "id": 1, "name": "포항 2공장", "...": "..." } ],
  "linkSentAt": null,
  "linkOpenedAt": null,
  "createdAt": "2026-08-31T05:34:37.037699600Z"
}
```

#### 내부 흐름 — 트랜잭션이 세 덩어리다

```
AdminWorkspaceController#create
  └ AdminWorkspaceService#create                      ← @Transactional 없음. 순서만 잡는다
      │
      ├ ① WorkspaceRegistrar#register                 ← @Transactional (커밋됨)
      │     WorkspaceRepository#findByBizNumber       중복이면 DuplicateBizNumberException → 409
      │     Workspace.open(name, bizNumber)           status = provisioning
      │     workspace.updateCompanyInfo / updateContacts / replaceSites
      │     WorkspaceRepository#save                  ← 여기서 DB가 PK 채번
      │     workspace.assignSchema()                  ← 그 다음에야 ax_00003 계산
      │
      ├ ② TenantProvisioner#provision                 ← 트랜잭션 밖. 전용 풀
      │     SchemaName.requireValid(schema)
      │     SELECT shared.create_tenant_schema(?)     V10. format('… %I') 로 서버가 조립
      │     SELECT shared.workspace_comment(?, ?)     V9. 실패해도 계속 진행
      │     Flyway.configure()
      │        .schemas(ax_00003).defaultSchema(ax_00003)
      │        .locations("db/migration/tenant")
      │        .group(true)                           ← 전량을 한 트랜잭션으로
      │        .migrate()                             V1(테이블 6) + V2(기본 역할·부서)
      │
      └ ③ WorkspaceRegistrar#activate                 ← @Transactional (커밋됨)
            status = active, schema_version = 2
```

**①과 ②를 한 트랜잭션에 넣지 않은 이유**가 있다. Flyway는 다른 커넥션을 쓰므로 아직 커밋되지
않은 `workspaces` 행을 볼 수 없고, DDL이 도는 내내 그 커넥션을 붙잡게 된다. 그래서 `status`로
어디까지 됐는지를 표현한다.

> `AdminWorkspaceService`와 `WorkspaceRegistrar`가 나뉘어 있는 것도 이 때문이다. 한 클래스에
> 두고 서로 부르면 자기 호출이 스프링 프록시를 거치지 않아 **`@Transactional`이 통째로 무시된다.**

#### Post-response 스크립트

```javascript
const json = pm.response.json();
pm.environment.set("workspaceId", json.id);
pm.test("201", () => pm.response.to.have.status(201));
pm.test("스키마가 섰다", () => pm.expect(json.schemaName).to.match(/^ax_\d{5,}$/));
pm.test("활성 상태", () => pm.expect(json.status).to.eql("active"));
```

#### 개설 뒤 DB 확인

```sql
-- 스키마와 코멘트
\dn+ ax_00003
--  ax_00003 | workspace | | 한빛제철 주식회사 / biz 1234567891

-- 테넌트 테이블 (6 + flyway_schema_history = 7)
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'ax_00003' ORDER BY 1;

-- 기본 데이터가 심어졌는가
SELECT code, name, is_admin, can_invite FROM ax_00003.roles ORDER BY id;
--  owner  | 소유자 | t | t
--  admin  | 관리자 | t | t
--  member | 구성원 | f | f
SELECT name FROM ax_00003.departments;   -- 미지정
```

---

### 4-2. GET /api/admin/workspaces — 목록

**Params**

| Key | 예 | 설명 |
|---|---|---|
| `keyword` | `한빛` | 상호 부분 일치(대소문자 무시) 또는 사업자번호 앞자리 |
| `status` | `active` | `provisioning` · `active` · `suspended` · `terminated`. 없으면 전체 |
| `page` | `0` | 기본 0 |
| `size` | `20` | 기본 20, **최대 200** |

**200 OK** — Spring Data `Page` 형태다.

```json
{
  "content": [
    {
      "id": 3,
      "name": "한빛제철 주식회사",
      "bizNumber": "1234567891",
      "plan": "Enterprise",
      "status": "active",
      "schemaName": "ax_00003",
      "operatorName": "김운영",
      "linkSentAt": null,
      "linkOpened": false,
      "createdAt": "2026-08-31T05:34:37.037699Z"
    }
  ],
  "totalElements": 1,
  "totalPages": 1,
  "number": 0,
  "size": 20
}
```

#### 내부 흐름

```
AdminWorkspaceController#list
  ├ parseStatus(status)                     모르는 값이면 400
  ├ PageRequest.of(page, clamp(size,1,200), Sort by id DESC)
  └ AdminWorkspaceService#search
      └ WorkspaceRegistrar#search           @Transactional(readOnly)
          WorkspaceSpecifications.search()  ← 조건이 있을 때만 술어를 붙인다
          WorkspaceRepository#findAll(spec, pageable)
      → .map(WorkspaceSummaryResponse::from)
```

> **Specification을 쓰는 이유.** JPQL에 `(:keyword IS NULL OR ...)`로 적으면 PostgreSQL이 null
> 파라미터의 타입을 추론하지 못해 `bytea`로 바인딩하고 `lower(bytea) does not exist`로 터진다.
> 실제로 한 번 터져서 바꿨다.

> **목록에는 사업장·담당자·참조 수신이 없다.** 전부 별도 조회라 목록에서 끌어오면 회사 수만큼
> 쿼리가 늘어난다(N+1). 상세에만 있다.

#### ⚠️ 한글 검색이 400으로 떨어질 때

**애플리케이션 버그가 아니다.** curl이나 셸이 한글을 CP949로 내보내면 Tomcat이
`Invalid character found in the request target`으로 거절한다.

```bash
# ✗ Git Bash 에서 이렇게 하면 400
curl -G "$URL" --data-urlencode "keyword=한빛"

# ✓ UTF-8 퍼센트 인코딩
curl "$URL?keyword=%ED%95%9C%EB%B9%9B"
```

**Postman에서는 정상 동작한다.** Postman은 항상 UTF-8로 인코딩한다.

---

### 4-3. GET /api/admin/workspaces/{id} — 상세

**200 OK** — 4-1의 응답과 같은 모양이다. 사업장·담당자·참조 수신이 전부 들어 있다.

#### 내부 흐름

```
AdminWorkspaceController#get
  └ AdminWorkspaceService#get
      └ WorkspaceRegistrar#detail            @Transactional(readOnly)
          WorkspaceRepository#findById       없으면 WorkspaceNotFoundException → 404
          WorkspaceResponse.from(workspace)  ← 매핑을 트랜잭션 안에서 끝낸다
```

> **왜 매핑까지 트랜잭션 안인가.** 사업장(`@OneToMany`)과 참조 수신(`@ElementCollection`)이
> 지연 로딩이다. 트랜잭션 밖에서 응답을 만들면 세션이 닫힌 뒤 컬렉션을 건드려 실패한다.
> 그래서 `WorkspaceRegistrar`는 엔티티가 아니라 DTO를 돌려준다.

---

### 4-4. PUT /api/admin/workspaces/{id} — 수정

**부분 수정이 아니라 전체 교체다.** 화면이 상세 폼 전체를 들고 저장을 누르므로 PUT이다.
PATCH로 두면 null을 "바꾸지 않음"으로 읽어야 하고, 그러면 **값을 비우는 조작을 표현할 수 없다.**

```json
{
  "name": "한빛제철 주식회사 (수정)",
  "corpNumber": "1101111234567",
  "ceoName": "홍길동",
  "bizType": "제조업",
  "bizItem": "1차 철강 제조",
  "address": "경북 포항시 남구 철강로 99",
  "website": "https://hanbit-steel.co.kr",
  "taxEmail": "tax2@hanbit.co.kr",
  "plan": "Growth",
  "operatorName": "박운영",
  "memo": "요금제 하향 조정",
  "contacts": {
    "linkName": "홍길동",
    "linkEmail": "hong@hanbit.co.kr",
    "contactName": "이연락",
    "contactEmail": "lee@hanbit.co.kr",
    "contactPhone": "054-111-1111",
    "ccEmails": ["it@hanbit.co.kr", "cfo@hanbit.co.kr"]
  },
  "sites": [
    { "name": "포항 3공장", "bizNumber": "{{bizNumber}}", "address": "경북 포항시 북구 신항로 7",
      "bizType": "제조업", "bizItem": "철강 가공" }
  ]
}
```

#### 받지 않는 것 — 보내도 무시된다

| 필드 | 왜 |
|---|---|
| `bizNumber` | 회사의 유일성을 보장하는 키다. 바뀌면 그 스키마 안의 데이터가 다른 회사 것이 된다. 잘못 열었으면 해지 후 재개설이 맞다 |
| `status` | 중지·재개·해지는 전용 엔드포인트가 있다. 일반 수정에 섞으면 상호를 고치려다 회사를 닫는 요청이 만들어진다 |
| `schemaName` | 생성 후 불변. `assignSchema()`가 이미 값이 있으면 예외를 던진다 |

#### 내부 흐름

```
WorkspaceRegistrar#update                    @Transactional
  workspace.rename / changeCeoName / changePlan
  workspace.updateCompanyInfo(...)
  workspace.updateContacts(...)              ccEmails 를 clear 후 addAll
  workspace.replaceSites(...)                sites 를 clear 후 addAll (orphanRemoval)
  → WorkspaceResponse.from(workspace)
```

**확인할 것**: 응답의 `sites[0].id`가 **바뀌어 있어야 한다.** 기존 행을 지우고 새로 넣기 때문이다.

---

### 4-5. POST /api/admin/workspaces/{id}/suspend · /resume — 중지·재개

Body 없음.

**200 OK** — `status`가 `suspended` / `active`로 바뀐 상세를 돌려준다.

**진입만 막는다. 스키마와 데이터는 그대로 둔다.**

#### 내부 흐름

```
WorkspaceRegistrar#suspend                   @Transactional
  status != ACTIVE 이면 WorkspaceStateException → 409
  workspace.suspend()

WorkspaceRegistrar#resume                    @Transactional
  status != SUSPENDED 이면 WorkspaceStateException → 409
  workspace.resume()
```

> 중지된 회사는 `WorkspaceStatus.isEnterable()`이 false라 고객의 회사 선택
> (`POST /api/auth/workspaces/{id}/select`)에서 막힌다. 다만 **순회 마이그레이션 대상에는
> 포함된다** — 재개했을 때 혼자만 구조가 뒤처져 있으면 안 되기 때문이다.

---

### 4-6. DELETE /api/admin/workspaces/{id} — 해지

Body 없음. **200 OK** (204 아님 — 바뀐 상세를 돌려준다).

#### ⚠️ 스키마를 지우지 않는다

```
WorkspaceRegistrar#terminate                 @Transactional
  workspace.terminate()                      status = terminated
                                             ← DROP SCHEMA 는 하지 않는다
```

`DROP SCHEMA ... CASCADE` 한 줄이면 되지만 **되돌릴 수 없다.** 유예기간이 지난 뒤 덤프를 남기고
배치가 지우는 순서가 맞는데, **그 배치는 아직 없다.** 지금은 해지된 스키마가 그대로 남아 있으며
이것이 의도된 상태다.

```sql
-- 해지 후에도 스키마는 있다
SELECT count(*) FROM information_schema.schemata WHERE schema_name = 'ax_00003';  -- 1
```

> **현재 상태 검사가 없다.** 이미 해지된 회사를 다시 해지해도 200이 나온다.
> `suspend`/`resume`과 일관성이 없는 부분이다.

---

### 4-7. POST /api/admin/workspaces/{id}/provision — 개설 재시도

개설이 실패해 `provisioning` 상태로 남은 회사를 다시 시도한다.

**409** — 개설 중이 아닌 회사에 부르면 `"개설 중인 워크스페이스만 다시 시도할 수 있습니다: active"`

#### 내부 흐름

```
AdminWorkspaceService#retryProvisioning
  WorkspaceRegistrar#status(id)              PROVISIONING 아니면 WorkspaceStateException → 409
  WorkspaceRegistrar#readRegistration(id)    id · schemaName · label 만 꺼낸다
  → provision(...)                           4-1 의 ②③ 과 같은 경로
```

**두 번 돌아도 안전하다.** `create_tenant_schema`가 `IF NOT EXISTS`이고, Flyway가 각 스키마의
`flyway_schema_history`를 보고 이어서 적용한다.

#### 실패 상태를 인위적으로 만들어 보려면

```sql
-- 스키마를 지우고 상태를 되돌린다 (로컬에서만)
DROP SCHEMA IF EXISTS ax_00003 CASCADE;
UPDATE shared.workspaces SET status = 'provisioning', schema_version = NULL WHERE id = 3;
```

그 다음 `POST /{id}/provision` → 200, 스키마가 다시 선다.

---

### 4-8. POST /api/admin/workspaces/{id}/link-sent — 접속 링크 발송 기록

Body 없음. **시각만 기록한다. 실제 메일 발송은 아직 없다.**

```
WorkspaceRegistrar#markLinkSent              @Transactional
  workspace.markLinkSent(Instant.now())      link_sent_at 채움
```

응답의 `linkSentAt`이 채워지고, 목록의 `linkOpened`는 여전히 `false`다
(`link_opened_at`을 채우는 코드는 아직 없다).

---

### 4-9. POST /api/admin/workspaces/migrate — 전 스키마 순회 배포

배포 후 한 번 돌린다. Body 없음.

**200 OK** — **일부가 실패해도 200이다.**

```json
{
  "total": 3,
  "migrated": ["ax_00001", "ax_00002", "ax_00003"],
  "failures": []
}
```

실패가 있으면:

```json
{
  "total": 3,
  "migrated": ["ax_00001"],
  "failures": [
    { "workspaceId": 2, "schemaName": "ax_00002", "message": "..." }
  ]
}
```

#### 내부 흐름

```
TenantMigrationRunner#migrateAll
  WorkspaceRegistrar#findAllMigratable       status IN (active, suspended) AND schema_name IS NOT NULL
  for each:
    TenantProvisioner#migrate(schema)        Flyway. 밀린 것만 적용
    WorkspaceRegistrar#recordSchemaVersion   각각 별도 트랜잭션
    실패하면 failures 에 담고 계속               ← 멈추지 않는다
```

**왜 한 회사의 실패로 멈추지 않는가.** 각 테넌트 스키마가 자기 `flyway_schema_history`를 갖기
때문에 서로 영향이 없다. 전체를 실패로 표현하면 성공한 것들의 결과가 사라진다.

**대상에서 빠지는 것**: `provisioning`(스키마가 없거나 만들다 실패 — 되살리면 안 됨),
`terminated`(지울 예정).

> ⚠️ **상한도 타임아웃도 없다.** 회사가 많으면 DDL이 HTTP 요청 하나 안에서 오래 돈다.
> 지금은 로컬·소규모에서만 쓰고, 운영에서는 비동기 잡이나 CLI로 빼는 것이 맞다.

---

## 5. 실패 응답 — 실제 확인값

| 상황 | 코드 | 응답 |
|---|---|---|
| 운영자가 아닌 계정 | **403** | `{"code":"FORBIDDEN","message":"권한이 없습니다"}` |
| 토큰 없음·만료 | **401** | `{"code":"UNAUTHORIZED","message":"인증이 필요합니다"}` |
| 없는 워크스페이스 | **404** | `{"code":"WORKSPACE_NOT_FOUND","message":"워크스페이스를 찾을 수 없습니다: 9999"}` |
| 중복 사업자번호 | **409** | `{"code":"WORKSPACE_STATE_CONFLICT","message":"이미 개설된 사업자등록번호입니다: 1234567891 (한빛제철 주식회사)"}` |
| 중지된 회사를 또 중지 | **409** | `{"code":"WORKSPACE_STATE_CONFLICT","message":"운영 중인 워크스페이스만 중지할 수 있습니다"}` |
| 사업자번호 형식 오류 | **400** | `{"code":"VALIDATION_FAILED","message":"입력값을 확인해 주세요","fields":{"bizNumber":"사업자등록번호는 하이픈 없이 10자리 숫자여야 합니다"}}` |
| 알 수 없는 status 필터 | **400** | Spring 기본 형태 (`{"timestamp":...,"status":400,...}`) |
| 프로비저닝 실패 | **500** | `{"code":"PROVISIONING_FAILED","message":"워크스페이스를 개설하지 못했습니다. 목록에서 다시 시도해 주세요"}` |

> **500의 본문에 원인을 싣지 않는다.** 스키마 이름과 DDL 오류가 그대로 드러나기 때문이다.
> 원인은 BE 로그에서 본다. 행은 `provisioning`으로 남아 있으니 목록에서 찾아 재시도할 수 있다.

> **`status=bogus`만 응답 모양이 다르다.** `ResponseStatusException`을 쓰는데
> `GlobalExceptionHandler`가 그걸 잡지 않아 서블릿 기본 형태로 나간다. 기존 `OAuthController`도
> 같은 방식이라 일관성은 있지만, API 전체로 보면 어긋나는 지점이다.

---

## 6. 시나리오

### 시나리오 A — 정상 흐름

```
0. login                     → accessToken 저장
1. create                    → 201, workspaceId·ax_00003 저장
2. get                       → 200, sites·contacts 확인
3. update                    → 200, sites[0].id 가 바뀌었는지 확인
4. link-sent                 → 200, linkSentAt 채워짐
5. suspend                   → 200, status=suspended
6. resume                    → 200, status=active
7. list?keyword=한빛          → totalElements=1
8. terminate                 → 200, status=terminated
9. (SQL) 스키마가 남아 있는지  → 1
```

### 시나리오 B — 권한 확인이 실시간인가

```
1. login                                  → 토큰 확보
2. list                                   → 200
3. (SQL) is_internal_admin = false 로 변경
4. list  ← 같은 토큰 그대로                 → 403
5. (SQL) 다시 true
6. list  ← 여전히 같은 토큰                 → 200
```

**토큰을 다시 받지 않았는데도 403 ↔ 200이 오간다.** 요청 시점의 DB를 보기 때문이다.

### 시나리오 C — 중복 개설

```
1. create (bizNumber=1234567891)  → 201
2. create (같은 bizNumber)         → 409, 기존 회사 이름이 메시지에 포함
```

운영자만 보는 화면이라 어느 회사인지 알려 준다. 고객용 API였다면 감춰야 할 정보다.

### 시나리오 D — 재시도

4-7의 SQL로 실패 상태를 만든 뒤 `POST /{id}/provision` → 200.

---

## 7. 컬렉션 통째로 돌리기

**Collection → Run**. 순서는 위 시나리오 A 그대로.

`create`는 `bizNumber`가 유일해야 하므로 매번 바꿔야 한다. Pre-request 스크립트로 자동화:

```javascript
// create 요청의 Scripts → Pre-request
const n = String(Math.floor(Math.random() * 9000000000) + 1000000000);
pm.environment.set("bizNumber", n);
```

> 사업자번호 체크섬을 검증하지 않으므로 임의의 10자리로 충분하다. FE 개설 화면은
> 국세청 체크섬을 확인하지만 BE는 형식만 본다.

---

## 8. 트러블슈팅

| 증상 | 원인 |
|---|---|
| 전부 **403** | `is_internal_admin`을 안 켰다. 0-4 참고 |
| 전부 **401** | 컬렉션 Auth에 `{{accessToken}}`을 안 넣었거나 환경 미선택 |
| create가 **500** | BE 로그에서 `TenantProvisioningException` 확인. 대개 `axcore-provisioning` 풀이 안 떴거나 V9·V10 함수가 없다 |
| create가 **409**인데 목록에 없다 | `terminated` 상태로 남아 있다. `status` 필터를 빼고 조회 |
| 한글 `keyword`가 **400** | curl의 셸 인코딩 문제. Postman에서는 정상 (4-2 참고) |
| `\dn+`에 스키마가 없다 | 개설이 ②에서 실패했다. 상태가 `provisioning`이면 4-7로 재시도 |
| `{{baseUrl}}` 그대로 요청됨 | 우측 상단에서 환경을 선택하지 않았다 |

---

## 9. 로컬 정리

테스트로 만든 워크스페이스와 스키마를 지우려면:

```sql
-- 스키마 먼저 (CASCADE 로 테넌트 테이블 전부)
DROP SCHEMA IF EXISTS ax_00003 CASCADE;

-- 그 다음 행 (workspace_sites · workspace_cc_emails 는 ON DELETE CASCADE)
DELETE FROM shared.workspaces WHERE id = 3;
```

**순서가 중요하다.** 행을 먼저 지우면 `schema_name`을 잃어버려 어느 스키마를 지워야 할지
알 수 없게 된다.

---

## 10. 이어지는 문서

- [tenant-provisioning.md](tenant-provisioning.md) — 설계 배경, 스키마 이름 규칙, `search_path`와 HikariCP
- [auth-api-postman-test.md](auth-api-postman-test.md) — 로그인·재발급·로그아웃
- [account-api-postman-test.md](account-api-postman-test.md) — 계정 관리 14개
