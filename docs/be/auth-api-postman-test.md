# 인증 API — Postman 테스트 가이드

`/api/auth/*` 5개 엔드포인트를 Postman으로 검증하는 절차다. 아래 응답 예시는 전부
로컬(`localhost:8080`)에서 실제로 호출해서 받은 값이다.

대상 코드: `BE/src/main/java/com/axcore/workspace/user/controller/AuthController.java`,
`BE/src/main/java/com/axcore/workspace/security/SecurityConfig.java`

---

## 0. 시작 전 확인

애플리케이션이 떠 있는지부터 본다. 이게 200이 아니면 아래는 전부 의미가 없다.

```
GET http://localhost:8080/actuator/health
→ 200 {"status":"UP"}
```

`/actuator/health/**`는 `SecurityConfig`에서 `permitAll`이라 토큰 없이 열린다.

DB(Postgres)가 떠 있어야 하고, Flyway가 `shared` 스키마에 `users` / `user_sessions`를
만들어 둔 상태여야 한다. 부팅 로그에 `Successfully applied ... migration`이 보이면 됐다.

---

## 1. Postman 환경(Environment) 만들기

값을 요청마다 손으로 복사하지 않기 위한 준비다. **Environments → Create Environment**,
이름은 `axpoint-local`.

| Variable | Initial value | 용도 |
|---|---|---|
| `baseUrl` | `http://localhost:8080` | 모든 요청의 앞부분 |
| `accessToken` | (비움) | 로그인 응답에서 스크립트가 자동으로 채운다 |
| `testEmail` | `postman.test@axcore.ai.kr` | 테스트 계정 |
| `testPassword` | `Test1234!@` | 비밀번호 규칙(영문+숫자+특수문자 8~16자)을 만족하는 값 |

`accessToken`은 **Current value**만 쓰이도록 두는 편이 낫다. Initial value에 토큰이 들어가면
환경을 export할 때 파일에 같이 실려 나간다.

우측 상단 환경 선택 드롭다운에서 `axpoint-local`을 선택해야 `{{baseUrl}}`이 치환된다.
이걸 빼먹고 `{{baseUrl}}` 그대로 요청이 나가는 게 가장 흔한 실수다.

---

## 2. 컬렉션 구조

**Collections → Create Collection**, 이름 `AXpoint Auth`. 아래 5개를 순서대로 만든다.

| # | 이름 | Method | URL | 인증 |
|---|---|---|---|---|
| 1 | signup | POST | `{{baseUrl}}/api/auth/signup` | 불필요 |
| 2 | login | POST | `{{baseUrl}}/api/auth/login` | 불필요 |
| 3 | me | GET | `{{baseUrl}}/api/auth/me` | **Bearer 필요** |
| 4 | refresh | POST | `{{baseUrl}}/api/auth/refresh` | 쿠키 |
| 5 | logout | POST | `{{baseUrl}}/api/auth/logout` | 쿠키 |

`signup` / `login` / `refresh` / `logout`은 `SecurityConfig`에서 `permitAll`이다.
`me`만 Bearer 토큰을 요구한다. `refresh`와 `logout`이 permitAll인 이유는, 유효한 refresh
쿠키를 들고 있다는 것 자체가 자격 증명이기 때문이다.

### 컬렉션 레벨 Auth 설정 (권장)

컬렉션 **Authorization** 탭 → Type `Bearer Token` → Token에 `{{accessToken}}`.
그러면 `me` 요청은 Auth를 `Inherit from parent`로 두기만 하면 되고,
토큰이 필요 없는 나머지 4개는 각 요청에서 `No Auth`로 바꿔 준다.

---

## 3. 요청별 상세

Body가 있는 요청은 전부 **Body → raw → JSON**이다. `Content-Type: application/json`은
Postman이 자동으로 붙인다.

### 3-1. POST /api/auth/signup

```json
{
  "email": "{{testEmail}}",
  "password": "{{testPassword}}",
  "name": "Postman Tester"
}
```

**201 Created**

```json
{
  "id": "1e5dcda5-4e82-45f3-b5e2-cbdb685103e8",
  "email": "postman.test@axcore.ai.kr",
  "name": "Postman Tester",
  "avatarUrl": null,
  "passwordChangedAt": "2026-08-28T01:31:30.095458900Z",
  "lastLoginAt": null,
  "createdAt": "2026-08-28T01:31:30.095458900Z"
}
```

`passwordHash`는 응답에 없다. `UserResponse`가 엔티티를 직접 직렬화하지 않기 때문이고,
이건 회귀 테스트로 지켜야 할 성질이다 (아래 6절 스크립트에 체크가 들어 있다).

이메일은 소문자로 정규화되어 저장된다. `Postman.Test@...`로 가입해도 `postman.test@...`가 된다.

### 3-2. POST /api/auth/login

```json
{
  "email": "{{testEmail}}",
  "password": "{{testPassword}}",
  "rememberMe": true
}
```

**200 OK**

```json
{
  "next": "SELECT_WORKSPACE",
  "accessToken": "eyJhbGciOiJIUzI1NiJ9....",
  "accessTokenExpiresAt": "2026-08-28T01:46:39.030498900Z",
  "user": { "id": "...", "email": "...", "name": "...", "lastLoginAt": "..." }
}
```

응답 헤더:

```
Set-Cookie: axp_refresh=WbgHo...; Path=/api/auth; Max-Age=1209599; Secure; HttpOnly; SameSite=Lax
```

읽을 점 세 가지.

- **`next`는 항상 `SELECT_WORKSPACE`다.** 회사 선택 엔드포인트가 아직 없어서 세션의
  `workspaceId`가 비어 있기 때문이다. `READY`가 나오면 그때가 회사 선택이 붙은 시점이다.
- **`refreshToken`은 응답 본문에 없다.** 없는 게 정상이다. HttpOnly 쿠키로만 나간다.
- **`rememberMe`를 `false`로 하거나 아예 빼면** `Max-Age`가 붙지 않는 세션 쿠키로 나간다.
  Postman에서는 앱을 닫을 때까지 유지되므로 브라우저만큼 티가 나지 않는다.
  차이를 확인하려면 응답 헤더에서 `Max-Age` 유무를 직접 본다.

`accessToken`은 [jwt.io](https://jwt.io)에 붙여넣어 payload를 볼 수 있다.
`iss=axpoint`, `sub`=사용자 UUID, `sid`=refresh 세션 UUID, `exp`=15분 뒤. 권한(role) 클레임은
아직 없다.

### 3-3. GET /api/auth/me

Body 없음. Authorization은 `Bearer {{accessToken}}`.

**200 OK** — `signup` 응답과 같은 `UserResponse` 형태. 단 `lastLoginAt`이 채워져 있다.

토큰 없이 부르면 **401**:

```json
{"code":"UNAUTHORIZED","message":"인증이 필요합니다"}
```

이 401은 `GlobalExceptionHandler`가 아니라 `SecurityConfig`의 `AuthenticationEntryPoint`가
만든다. 필터 단계에서 잘리므로 컨트롤러까지 오지 않는다. 만료·서명 오류·형식 오류가 전부
같은 문구로 나오는 것도 의도된 동작이다.

### 3-4. POST /api/auth/refresh

Body 없음. **쿠키로만 동작한다.** Postman이 로그인 응답의 `axp_refresh`를 쿠키 저장소에
넣어 두었다가 자동으로 실어 보낸다.

**200 OK** — `login`과 동일한 형태의 응답 + 새 `Set-Cookie`.

핵심은 **회전(rotation)**이다. 이 호출 한 번으로 기존 refresh는 그 자리에서 폐기되고
새 것이 발급된다. 만료 시각은 이어받으므로, 계속 재발급해도 14일이 무한정 늘어나지 않는다.

### 3-5. POST /api/auth/logout

Body 없음.

**204 No Content** + 쿠키 삭제 헤더:

```
Set-Cookie: axp_refresh=; Path=/api/auth; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; ...
```

쿠키가 없거나 이미 폐기된 상태로 불러도 **204**다. 200/404로 갈리면 "이 토큰이 존재한다"는
정보가 새기 때문에 일부러 구분하지 않는다.

로그아웃 뒤에도 이미 발급된 access 토큰은 최대 15분간 `/me`를 통과한다. 이건 버그가 아니라
JWT를 쓰기로 한 대가다. 요청마다 DB를 보지 않는 대신 access 수명을 짧게 잡았다.

---

## 4. 쿠키 관련 주의사항 — 여기서 대부분 막힌다

### 4-1. `Secure` 플래그

`app.auth.refresh-cookie-secure`의 기본값이 `true`라서, 로컬 HTTP에서도 쿠키에 `Secure`가
붙는다. 클라이언트에 따라 이 쿠키를 `http://`로 되돌려 보내지 않는다.

`refresh` / `logout`이 계속 401·무반응이면 `.env`에 아래를 넣고 재시작한다.

```
AUTH_COOKIE_SECURE=false
```

로컬 전용이다. 배포 환경에는 절대 넣지 않는다.

### 4-2. `Path=/api/auth`

쿠키 경로가 `/api/auth`로 좁혀져 있다. `/api/auth/*` 요청에만 딸려 가고 다른 API에는
가지 않는다. 의도된 설계이므로, 나중에 다른 경로에서 refresh 쿠키가 안 보인다고 이걸
넓히지 않는다.

### 4-3. Postman 쿠키 저장소 보는 법

요청 화면의 **Cookies**(Send 버튼 아래) → `localhost` 도메인에 `axp_refresh`가 있는지 본다.
시나리오를 처음부터 다시 돌릴 때는 여기서 지우고 시작한다.

응답 헤더 원문은 **Postman Console**(`Ctrl+Alt+C`)에서 본다. Set-Cookie 전체가 그대로 찍힌다.

### 4-4. HttpOnly

`axp_refresh`는 HttpOnly라 스크립트로 값을 읽을 수 없다. Postman의 `pm.cookies.get()`으로도
안 잡히는 게 정상이다. 값을 꺼내 쓸 일이 없도록 설계된 것이라, 테스트에서도 꺼내려 하지 않는다.

---

## 5. 실험 시나리오

### 시나리오 A — 정상 흐름 (happy path)

| 순서 | 요청 | 기대 |
|---|---|---|
| 1 | signup | 201, `lastLoginAt: null` |
| 2 | login | 200, `next=SELECT_WORKSPACE`, `Set-Cookie` 있음 |
| 3 | me | 200, `lastLoginAt` 채워짐 |
| 4 | refresh | 200, **새** accessToken, **새** Set-Cookie |
| 5 | me (새 토큰) | 200 |
| 6 | logout | 204, `Max-Age=0` 쿠키 |
| 7 | refresh | 401 `세션이 만료되었습니다...` |

### 시나리오 B — 실패 응답 (실제 확인값)

| 요청 | 조작 | 결과 |
|---|---|---|
| signup | `{"email":"not-an-email","password":"short","name":""}` | **400** `VALIDATION_FAILED` + `fields` 3개 |
| signup | 같은 이메일 재요청 | **409** `EMAIL_ALREADY_USED` |
| login | 비밀번호 틀림 | **401** `이메일 또는 비밀번호가 올바르지 않습니다` |
| login | **없는 이메일** | **401** — 위와 **완전히 같은 응답** |
| me | Authorization 헤더 없음 | **401** `인증이 필요합니다` |
| me | 토큰 뒤에 한 글자 추가 | **401** — 같은 응답 |
| signup | Body를 깨진 JSON으로 | **400** `MALFORMED_REQUEST` |

400 검증 실패 응답:

```json
{
  "code": "VALIDATION_FAILED",
  "message": "입력값을 확인해 주세요",
  "fields": {
    "password": "비밀번호는 영문·숫자·특수문자를 모두 포함한 8~16자여야 합니다",
    "email": "이메일 형식이 아닙니다",
    "name": "이름은 필수입니다"
  }
}
```

**"없는 이메일"과 "틀린 비밀번호"가 구분되면 그건 버그다.** 구분되는 순간 이 API가
가입 여부 조회기가 된다. 시나리오 B에서 이 두 줄은 반드시 같이 돌린다.

### 시나리오 C — refresh 회전 및 재사용 탐지

가장 확인 가치가 높은 동작이다. Postman은 쿠키를 자동으로 덮어써서 "옛 토큰"을 보관하지
않으므로, 이 시나리오만 curl로 하는 편이 쉽다.

```bash
# 1. 로그인 — 쿠키를 파일에 저장
curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"postman.test@axcore.ai.kr","password":"Test1234!@","rememberMe":true}' \
  -c cookies.txt

# 2. 재발급 — 성공. 이 순간 cookies.txt 안의 토큰은 폐기된다.
#    -c 를 주지 않았으므로 파일은 옛 토큰 그대로 남는다.
curl -s -X POST http://localhost:8080/api/auth/refresh -b cookies.txt

# 3. 같은 옛 토큰으로 다시 재발급 → 재사용으로 판정
curl -s -X POST http://localhost:8080/api/auth/refresh -b cookies.txt
```

3번은 **401** `세션이 만료되었습니다. 다시 로그인해 주세요`가 나오고,
서버 로그에 다음이 남는다.

```
WARN  RefreshTokenService : refresh 토큰 재사용 감지 — 사용자 {id} 의 세션 N개를 폐기했다
```

이때 **그 사용자의 모든 세션이 끊긴다.** 다른 탭에서 로그인해 둔 것까지 전부 무효가 되므로,
이 시나리오를 돌린 뒤에는 반드시 다시 로그인해야 한다. 사본이 도는 상황에서 어느 쪽이 진짜인지
가릴 수 없으니 전부 끊는 것이 의도된 동작이다.

DB에서 직접 확인하려면:

```sql
SELECT id, rotated_to, revoked_at, remember_me, expires_at
FROM shared.user_sessions
WHERE user_id = '<로그인한 사용자 UUID>'
ORDER BY created_at;
```

- `rotated_to`가 채워진 행 = 회전으로 대체된 행
- `revoked_at`만 있고 `rotated_to`가 비어 있음 = 로그아웃/강제 폐기
- `token_hash`는 SHA-256 hex 64자. 원문은 **어디에도 저장되지 않는다.**

### 시나리오 D — access 만료

`app.jwt.access-token-ttl`이 15분이라 그대로 기다리기는 길다. 확인할 일이 있으면
`application.properties`에서 임시로 `30s`로 줄이고 재시작한 뒤,

1. login → 2. me (200) → 3. 30초 대기 → 4. me (**401**) → 5. refresh (200) → 6. me (200)

확인이 끝나면 `15m`으로 되돌린다.

---

## 6. Postman Tests 스크립트

토큰 복사·붙여넣기를 없애고, 지켜야 할 성질을 자동 검증한다.

### login 요청의 **Scripts → Post-response** 탭

```javascript
const body = pm.response.json();

pm.test("200", () => pm.response.to.have.status(200));
pm.test("accessToken 발급", () => pm.expect(body.accessToken).to.be.a("string"));
pm.test("refreshToken 은 본문에 없다", () => {
    pm.expect(body).to.not.have.property("refreshToken");
    pm.expect(JSON.stringify(body)).to.not.include("refresh");
});
pm.test("refresh 쿠키가 내려온다", () =>
    pm.expect(pm.response.headers.get("Set-Cookie")).to.include("axp_refresh"));

pm.environment.set("accessToken", body.accessToken);
```

마지막 줄 덕분에 `me`는 아무 조작 없이 최신 토큰을 쓴다. **refresh 요청에도 같은 스크립트를
붙인다** — 회전된 새 토큰으로 갱신된다.

### me 요청

```javascript
const body = pm.response.json();
pm.test("200", () => pm.response.to.have.status(200));
pm.test("비밀번호 해시가 새지 않는다", () => {
    pm.expect(body).to.not.have.property("passwordHash");
    pm.expect(body).to.not.have.property("password");
});
```

### signup 요청

```javascript
pm.test("201", () => pm.response.to.have.status(201));
pm.test("이메일은 소문자로 정규화된다", () => {
    const email = pm.response.json().email;
    pm.expect(email).to.equal(email.toLowerCase());
});
```

### 컬렉션 통째로 돌리기

컬렉션 우측 `...` → **Run collection**. 위 순서(signup → login → me → refresh → logout)로
한 번에 돈다. 두 번째 실행부터는 signup이 409로 실패하므로, 매번 새 계정으로 돌리려면
컬렉션 **Pre-request** 탭에 넣는다.

```javascript
// 실행마다 다른 이메일을 만들어 signup 409 를 피한다.
pm.environment.set("testEmail", `pm-${Date.now()}@axcore.ai.kr`);
```

단, 이러면 실행할 때마다 계정이 쌓인다. 주기적으로 정리한다.

```sql
DELETE FROM shared.user_sessions
WHERE user_id IN (SELECT id FROM shared.users WHERE email LIKE 'pm-%@axcore.ai.kr');
DELETE FROM shared.users WHERE email LIKE 'pm-%@axcore.ai.kr';
```

`user_sessions`를 먼저 지워야 한다. `fk_user_sessions_user` 때문이다.

---

## 7. 트러블슈팅

| 증상 | 원인 | 조치 |
|---|---|---|
| `ECONNREFUSED localhost:8080` | 앱이 안 떠 있음 | 부팅 로그 확인 |
| URL에 `{{baseUrl}}`이 그대로 | 환경 미선택 | 우측 상단에서 `axpoint-local` 선택 |
| signup이 계속 **409** | 이미 가입된 이메일 | 다른 이메일 또는 위 정리 SQL |
| signup이 **400** `VALIDATION_FAILED` | 비밀번호 규칙 | 영문+숫자+특수문자 8~16자 |
| Body를 넣었는데 **400** `MALFORMED_REQUEST` | raw가 `Text`로 되어 있음 | Body → raw → **JSON** |
| me가 **401** | 토큰 미설정/만료 | login 다시 실행 (Post-response 스크립트가 갱신) |
| refresh가 **401**, 로그인 직후인데도 | 쿠키 `Secure` 또는 저장소 오염 | `.env`에 `AUTH_COOKIE_SECURE=false`, Cookies에서 `axp_refresh` 삭제 후 재로그인 |
| 갑자기 모든 세션이 401 | 재사용 탐지 발동 | 정상 동작. 다시 로그인 |
| 응답이 500이고 `/error`로 감 | 핸들러 밖 예외 | 서버 콘솔 스택트레이스 확인 |

---

## 8. 아직 없는 것

테스트하다 "왜 없지" 싶을 항목들이다. 전부 미구현이며 버그가 아니다.

- **이메일 소유 확인** — `signup`이 즉시 계정을 만든다. 남의 주소로도 가입된다.
  외부에 열기 전에 반드시 채워야 한다. (`AuthService#signUp` 주석)
- **2단계 인증** — `LoginResponse.next`에 `MFA_REQUIRED` 값만 정의돼 있고 경로가 없다.
- **회사(workspace) 선택** — 그래서 `next`가 항상 `SELECT_WORKSPACE`다.
- **비밀번호 재설정 / 변경**, **세션 목록 조회 및 개별 로그아웃** — 엔드포인트 없음.
- **권한(role) 클레임** — access 토큰에 넣지 않는다. 권한 모델이 확정되지 않았고,
  넣는 순간 권한 회수가 access TTL만큼 늦어진다.
