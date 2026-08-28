# 계정 관리 API — Postman 테스트 가이드

이메일 소유 확인 · 2단계 인증 · 비밀번호 변경/재설정 · 세션 관리 · 회사 선택.
로그인 기본 흐름(signup/login/me/refresh/logout)은 [auth-api-postman-test.md](auth-api-postman-test.md)에 있다.

아래 응답은 전부 로컬에서 실제로 호출해서 받은 값이다.

---

## 0. 먼저 알아야 할 것 — 메일은 발송되지 않는다

이메일 확인 링크와 2단계 인증 코드는 **메일로 나가지 않고 서버 콘솔에 찍힌다.**
`app.mail.mode` 기본값이 `log` 이고, 실제 발송 구현체가 아직 없다.

부팅할 때 이 경고가 뜬다.

```
WARN  LoggingMailSender : 메일이 실제로 발송되지 않는다. 확인 링크와 인증 코드가 로그에
                          그대로 남는다. 운영 환경에서는 app.mail.mode 를 바꾸고 발송
                          구현체를 등록해야 한다.
```

콘솔에는 이렇게 나온다.

```
───────────── 메일 (실제로 발송되지 않음) ─────────────
To      : acct.test@axcore.ai.kr
Subject : [AXpoint] 로그인 확인 코드

로그인 확인 코드입니다.

    413435

10분 뒤에 만료됩니다.
...
──────────────────────────────────────────────────
```

**테스트하는 동안 서버 콘솔을 옆에 띄워 두어야 한다.** 토큰과 코드를 거기서 복사한다.
`app.mail.mode` 를 `smtp` 등으로 바꾸면 `MailSender` 구현체가 없어서 부팅이 실패한다.
메일이 조용히 안 나가는 상태로 운영에 올라가는 것을 막기 위한 의도된 동작이다.

---

## 1. 엔드포인트 한눈에

| Method | Path | 인증 | 성공 |
|---|---|---|---|
| POST | `/api/auth/email/verify` | **없음** | 200 `UserResponse` |
| POST | `/api/auth/email/verify-request` | Bearer | 202 |
| POST | `/api/auth/password` | Bearer | 204 |
| POST | `/api/auth/password/reset-request` | **없음** | 202 |
| POST | `/api/auth/password/reset` | **없음** | 204 |
| GET | `/api/auth/sessions` | Bearer | 200 배열 |
| DELETE | `/api/auth/sessions/{sessionId}` | Bearer | 204 |
| GET | `/api/auth/mfa/methods` | Bearer | 200 배열 |
| POST | `/api/auth/mfa/email` | Bearer | 202 `{mfaToken}` |
| POST | `/api/auth/mfa/email/confirm` | Bearer | 204 |
| DELETE | `/api/auth/mfa/email` | Bearer | 204 |
| POST | `/api/auth/mfa/verify` | **없음** | 200 `LoginResponse` + 쿠키 |
| GET | `/api/auth/workspaces` | Bearer | 200 배열 |
| POST | `/api/auth/workspaces/{id}/select` | Bearer | 200 `LoginResponse` |

인증이 없는 넷은 이유가 있다.

- `mfa/verify` — 로그인 도중이라 access 토큰이 아직 없다. 챌린지 토큰 + 코드가 자격 증명이다.
- `email/verify`, `password/reset` — 메일 링크는 로그인하지 않은 브라우저에서 열린다.
- `password/reset-request` — 비밀번호를 잊은 사람이 쓴다.

---

## 2. `next` 가 4단계로 늘었다

`POST /api/auth/login` 응답의 `next` 는 이제 네 값을 가진다. **순서에 의미가 있다.**

| `next` | 뜻 | 화면이 할 일 |
|---|---|---|
| `MFA_REQUIRED` | 비밀번호는 맞았으나 2단계가 남음 | 코드 입력 → `mfa/verify` |
| `EMAIL_VERIFICATION_REQUIRED` | 이메일 미확인 | 확인 안내 + 재발송 버튼 |
| `SELECT_WORKSPACE` | 회사를 골라야 함 | 회사 목록 → `workspaces/{id}/select` |
| `READY` | 업무 화면 진입 가능 | — |

**`MFA_REQUIRED` 응답에는 `accessToken` 도 `user` 도 없다.** 2단계를 통과하기 전에 이름을
내보내면 비밀번호만 아는 쪽에게 계정 정보가 새어 나간다. `Set-Cookie` 도 없다.

```json
{"next":"MFA_REQUIRED","mfaToken":"8mUoCsrMUU5c_WIzOTg_Z_EE-RqARB19tO0i-dziJ3I"}
```

이메일 확인이 회사 선택보다 앞이다. 소유가 확인되지 않은 주소로 회사에 들어가면, 오타로
남의 주소를 적은 계정이 그 회사 데이터를 보게 된다.

---

## 3. 이메일 소유 확인

### 3-1. 가입하면 자동으로 발송된다

`POST /api/auth/signup` 응답에 `emailVerified` 가 추가됐다.

```json
{"id":"52c9...","email":"acct.test@axcore.ai.kr","name":"Account Tester",
 "emailVerified":false,"passwordChangedAt":"...","lastLoginAt":null,"createdAt":"..."}
```

같은 순간 콘솔에 확인 링크가 찍힌다.

```
http://localhost:3000/auth/verify-email?token=<43자>
```

`3000` 은 **FE 주소**다(`app.mail.base-url`). API 주소가 아니다 — 사용자가 여는 화면이고,
토큰을 꺼내 API 로 넘기는 것은 화면의 몫이다.

이 상태로 로그인하면 `next` 가 `EMAIL_VERIFICATION_REQUIRED` 다. **로그인 자체는 된다.**
막으면 재발송을 요청할 통로가 없어져서, 주소를 오타로 적은 사용자가 스스로 빠져나올 수 없다.

### 3-2. POST /api/auth/email/verify

링크의 `token=` 뒤 값만 복사해 본문에 넣는다.

```json
{ "token": "<43자 토큰>" }
```

**200 OK** — `emailVerified: true` 로 바뀐 `UserResponse`.

쿼리 파라미터가 아니라 본문으로 받는 이유: URL 에 실으면 브라우저 히스토리 · 프록시 로그 ·
Referer 헤더에 토큰이 남는다.

같은 토큰을 다시 넣으면 **401** `링크가 만료되었거나 이미 사용되었습니다`.
없는 토큰 · 만료 · 이미 사용 · 용도가 다른 토큰이 모두 같은 응답이다.

### 3-3. POST /api/auth/email/verify-request

Bearer 필요, 본문 없음. **202 Accepted.** 새 링크가 나가고 **이전 링크는 무효가 된다.**
끊지 않으면 재발송할수록 유효한 링크가 메일함에 쌓인다.

이미 확인된 계정이면 **409** `ACCOUNT_STATE_CONFLICT` / `이미 확인된 이메일입니다`.

---

## 4. 2단계 인증 (이메일 OTP)

TOTP 가 아니라 이메일 OTP 다. TOTP 는 검증된 라이브러리가 필요하고 새 의존성은 승인 사항이라,
발송 경로를 비밀번호 재설정과 공유하는 쪽을 먼저 붙였다. `user_mfa_methods.method` 는
`totp`/`sms`/`email`/`webauthn` 을 이미 허용하므로 수단이 늘어도 스키마는 그대로다.

### 4-1. 등록 — 두 번에 나뉜다

**`POST /api/auth/mfa/email`** (Bearer, 본문 없음) → **202**

```json
{ "mfaToken": "rCHfFKCxmdwB..." }
```

콘솔에 `[AXpoint] 2단계 인증 등록 확인` 메일과 6자리 코드가 찍힌다.
이 시점에는 **아직 켜지지 않았다.** `GET /api/auth/mfa/methods` 로 확인:

```json
[{"method":"email","enabled":false,"verifiedAt":null}]
```

등록 즉시 켜지 않는 이유는 오타 난 주소로 계정에서 잠기는 것을 막기 위해서다.

**`POST /api/auth/mfa/email/confirm`** (Bearer)

```json
{ "mfaToken": "rCHfFKCxmdwB...", "code": "329723" }
```

**204** → 이제 켜진다.

```json
[{"method":"email","enabled":true,"verifiedAt":"2026-08-28T06:06:44.364870Z"}]
```

### 4-2. 로그인 2단계

1. `POST /api/auth/login` → `{"next":"MFA_REQUIRED","mfaToken":"..."}`
2. 콘솔에서 `[AXpoint] 로그인 확인 코드` 의 6자리를 복사
3. `POST /api/auth/mfa/verify` (**인증 불필요**)

```json
{ "mfaToken": "8mUoCsrMUU5c...", "code": "413435" }
```

**200** + `Set-Cookie: axp_refresh=...` — 여기서 비로소 세션이 생긴다.

통과 조건은 **챌린지 토큰과 코드 둘 다**다. 코드만으로는 어느 챌린지인지 지목할 수 없고,
챌린지 토큰만 가로채도 코드를 모르면 통과하지 못한다.

같은 코드를 다시 쓰면 **401**. 일회용이다.

### 4-3. 시도 횟수 제한 — 반드시 확인할 것

6자리는 후보가 100만 개뿐이라 **시도 횟수 제한이 실질적인 방어선이다.** 5회로 끊긴다.

틀린 코드로 5번 호출한 뒤, **맞는 코드를 넣어도 401 이어야 한다.**

```
1: 401   2: 401   3: 401   4: 401   5: 401
서버 로그 → WARN MfaService : MFA 코드 시도 횟수 초과 — 사용자 ... 의 LOGIN 챌린지를 폐기했다
맞는 코드 → 401 인증 코드가 올바르지 않거나 만료되었습니다
```

**여기서 맞는 코드가 통과하면 버그다.** 시도 횟수 증가가 예외 롤백에 되돌아갔다는 뜻이고,
그러면 상한이 영원히 차지 않아 코드를 무제한 대입할 수 있다. 그래서 카운터는
`MfaAttemptRecorder` 의 별도 트랜잭션(`REQUIRES_NEW`)에 적힌다.

코드를 다시 보내면 앞선 챌린지는 폐기된다. 여러 개가 동시에 유효하면 챌린지를 계속 새로
만들면서 각각 5회씩 시도할 수 있어 상한이 무의미해진다.

### 4-4. 해제 — 비밀번호를 다시 묻는다

`DELETE /api/auth/mfa/email` (Bearer)

```json
{ "password": "Test1234!@" }
```

틀리면 **401**, 맞으면 **204**. access 토큰만 탈취한 쪽이 방어를 걷어내는 것을 막는다.

**해제하면 그 사용자의 모든 세션이 폐기된다.** 이 조작이 탈취된 세션에서 일어났다면, 끊지
않는 한 공격자의 세션만 살아남는다. 확인:

```
GET /api/auth/sessions → []
```

---

## 5. 비밀번호

### 5-1. POST /api/auth/password — 로그인 상태에서 변경

```json
{ "currentPassword": "Test1234!@", "newPassword": "NewPass1!@" }
```

| 입력 | 결과 |
|---|---|
| 정상 | **204** + `Set-Cookie` 삭제 헤더 |
| 현재 비밀번호 틀림 | **401** `현재 비밀번호가 올바르지 않습니다` |
| 새 비밀번호가 현재와 같음 | **409** `새 비밀번호가 현재 비밀번호와 같습니다` |
| 새 비밀번호가 규칙 위반 | **400** `VALIDATION_FAILED` |

현재 비밀번호를 다시 묻는 이유: access 토큰만 탈취한 쪽이 비밀번호를 갈아 끼워 계정을 통째로
가져가는 것을 막는다. 토큰은 15분이지만 비밀번호는 영구적이다.

**변경 후 지금 이 세션도 끊긴다.** 응답에 쿠키 삭제 헤더가 붙는 이유다 — 폐기된 refresh 를
브라우저에 남겨 두면 다음 재발급이 401 로 떨어지고 화면은 그걸 "세션 만료"로 오해한다.

콘솔에 `[AXpoint] 비밀번호가 변경되었습니다` 통지 메일이 찍힌다. 사용자가 모르는 사이에
바뀌었다면 이 메일이 유일한 신호다.

### 5-2. POST /api/auth/password/reset-request

```json
{ "email": "acct.test@axcore.ai.kr" }
```

**항상 202 다.** 가입되지 않은 주소로 보내도 202 다.

```
가입된 주소   → 202, 콘솔에 재설정 링크
없는 주소     → 202, 콘솔에는 링크 없음
             서버 로그: INFO 가입되지 않은 주소로 비밀번호 재설정 요청이 들어왔다
```

**이 두 응답이 갈리면 버그다.** 인증 없이 부를 수 있는 경로라, 응답이 다르면 그것만으로
가입 여부를 조회할 수 있다. 없는 주소는 로그에만 남긴다 — 몰려 들면 계정 목록을 훑고 있다는
신호이기 때문이다.

재설정 링크의 수명은 **30분**이다(확인 링크는 24시간). 이 토큰 한 장이면 비밀번호를 바꿀 수
있어서 access 토큰보다도 강한 권한이다.

### 5-3. POST /api/auth/password/reset

```json
{ "token": "<43자 토큰>", "newPassword": "Reset123!@" }
```

**204** + 쿠키 삭제. 현재 비밀번호를 묻지 않는다 — 잊은 사람이 쓰는 경로다.

같은 토큰 재사용은 **401**.

이 경로를 통과하면 **미확인 계정도 함께 확인 처리된다.** 메일함을 열 수 있다는 사실이 곧
소유 확인이고, 별도로 한 번 더 요구할 이유가 없다.

---

## 6. 세션 관리

### 6-1. GET /api/auth/sessions

```json
[{"id":"99c91d0d-...","userAgent":"curl/8.21.0","ip":"0:0:0:0:0:0:0:1",
  "rememberMe":true,"current":false,
  "createdAt":"2026-08-28T06:05:50.058410Z","expiresAt":"2026-09-11T06:05:50.055312Z"}]
```

- 살아 있는 세션만 나온다. 폐기·만료된 것은 제외된다.
- `current` 는 access 토큰의 `sid` 클레임과 대조해 **서버가** 채운다. 화면이 스스로 판단하려면
  토큰을 파싱해야 한다.
- 토큰 해시는 어떤 형태로도 나가지 않는다. 끊는 데 필요한 것은 id 뿐이다.

브라우저 두 개 또는 curl 로 여러 번 로그인해 두면 여러 항목이 보인다.

### 6-2. DELETE /api/auth/sessions/{sessionId}

**204.** 남의 세션 id 나 없는 id 는 **404** `SESSION_NOT_FOUND` — 두 경우를 구분하지 않는다.
구분해 주면 세션 id 의 존재 여부가 응답으로 샌다.

자기 자신을 끊는 것도 허용한다. 그 경우에만 응답에 쿠키 삭제 헤더가 붙는다.

`POST /api/auth/logout` 과의 차이: 저쪽은 **쿠키로** 지목하고 이쪽은 **id 로** 지목한다.
"다른 기기에서 로그아웃"은 그 기기의 토큰을 모르는 채로 끊어야 하는 조작이다.

---

## 7. 회사 선택

### 7-1. 테스트 데이터를 먼저 넣어야 한다

회사를 만드는 경로(프로비저닝)가 아직 없다. 테넌트 스키마 생성과 마이그레이션 순회가
함께 붙어야 하는 작업이라 이 범위 밖이다. 그래서 **SQL 로 직접 넣는다.**

```sql
-- 진입 가능한 회사
INSERT INTO shared.workspaces (biz_number, name, plan, status, created_at, updated_at)
VALUES ('1112223334', '테스트 활성회사', 'free', 'provisioning', now(), now());
UPDATE shared.workspaces SET schema_name = 'ax_' || lpad(id::text, 5, '0'), status = 'active'
 WHERE biz_number = '1112223334';

-- 정지된 회사 (막히는지 확인용)
INSERT INTO shared.workspaces (biz_number, name, plan, status, created_at, updated_at)
VALUES ('5556667778', '테스트 정지회사', 'free', 'provisioning', now(), now());
UPDATE shared.workspaces SET schema_name = 'ax_' || lpad(id::text, 5, '0'), status = 'suspended'
 WHERE biz_number = '5556667778';

-- 소속 부여
INSERT INTO shared.user_workspace_memberships (user_id, workspace_id, status, created_at, updated_at)
SELECT u.id, w.id, 'active', now(), now()
  FROM shared.users u, shared.workspaces w
 WHERE u.email = '<테스트 계정>' AND w.biz_number IN ('1112223334','5556667778');
```

`status='provisioning'` 으로 넣고 나중에 `active` 로 올리는 이유: `schema_name` 은 id 채번
뒤에야 정해지는데, CHECK 제약이 `active` 행에는 `schema_name` 을 요구한다.

Docker 로 DB 를 띄웠다면:

```bash
docker exec -i axcore-postgres psql -U workspace -d workspace < seed.sql
```

### 7-2. GET /api/auth/workspaces

```json
[{"id":2,"name":"테스트 정지회사","plan":"free","workspaceStatus":"suspended",
  "membershipStatus":"active","enterable":false},
 {"id":1,"name":"테스트 활성회사","plan":"free","workspaceStatus":"active",
  "membershipStatus":"active","enterable":true}]
```

- **들어갈 수 없는 것도 이유와 함께** 돌려준다. 화면이 "정지된 회사입니다"를 보여줄 수 있어야 한다.
- `enterable` 은 소속 상태와 회사 상태를 **모두** 반영한 결과다. 화면이 두 값을 각자 해석해
  판단이 갈리지 않도록 서버가 계산해 준다.
- `schemaName` 은 내보내지 않는다. `search_path` 에 조립되는 값이라 밖으로 돌아다니게 두지 않는다.

### 7-3. POST /api/auth/workspaces/{id}/select

**200** + `next` 가 드디어 `READY` 다.

```json
{"next":"READY","accessToken":"eyJ...","accessTokenExpiresAt":"...","user":{...}}
```

새 access 토큰의 클레임을 [jwt.io](https://jwt.io) 나 아래로 확인한다.

```bash
echo "$ACCESS_TOKEN" | cut -d. -f2 | tr '_-' '/+' | base64 -d
```

| 시점 | 클레임 |
|---|---|
| 선택 전 | `{"iss":"axpoint","sub":"...","exp":...,"iat":...,"sid":"..."}` |
| 선택 후 | `{"wsid":"1","iss":"axpoint","sub":"...","exp":...,"iat":...,"sid":"..."}` |

**`Set-Cookie` 가 없다.** refresh 를 회전시키지 않기 때문이다 — 회전은 재사용 탐지의 장치이고
상태 변경의 장치가 아니다. 그래도 `POST /api/auth/refresh` 를 하면 `next=READY` 가 유지된다.
선택은 세션 행에 남아 있다.

역할(role) 클레임은 없다. 넣는 순간 권한 회수가 access TTL 만큼 늦게 반영되고, 권한
모델(3층 교집합)은 테넌트 스키마가 생긴 뒤에야 확정된다.

### 7-4. 막히는 경우 — 전부 403

| 상황 | 메시지 |
|---|---|
| 소속이 없는 회사 | `접근할 수 없는 회사입니다` |
| 회사가 정지됨 (`suspended`) | `지금 이용할 수 없는 회사입니다` |
| 소속이 회수됨 (`left`) | `이 회사에 대한 접근 권한이 없습니다` |
| 이메일 미확인 | `이메일 확인이 필요합니다` |

**반드시 확인할 것 — 소속 회수 재확인.** 회사를 고른 뒤 DB 에서 소속을 끊고 다시 선택하면
403 이어야 한다.

```sql
UPDATE shared.user_workspace_memberships SET status='left' WHERE workspace_id=1;
```

토큰에 `wsid=1` 이 남아 있어도 막혀야 한다. 선택 시점에 매번 `user_workspace_memberships` 를
다시 보기 때문이다. 여기서 통과하면 소속이 회수된 뒤에도 회사 데이터가 열린 채로 남는다.
(docs/db/schema-draft-v2.md)

---

## 8. 통합 시나리오

한 번에 전체를 훑는 순서다.

| # | 요청 | 기대 |
|---|---|---|
| 1 | signup | 201 `emailVerified:false` + 콘솔에 확인 링크 |
| 2 | login | 200 `next=EMAIL_VERIFICATION_REQUIRED` |
| 3 | workspaces/1/select | **403** `이메일 확인이 필요합니다` |
| 4 | email/verify (콘솔 토큰) | 200 `emailVerified:true` |
| 5 | login | 200 `next=SELECT_WORKSPACE` |
| 6 | workspaces | 200, `enterable` 확인 |
| 7 | workspaces/1/select | 200 `next=READY`, 토큰에 `wsid` |
| 8 | sessions | 200, `current:true` 가 하나 |
| 9 | mfa/email → confirm | 202 → 204, `enabled:true` |
| 10 | login | 200 `next=MFA_REQUIRED`, 토큰·쿠키 없음 |
| 11 | mfa/verify (틀린 코드 5회) | 401 x5 + 서버 로그 경고 |
| 12 | mfa/verify (맞는 코드) | **401** — 챌린지 폐기됨 |
| 13 | login → mfa/verify | 200 + 쿠키 |
| 14 | mfa/email 해제 (비밀번호) | 204, sessions → `[]` |
| 15 | password (변경) | 204 + 쿠키 삭제 |
| 16 | login (옛 비밀번호) | 401 |
| 17 | password/reset-request | 202 (없는 주소도 202) |
| 18 | password/reset | 204 |
| 19 | login (재설정 비밀번호) | 200 |

---

## 9. Postman 팁

### 토큰·코드를 콘솔에서 옮기기

Postman 변수로 자동화할 수 없는 유일한 지점이다. 서버 콘솔의 값을 손으로 옮긴다.
IntelliJ 실행 창에서 `Ctrl+F` 로 `메일 (실제로 발송되지 않음)` 을 찾으면 빠르다.

터미널이면 `grep` 으로 뽑는다.

```bash
# 가장 최근 확인 링크의 토큰
grep -o "verify-email?token=[A-Za-z0-9_-]*" app.log | tail -1 | sed 's/.*token=//'

# 가장 최근 로그인 코드
grep -A3 "로그인 확인 코드" app.log | grep -oE "^ +[0-9]{6}$" | tail -1 | tr -d ' '
```

### 회사 선택 후 토큰 갱신

`workspaces/{id}/select` 의 **Post-response** 탭에 넣어 두면 이후 요청이 `wsid` 가 실린
토큰을 쓴다.

```javascript
const body = pm.response.json();
pm.test("READY", () => pm.expect(body.next).to.equal("READY"));
pm.environment.set("accessToken", body.accessToken);
```

`mfa/verify` 에도 같은 스크립트를 붙인다. 2단계를 통과한 응답이 로그인 응답과 같은 형태다.

### 회귀 검증으로 지킬 것

```javascript
// MFA_REQUIRED 응답에 토큰과 사용자 정보가 새지 않는지
const body = pm.response.json();
if (body.next === "MFA_REQUIRED") {
    pm.test("2단계 전에는 토큰이 나가지 않는다", () => {
        pm.expect(body.accessToken).to.be.undefined;
        pm.expect(body.user).to.be.undefined;
        pm.expect(pm.response.headers.get("Set-Cookie")).to.be.null;
    });
}
```

---

## 10. 테스트 계정 정리

```sql
DELETE FROM shared.mfa_challenges WHERE user_id IN
  (SELECT id FROM shared.users WHERE email LIKE '%.test@axcore.ai.kr');
DELETE FROM shared.user_tokens WHERE user_id IN
  (SELECT id FROM shared.users WHERE email LIKE '%.test@axcore.ai.kr');
DELETE FROM shared.user_mfa_methods WHERE user_id IN
  (SELECT id FROM shared.users WHERE email LIKE '%.test@axcore.ai.kr');
DELETE FROM shared.user_workspace_memberships WHERE user_id IN
  (SELECT id FROM shared.users WHERE email LIKE '%.test@axcore.ai.kr');
DELETE FROM shared.user_sessions WHERE user_id IN
  (SELECT id FROM shared.users WHERE email LIKE '%.test@axcore.ai.kr');
DELETE FROM shared.users WHERE email LIKE '%.test@axcore.ai.kr';
DELETE FROM shared.workspaces WHERE biz_number IN ('1112223334','5556667778');
```

순서를 지켜야 한다. 전부 `shared.users` 를 참조하는 FK 가 걸려 있다.
`user_sessions` 는 `rotated_to` 로 자기 자신도 참조하지만 같은 사용자 행을 한꺼번에 지우므로
문제되지 않는다.

---

## 11. 아직 없는 것

- **TOTP · SMS · WebAuthn** — `MfaMethod` 에 값은 있고 `isSupported()` 가 `email` 만 true 다.
- **실제 메일 발송** — `MailSender` 구현체. 인터페이스와 문구는 준비돼 있다.
- **회사 생성(프로비저닝)** — 스키마 생성 + 테넌트 마이그레이션 순회 + `search_path` 전환.
  이게 붙기 전까지 `wsid` 는 기록만 되고 실제로 스키마를 열지 않는다.
- **초대 수락** — `shared.invitations` 테이블은 V2 에 있고 엔드포인트가 없다. 그래서
  소속을 SQL 로 넣어야 한다.
- **권한(role) 클레임** — 테넌트 스키마의 `roles`/`members` 가 선행되어야 한다.
- **요청 빈도 제한(rate limit)** — `password/reset-request` 와 `mfa/email` 은 메일을 유발하는
  경로다. 지금은 호출 빈도를 막는 장치가 없다. 외부에 열기 전에 필요하다.
