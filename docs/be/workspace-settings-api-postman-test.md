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
| 3 | PUT | `{{baseUrl}}/api/workspace/features/{module}` | **관리자** |

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
