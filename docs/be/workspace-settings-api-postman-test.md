# 워크스페이스 설정 API — Postman 테스트 가이드 (1단계: 내 자격 · 기능 관리)

`/api/workspace/*` 는 **지금 고른 회사**(access 토큰의 `wsid`)의 설정을 그 회사 구성원이 다루는 API 다.
운영자 콘솔 `/api/admin/*` 과 다르다 — 저쪽은 우리 운영팀이 회사를 개설·관리하는 곳이다.

아래 응답 예시는 전부 로컬(`localhost:8080`)에서 실제로 호출해서 받은 값이다(2026-09-08).

대상 코드
- `BE/.../workspace/settings/WorkspaceSettingsController.java` · `WorkspaceSettingsService.java`
- `BE/.../workspace/settings/TenantAccess.java` — 소속 재확인 → 스키마 열기 → 직급 읽기 (모든 설정 API 의 입구)
- `BE/.../workspace/settings/TenantContext.java` — `requireAdmin()` 등 권한 가드
- `BE/.../workspace/settings/FeatureCatalog.java` — 모듈·탭 카탈로그 (`FE/data/modules.ts` 와 같은 값)
- `BE/src/main/resources/db/migration/tenant/V8__enabled_features.sql`

---

## 0. 시작 전 확인

```
GET {{baseUrl}}/actuator/health   → 200 {"status":"UP"}
```

부팅 로그에 테넌트 순회가 끝났는지 본다. 회사마다 `enabled_features` 가 있어야 한다.

```
TenantMigrationOnBoot : 테넌트 마이그레이션 완료 — 대상 9개 전부 최신
```

## 1. 토큰 준비 — 회사 선택까지

`auth-api-postman-test.md` 의 login 뒤에 **회사 선택**이 한 번 더 필요하다. 로그인 직후 토큰에는 `wsid` 가 없다.

```
POST {{baseUrl}}/api/auth/login                       → accessToken (wsid 없음)
POST {{baseUrl}}/api/auth/workspaces/{id}/select      → accessToken (wsid 있음)  ← 이걸 쓴다
```

테스트 계정은 두 개를 쓴다. 이메일 확인이 끝나고 그 회사의 테넌트 `members` 에 행이 있어야 한다.

| 계정 | 테넌트 역할 | 용도 |
|---|---|---|
| `settings.admin@axcore.ai.kr` | `admin` | 저장이 되는 쪽 |
| `settings.member@axcore.ai.kr` | `member` | 저장이 막히는 쪽 |

## 2. 컬렉션

| # | Method | URL | 가드 |
|---|---|---|---|
| 1 | GET | `{{baseUrl}}/api/workspace/me` | 구성원 |
| 2 | GET | `{{baseUrl}}/api/workspace/features` | 구성원 |
| 3 | PUT | `{{baseUrl}}/api/workspace/features/{module}` | **관리자 · 자기 직급이 가진 탭만**(소유자는 전부) |

---

## 3. GET /me — 이 회사에서 나는 누구인가

```
GET {{baseUrl}}/api/workspace/me
Authorization: Bearer {{accessToken}}
```

```json
{
  "workspaceId": 26,
  "workspaceName": "에이엑스코어",
  "member": {
    "id": 1, "roleCode": "admin", "roleName": "관리자",
    "admin": true, "owner": false, "canInvite": true,
    "departmentId": null, "departmentName": null, "title": null,
    "internalAdmin": false
  },
  "modules": ["management", "inventory", "sales"],
  "features": [
    { "module": "management", "enabled": true,
      "tabs": { "hr": true, "payroll": true, "materials": true, "accounting": true } },
    { "module": "design", "enabled": false,
      "tabs": { "drawings": false, "specs": false, "bom": false } },
    ...
  ]
}
```

- `modules` — 내가 쓸 수 있는 모듈. **회사가 켠 것 ∩ 직급·개인 권한.** introspect 가 AI 서버에 주는 값과 같은 계산이다.
- `features` — 회사가 켠 탭 전부. 행이 없는 탭은 코드 기본값(management · inventory · sales 만 ON)으로 채워져 온다.
- `member` 의 불리언은 화면이 무엇을 잠글지 정하는 데만 쓴다. **보안 경계는 아니다** — 우회하면 아래 403 이 막는다.

`member` 계정으로 부르면 `admin: false`, `modules: []` 다 — 아직 그 직급에 `role_module_grants` 가 없기 때문이다(2단계에서 화면이 생긴다).

### 회사를 고르지 않은 토큰 (409)

```json
{ "code": "WORKSPACE_REQUIRED", "message": "회사를 먼저 선택해 주세요" }
```

introspect 와 같은 코드다. 스키마가 아직 없는 회사면 `WORKSPACE_NOT_READY` 다.

## 4. PUT /features/{module} — 탭 켜고 끄기

보낸 탭만 바뀐다. 모듈 전체를 켜고 끄려면 그 모듈의 탭을 전부 같은 값으로 보낸다.

```
PUT {{baseUrl}}/api/workspace/features/design
Authorization: Bearer {{accessToken}}      (admin)
Content-Type: application/json

{ "tabs": { "drawings": true, "bom": true } }
```

```json
{ "module": "design", "enabled": true, "tabs": { "drawings": true, "specs": false, "bom": true } }
```

바로 `GET /me` 를 다시 부르면 `modules` 에 `design` 이 들어온다. 반대로 `sales` 의 탭을 전부 `false` 로 보내면 `modules` 에서 빠진다 — 사이드바와 AI 답변 범위가 함께 좁아진다.

### 실패 케이스

| 상황 | 응답 |
|---|---|
| 카탈로그에 없는 탭 `{"tabs":{"nope":true}}` | 400 `{"code":"VALIDATION_FAILED","message":"제품설계 에 없는 탭입니다: nope"}` |
| 없는 모듈 `/features/hacking` | 400 `{"code":"VALIDATION_FAILED","message":"알 수 없는 기능입니다: hacking"}` |
| 빈 본문 `{"tabs":{}}` | 400 `{"code":"VALIDATION_FAILED","message":"입력값을 확인해 주세요","fields":{"tabs":"비어 있을 수 없습니다"}}` |
| `member` 계정 | 403 `{"code":"FORBIDDEN","message":"이 작업은 관리자만 할 수 있습니다"}` |
| 토큰 없음 | 401 |

검증에 하나라도 걸리면 **아무것도 저장되지 않는다.** 절반만 저장돼 화면과 DB 가 다른 상태를 만들지 않는다.

## 5. 다른 회사의 `wsid` 를 실은 토큰

`select` 는 소속을 확인하고 발급하므로 정상 경로로는 만들 수 없다. 만들어 보내도 `TenantAccess` 가 요청 시점에
`user_workspace_memberships` 를 다시 보고 403 `WORKSPACE_ACCESS_DENIED` 로 막는다. 토큰의 `wsid` 를 믿고 스키마를 여는
자리는 없다 — `TenantSearchPath.bind` 를 부르는 곳은 `TenantAccess` · `ModuleAccessReader` · `TenantMemberWriter` 뿐이다.

## 6. 회귀 확인 — introspect

소속 판정을 `TenantAccess.resolveWorkspace` 한 곳으로 모으면서 `POST /api/auth/introspect` 도 그 메서드를 쓰게 됐다.
같은 토큰으로 introspect 를 부르면 `modules` 가 `GET /me` 의 `modules` 와 같아야 한다. (로컬 확인: `["management","design","inventory"]` 로 일치)

---

# 2단계: 부서 · 직급 · 탭 권한 (`/api/workspace/departments` · `/api/workspace/roles`)

설정 › 회사 › 권한 관리 화면의 API 다. 아래 응답은 로컬에서 실제로 호출한 값이다(2026-09-08).

대상 코드
- `BE/.../workspace/settings/OrganizationSettingsController.java` · `DepartmentService.java` · `RoleService.java`
- `BE/.../workspace/settings/RolePermissions.java`(권한 묶음 · `covers` 부분집합 판정) · `RolePermissionReader.java`
- tenant `V9__roles_department_scope.sql` · `V10__role_grants_by_tab.sql`

## 누가 무엇을 고칠 수 있는가 (2026-09-08 변경 — 소유자만)

처음엔 관리자도 자기 권한 안에서 편집할 수 있게 했지만(결정 B), 직급·권한·구성원을 정하는 자리는 회사를 대표하는 한 사람에게만 두기로 바꿨다.

| 대상 | 소유자 | 그 외(관리자 포함) |
|---|---|---|
| 부서 만들기 · 이름 · 지우기 | ○ | 읽기만 |
| `owner` 직급 | × (고정, 권한은 항상 전부) | × |
| `member` 직급 | 권한만 ○ (이름·부서·`admin` 고정) | × |
| 그 밖의 직급 | ○ | × |

`GET /roles` 의 `editable` · `assignable` 은 소유자에게만 true 다(소유자 직급 제외). 화면은 그 값으로 잠근다 — 보안 경계는 서버의 `requireOwner` 다.

## 테스트 계정

| 계정 | 역할 |
|---|---|
| `settings.owner@axcore.ai.kr` | `owner` |
| `settings.admin@axcore.ai.kr` | `admin` |
| `settings.member@axcore.ai.kr` | `member` |

## 컬렉션

| Method | URL | 가드 | 비고 |
|---|---|---|---|
| GET | `/api/workspace/departments` | 구성원 | `roleCount` 가 0 이어야 지울 수 있다 |
| POST | `/api/workspace/departments` `{"name"}` | 관리자 | 201. 같은 이름 → 409 `CONFLICT`(DB 유일 인덱스가 막는다) |
| PATCH | `/api/workspace/departments/{id}` `{"name"}` | 관리자 | |
| DELETE | `/api/workspace/departments/{id}?moveRolesTo=` | 관리자 | 직급이 남았는데 `moveRolesTo` 없음 → 409 `DEPARTMENT_NOT_EMPTY` |
| GET | `/api/workspace/roles` | 구성원 | `editable` 포함 |
| POST | `/api/workspace/roles` `{"name","departmentId"}` | 소유자·관리자 | 권한 없이 시작. `departmentId` 필수(「전사」에는 못 만든다) |
| PUT | `/api/workspace/roles/{id}` (아래 본문) | 소유자·관리자 | 전체 교체. 화면의 「저장하기」 |
| DELETE | `/api/workspace/roles/{id}?moveMembersTo=` | 소유자·관리자 | 구성원이 있는데 `moveMembersTo` 없음 → 409 `ROLE_HAS_MEMBERS` |

### PUT 본문

```json
{
  "name": "공장장", "departmentId": 5,
  "admin": false, "canInvite": true, "canManageIntegrations": false,
  "dataScope": "dept", "showAmounts": false,
  "tabs": ["items", "stock"]
}
```

`tabs` 는 카탈로그(`FeatureCatalog`)에 있으면 저장된다. **회사가 끈 기능의 탭도 저장은 된다** — 권한은 "가졌나" 이고
실제 접근(`/me` 의 `modules`, introspect)은 회사가 켠 것과의 교집합이다. 화면은 끈 기능의 토글을 잠가 바꾸지 못하게만 한다.

## 실제 호출 결과

```
owner GET /roles          → [["owner", editable:false, 1명], ["admin", true, 1명], ["member", true, 1명]]
admin GET /roles          → [["owner", false], ["admin", false(자기 직급)], ["member", false(고정)]]
member POST /departments  → 403 FORBIDDEN "이 작업은 관리자만 할 수 있습니다"
owner POST /departments 생산본부         → 201 {"id":5,"name":"생산본부","roleCount":0,"memberCount":0}
owner POST 같은 이름                      → 409 CONFLICT "이미 존재하는 값입니다"
owner POST /roles {공장장, 5}            → 201 {"id":7,"tabs":[],"editable":true}
owner PUT 7 tabs:["monitoring"] (production 꺼짐) → 200 tabs:["monitoring"]   ← 저장은 되고 modules 에는 안 나온다
owner PUT 7 tabs:["nope"]                → 400 "알 수 없는 탭입니다: nope"
owner PUT 7 dataScope:"galaxy"           → 400 VALIDATION_FAILED
owner PUT 1 (소유자)                     → 403 "소유자 직급은 고칠 수 없습니다"
owner PUT 3 (구성원) admin:true, tabs:["orders"] → 200 admin:false(고정), tabs:["orders"]
admin PUT 3 (구성원)                     → 403 "고정 직급의 권한은 소유자만 고칠 수 있습니다"
admin PUT 2 (자기 직급)                  → 403 "자기 직급은 고칠 수 없습니다"
admin PUT 7 이름만 바꾸기                → 200 (내 권한 안)
owner PUT 2 관리자 탭 27 → 24 (영업 3개 제외)
admin GET /me                            → modules:["management","design","inventory"] (sales 사라짐)
admin PUT 7 tabs:["orders"]              → 403 "내 권한 밖의 권한은 줄 수 없습니다"
owner DELETE /departments/5 (직급 남음)   → 409 DEPARTMENT_NOT_EMPTY
owner DELETE /roles/3 (고정)             → 403 "고정 직급은 지울 수 없습니다"
owner DELETE /roles/7 · /departments/5   → 204 · 204
introspect(admin) modules == GET /me modules
```

---

# 3단계: 구성원 · 이메일 초대 · 초대 링크 (`/api/workspace/members` · `/invitations` · `/invite-links`)

설정 › 회사 › 초대 관리 화면의 API 다. 아래 응답은 로컬에서 실제로 호출한 값이다(2026-09-08).

대상 코드
- `BE/.../workspace/settings/PeopleSettingsController.java` · `MemberService.java` · `MemberInvitationService.java` · `InviteLinkService.java`
- `BE/.../workspace/settings/PeopleGuard.java` — "내가 이 직급·부서를 줄 수 있는가" (초대 · 링크 · 소속 변경이 같은 규칙)
- `BE/.../workspace/controller/InviteLinkController.java` — 링크를 연 사람의 공개 경로
- `BE/.../workspace/service/TenantMemberWriter.joinWithRole` · `WorkspaceInvitationService.accept`(kind = member 분기)
- shared `V18__member_invitations.sql`

## 규칙

| 무엇 | 누가 | 조건 |
|---|---|---|
| 구성원 목록 | 구성원 누구나 | |
| 소속(부서·직급) 변경 · 초대 · 링크 | **소유자만**(2026-09-08 변경) | 소유자 직급은 줄 수 없다 |
| 소속 변경 예외 | | 소유자의 소속은 불가 |
| 이메일 초대 수락 | 초대받은 주소의 계정 | 기존 `/api/auth/invitations/accept`. 초대에 실린 직급·부서로 들어간다(직급이 지워졌으면 member) |
| 링크 수락 | 이메일 확인된 아무 계정 | `use_count < max_uses` 를 한 문장으로 선점. 이미 구성원이면 자리를 쓰지 않는다 |

`GET /roles` 의 `assignable` 이 "줄 수 있는 직급"(소유자에게 소유자 직급 제외 전부) 을 미리 준다 — 초대 팝업·링크 만들기·소속 변경의 직급 목록이 이 값으로 걸러진다.

## 컬렉션

| Method | URL | 가드 | 비고 |
|---|---|---|---|
| GET | `/api/workspace/members` | 구성원 | `roleCode = owner` 행은 소속 변경 불가 |
| PATCH | `/api/workspace/members/{id}` `{"roleId","departmentId"}` | 소유자 | |
| GET | `/api/workspace/invitations` | 소유자 | 살아 있는(pending) 직원 초대만 |
| POST | `/api/workspace/invitations` `{"emails":[…],"roleId","departmentId"}` | 소유자 | 최대 100명. `results` 에 주소마다 `sent` / `skipped`(이유) — 합계는 화면이 센다. **메일은 시스템이 보낸다**(`MAIL_MODE=log` 면 BE 로그에 링크) |
| POST | `/api/workspace/invitations/{id}/resend` | 소유자 | 새 링크 발급 + 메일. 이전 링크 회수 |
| DELETE | `/api/workspace/invitations/{id}` | 소유자 | 회수 |
| GET | `/api/workspace/invite-links` | 소유자 | `url` 은 null — 해시만 저장 |
| POST | `/api/workspace/invite-links` `{"roleId","departmentId","maxUses"(1~50),"expiresInDays"(1~30)}` | 소유자 | 201. **`url` 은 이 응답에만** |
| DELETE | `/api/workspace/invite-links/{id}` | 소유자 | 회수 |
| POST | `/api/auth/invite-links/preview` `{"token"}` | 공개 | 회사 이름 · 받게 될 직급·부서 |
| POST | `/api/auth/invite-links/accept` `{"token"}` | 로그인 | 소속을 만들고 돌려준다 |

## 실제 호출 결과

```
member PATCH /members/{admin}              → 403 FORBIDDEN
admin  PATCH /members/{owner}              → 403 "소유자의 소속은 바꿀 수 없습니다"
admin  PATCH /members/{self}               → 403 "자기 소속은 바꿀 수 없습니다"
owner  PATCH /members/{m} roleId=owner     → 403 "소유자 직급은 줄 수 없습니다"
admin  PATCH /members/{m} admin · 부서1     → 200 ["admin","미지정"]
admin  POST /invitations 4건(정상·이미 구성원·형식 오류·중복) → 200 results: sent 1 · skipped 3 (이유 각각, 중복은 "초대 중")
admin  POST /invitations 같은 주소 다시     → skipped "초대 중이에요"
admin  POST /invitations/{id}/resend       → 200 (BE 로그에 새 링크, 이전 링크는 회수)
다른 계정 POST /api/auth/invitations/accept → 403 WORKSPACE_ACCESS_DENIED (주소 불일치)
초대받은 계정 accept                        → 200 → /me roleCode "member"; 다시 accept → 401
admin  POST /invite-links maxUses 0        → 400 VALIDATION_FAILED
admin  POST /invite-links maxUses 1 · 1일   → 201 url 있음 · GET 목록에서는 url null
공개   preview 링크                          → 200 ["에이엑스코어","구성원"] · 잘못된 토큰 → 401
계정 A accept 링크                          → 200 → /me "member" (use_count 1/1)
계정 B accept 같은 링크                     → 401 (한도 소진) · preview 도 401
admin  GET /invite-links                   → [["1/1", active:false]] · DELETE → 204 · 다시 → 404
```

## 남긴 것

- 구성원 제거(탈퇴 처리)는 없다. 소속(shared)과 구성원(테넌트)을 함께 닫아야 해서 별도 작업.
- 초대 메일 실제 발송은 `MAIL_MODE=smtp` + 발송 계정 설정이 있어야 한다(`docs/infra/ci-cd.md` 운영 작업). 지금 운영 서버는 `log` 라
  초대는 만들어지되 메일은 나가지 않는다 — 켤 때까지는 「초대 중」 목록의 「다시 보내기」로 재발송하는 것 외에 링크를 꺼낼 길이 없다.
- 이미 구성원인 사람이 **한도가 다 찬** 링크를 다시 열면 401 이다(살아 있는 링크면 자리를 쓰지 않고 200). 화면상 "쓸 수 없는 링크" 로 보이지만 이미 들어와 있으므로 문제되지 않는다.

---

# 4단계 — 연동 (`/api/workspace/connectors`)

화면 「설정 › 워크스페이스 › 연동」의 두 섹션이 그대로 두 표다.

- **외부 시스템** (`external_systems`) — 회사의 ERP·MES·센서. 화면은 읽기만 한다. 운영팀이 등록한다 — 쓰기 API 가 없다.
- **외부 서비스** (`connected_services`) — AI 대화가 부를 수 있는 외부 앱 중 이 회사가 연결한 것. 카탈로그는 코드에 있다(`ConnectorCatalog`).

## 규칙

| | 목록 보기 | 연결 · 해제 |
|---|---|---|
| 소유자 | O | O |
| 관리자 직급 (`can_manage_integrations`) | O | O |
| 그 외 구성원 | O | 403 |

목록에 권한을 걸지 않는 이유: AI 대화 입력창이 같은 사실을 쓴다. 막으면 대화 화면의 앱 칩이 통째로 빈다.

## 컬렉션

| 메서드 | 경로 | 권한 | 비고 |
|---|---|---|---|
| GET | `/api/workspace/connectors` | 구성원 | `{systems, services, editable}`. `editable` 은 화면 잠금용 |
| PUT | `/api/workspace/connectors/services/{slug}` `{"connected":true\|false}` | 연동 관리 | 바뀐 전체를 돌려준다. 카탈로그에 없는 slug 는 400 |

## 실제 호출 결과

```
owner  GET /connectors            → 200 systems 3건(ERP·MES·센서 · ok/ok/delayed) · services [] · editable true
member GET /connectors            → 200 같은 systems · editable false
owner  PUT services/slack  true   → 200 ["slack"]
owner  PUT services/notion true   → 200 ["slack","notion"]   (카탈로그 순서)
member GET /connectors            → 200 ["slack","notion"]   (같은 회사는 같은 값을 본다)
owner  PUT services/slack  false  → 200 ["notion"]
member PUT services/slack         → 403 "연동을 바꿀 수 있는 권한이 없습니다"
owner  PUT services/dropbox       → 400 "알 수 없는 서비스입니다: dropbox"
owner  PUT services/notion {}     → 400 VALIDATION_FAILED
토큰 없이 GET                      → 401 UNAUTHORIZED
admin  GET /connectors            → editable true · PUT services/teams → 200 ["teams"]
```

## 남긴 것

- **외부 시스템을 등록할 화면이 없다.** 표와 조회만 만들었고 행은 운영이 직접 넣는다. 운영자 콘솔(`/admin`)에 붙이는 것이 다음 자리다.
- 커넥터 OAuth 는 없다. 지금 「연결」은 "이 회사가 쓰기로 했다" 는 표시일 뿐 실제 계정 인증이 아니다.
- 기존 회사에 표를 만들려면 `TENANT_MIGRATE_ON_BOOT=true` 로 한 번 띄운다 (부팅 후 전 스키마 순회).

---

# 5단계 — 커넥터 1차: 구글 연결 + Google Calendar 도구 (2026-09-09)

「연결」이 깃발에서 진짜 토큰이 됐다. 카탈로그는 14개에서 6개(Slack · Google Drive · Sheets · Notion · Gmail · Calendar)로
줄였고, 이번에 실제로 붙은 것은 **구글**이다. Slack · Notion 은 같은 세 단계에 제공자 클래스만 더한다.

## 구조

- 토큰은 **제공자 단위**(`connector_accounts`, tenant V12), 켜기/끄기는 **앱 단위**(`connected_services`). 구글 앱 넷은 계정 하나에
  스코프만 쌓는다(incremental authorization). 앱이 "연결됨" = 깃발 ∧ 계정 있음 ∧ 재연결 표시 없음 ∧ 스코프가 앱을 덮음.
- 토큰은 AES-GCM 으로 잠가 저장한다. 키는 `CONNECTOR_TOKEN_KEY`(base64 32바이트). 없으면 연결 시도만 503.
- 콜백은 소셜 로그인과 **같은 구글 콜백 주소**를 쓴다. state 가 `cn.<slug>.<payload>.<sig>` 로 시작하면 커넥터 흐름이다 —
  구글 콘솔에 주소를 더 등록하지 않아도 된다. state 는 서버가 서명하고(회사 · 사용자 · 앱 · 10분), 콜백을 부른 사람과 대조한다.
- 제공자 호출은 전부 BE 가 한다. AI 서버의 도구는 `/api/internal/connectors/...` 를 사용자 토큰 + `X-Internal-Token` 두 겹으로 부른다.

## 컬렉션

| Method | Path | 권한 | 비고 |
|---|---|---|---|
| GET | `/api/workspace/connectors` | 구성원 | `services` 는 실제로 쓸 수 있는 앱만. `accounts` 에 제공자 계정(이메일 · 재연결 필요) |
| POST | `/api/workspace/connectors/services/{slug}/authorize` | 연동 관리 | `{url}` — 구글 동의 화면. 브라우저를 이 주소로 보낸다 |
| POST | `/api/workspace/connectors/services/{slug}/callback` `{"code","state"}` | 연동 관리 | 토큰 저장 + 깃발. 바뀐 전체 응답 |
| DELETE | `/api/workspace/connectors/services/{slug}` | 연동 관리 | 깃발 내림. 같은 제공자의 마지막 앱이면 구글 토큰 회수 + 계정 삭제 |
| POST | `/api/internal/connectors/googlecalendar/list-events` `{from?,to?,max?}` | 내부 | AI 도구. 미연결이면 409 CONNECTOR_NOT_CONNECTED |
| POST | `/api/internal/connectors/googlecalendar/create-event` `{summary,start,end,description?}` | 내부 | AI 도구(승인 게이트 뒤) |

## 실제 호출 결과

```
admin  GET /connectors                          → 200 services [] · accounts [] · editable true
admin  POST googlecalendar/authorize            → 200 url: accounts.google.com · scope calendar.events+email · access_type offline · prompt consent · state cn.googlecalendar.…
member POST googlecalendar/authorize            → 403
admin  POST dropbox/authorize                   → 400 VALIDATION_FAILED
admin  POST slack/authorize                     → 503 "slack 연결은 아직 준비 중입니다"
admin  POST callback 위조 state                  → 400 VALIDATION_FAILED
member POST callback (남이 만든 state)            → 403 (권한 검사가 먼저)
admin  POST callback 가짜 code                   → 502 CONNECTOR_PROVIDER_FAILED
admin  DELETE googlecalendar (연결 안 된 상태)     → 200 [] (멱등)
내부   list-events, X-Internal-Token 없이         → 403
내부   list-events, 내부 토큰 있고 미연결           → 409 CONNECTOR_NOT_CONNECTED
내부   list-events, 사용자 토큰 없이               → 401
```

**구글 동의 화면을 실제로 통과하는 것은 브라우저에서만 된다.** 그 뒤 일정 조회·등록이 되려면 구글 클라우드 프로젝트에서
**Google Calendar API 가 켜져 있어야** 한다(403 → 문구에 힌트가 있다).

## 로컬에서 쓰려면

```
# BE/.env
CONNECTOR_TOKEN_KEY=   # openssl rand -base64 32
```
compose 배포는 `INFRA/.env` 의 같은 이름을 `app` 컨테이너로 넘긴다. 구글 자격증명은 소셜 로그인 것을 그대로 쓴다.

## 남긴 것

- Slack · Notion 제공자 구현(다음 PR 둘). `ConnectorOAuthService.requireGoogle` 이 그 자리다.
- 구글 나머지 앱(Drive · Sheets · Gmail)의 도구. 연결(스코프)은 이미 카탈로그에 있고, 내부 경로와 도구만 더한다.
- 개인 단위 연결. 지금은 회사 단위 하나다.

## 5단계 보강 — 구글 나머지 도구 (2026-09-09)

Gmail · Drive · Sheets 의 내부 경로와 AI 도구를 더했다. 연결(OAuth)은 그대로고, 앱마다 토큰을 꺼낼 때
"이 앱을 켰는가 · 이 앱의 스코프를 받았는가" 를 본다. 모든 구글 호출은 `GoogleApi` 하나를 거쳐 실패를 같은
규칙으로 바꾼다(401 → 다시 연결, 403 → 해당 API 활성화 힌트, 404 → id·범위 확인, 그 외 502).

| Method | Path | 도구 | 승인 |
|---|---|---|---|
| POST | `/api/internal/connectors/gmail/list-messages` `{query?,newerThanDays?,max?}` | `gmail_list_messages` | 없음 |
| POST | `/api/internal/connectors/gmail/read-message` `{id}` | `gmail_read_message` | 없음 |
| POST | `/api/internal/connectors/googledrive/search-files` `{keyword,mimeType?,max?}` | `googledrive_search_files` | 없음 |
| POST | `/api/internal/connectors/googledrive/read-file` `{fileId}` | `googledrive_read_file` | 없음 |
| POST | `/api/internal/connectors/googlesheets/read-range` `{spreadsheet,range}` | `googlesheets_read_range` | 없음 |
| POST | `/api/internal/connectors/googlesheets/append-rows` `{spreadsheet,range,rows}` | `googlesheets_append_rows` | **필요** |

- Gmail 은 `messages.list` 뒤 메시지마다 `messages.get`(metadata) 을 불러 보낸 사람·제목·날짜·미리보기를 만든다. 한 번에 20통 상한.
  본문은 text/plain 우선, 없으면 HTML 태그를 벗긴다. 12,000자에서 자른다.
- **Drive 스코프를 `drive.file` → `drive.readonly` 로 바꿨다.** `drive.file` 은 "이 앱이 만든 파일" 만 보여서 검색이 빈다.
  민감 스코프라 운영 배포 전 구글 앱 검증이 필요하다. 이미 연결한 회사는 Drive 「연결하기」를 다시 눌러 새 스코프에 동의해야 한다.
- Drive 본문은 구글 문서(text/plain export) · 구글 시트(CSV export) · 텍스트/CSV 파일만 읽는다. PDF·오피스는 메타데이터와 안내만.
- Sheets 는 주소(URL)나 id 를 받는다. 덧붙이기는 표 아래에 행을 붙이는 것만(`INSERT_ROWS`, `RAW`) — 기존 셀을 덮는 도구는 두지 않았다.
- 구글 클라우드 프로젝트에서 **Gmail API · Drive API · Sheets API** 를 켜야 한다. 안 켜면 403 문구에 힌트가 나온다.

```
8081(다른 키로 띄운 검증용) 에서:
gmail/list-messages   연결 O · 키 불일치            → 409 CONNECTOR_NOT_CONNECTED "저장된 연결 정보를 읽을 수 없습니다"
gmail/read-message    빈 id                         → 400 VALIDATION_FAILED
googledrive/search    미연결                        → 409 CONNECTOR_NOT_CONNECTED
googledrive/read-file X-Internal-Token 없이          → 403
googlesheets/read     미연결                        → 409
googlesheets/append   rows 빈 배열                  → 400
googlecalendar/create end < start                  → 400
사용자 토큰 없이                                     → 401
```

## 5단계 보강 — 등록 · 켜짐 · 해제를 가른다 (2026-09-09)

토글을 끄면 앱이 목록에서 사라지던 것을 바꿨다. 이제 세 상태다.

| 상태 | 뜻 | 바꾸는 경로 |
|---|---|---|
| 등록(registered) | 한 번 연결한 앱. `connected_services` 에 행이 있고 제공자 토큰이 그 앱의 스코프를 덮는다 | OAuth 콜백(등록+켜짐) / DELETE(해제) |
| 켜짐(enabled) | AI 대화가 지금 쓸 수 있다. `connected_services.connected` | `PUT /api/workspace/connectors/services/{slug}` `{"enabled": true|false}` |
| 해제 | 목록에서 빠진다. 같은 제공자의 마지막 앱이면 토큰 회수 + 계정 삭제 | `DELETE /api/workspace/connectors/services/{slug}` |

- 응답에 `registered: [{slug, enabled}]` 가 늘었다. `services` 는 그중 켜진 것만(AI 칩용)이다.
- 켤 때 제공자 계정이 스코프를 덮지 않으면 409 CONNECTOR_NOT_CONNECTED — 화면은 등록 안 된 앱이면 바로 OAuth 로 간다.
- **연결 결과는 모달로.** 구글에서 돌아온 콜백 화면은 아무것도 그리지 않고 연동 화면으로 돌아오며, 스토어에 남긴 알림을
  연동 화면이 모달로 보인다(「연결이 완료되었습니다」 / 실패 사유). 쿼리스트링이나 `useSearchParams` 를 쓰지 않는다 —
  클라이언트 이동이라 모듈 스토어가 살아 있다.

```
8081 에서(사용자의 실제 연결 상태는 건드리지 않음):
GET  /connectors                  → registered [{gmail,true},{googlecalendar,true}] · services [gmail, googlecalendar]
PUT  googlesheets enabled=true    → 409 CONNECTOR_NOT_CONNECTED (등록 안 됨 → 화면은 OAuth 로)
PUT  googlesheets {}              → 400 · PUT dropbox → 400
DELETE googledrive (행 없음)       → 200, 다른 구글 앱이 남아 계정 유지
member PUT gmail                  → 403
```

### 콜백은 연동 화면 자체다 (2026-09-09 확정)

구글은 `/settings/workspace/integrations` 로 바로 돌려보낸다. 그 화면(`integration-settings.tsx`)이 주소의 `code`·`state` 를 서버에
넘겨 마무리하고 주소를 지우고 결과 모달을 띄운다 — 중간 페이지가 없다. 소셜 로그인 콜백 페이지의 커넥터 분기는 지웠다.

- 기본값: `${MAIL_BASE_URL}/settings/workspace/integrations` (로컬 http://localhost:8000/…). 다르게 쓰려면 `GOOGLE_CONNECTOR_REDIRECT_URI`.
- **구글 클라우드 콘솔 › OAuth 클라이언트 › 승인된 리디렉션 URI 에 같은 주소가 있어야 한다.** 운영은 `https://<도메인>/settings/workspace/integrations`.
  글자 하나라도 다르면 구글이 `redirect_uri_mismatch` 로 막는다.
- state 는 서버가 서명하고 콜백 요청의 회사·사용자와 대조한다. 화면은 검증하지 않고 넘기기만 한다.
