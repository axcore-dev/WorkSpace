# 계정 연결·선점 규칙

"이 이메일 주소의 주인이 누구인가" 를 정하는 규칙이다. 이메일 가입과 소셜 로그인 양쪽에
같은 규칙 하나가 적용된다.

흐름 전체는 [`social-login-flow.md`](./social-login-flow.md) 에 있다. 여기서는 판단만 다룬다.

대상 코드
- `BE/.../user/service/UnverifiedAccountReclaimer.java`
- `BE/.../user/service/SocialAccountLinker.java`
- `BE/.../user/service/AuthService.java` (`signUp`)
- `BE/.../oauth/NaverOAuthClient.java`
- `BE/src/main/resources/db/migration/shared/V6__user_delete_cascade.sql`

---

## 규칙

> **이메일 확인이 끝나지 않은 계정은 그 주소를 점유하지 않는다.**
>
> 그 주소의 소유가 증명된 새 요청이 오면 밀어낸다.
> **확인된 계정은 어떤 경우에도 밀어내지 않는다.**

판단에 쓰는 값은 `User#isEmailVerified()` 하나뿐이다. 다른 조건을 섞지 않는다.

---

## 무엇을 막는가

남의 주소로 미리 가입해 두면 그 주소의 진짜 주인이 가입할 수 없게 된다(`ux_users_email`).

**탈취는 아니다.** 확인되지 않은 계정은 `SessionIssuer#nextStep` 이 회사 선택 앞에서 막기
때문에 회사 데이터에 닿지 못한다. 하지만 주인이 서비스를 쓰지 못하게 만드는 것만으로 충분히
문제다.

선점 경로가 둘이고, 규칙 하나로 둘 다 닫힌다.

| 경로 | 어떻게 |
| --- | --- |
| **이메일 가입** | 남의 주소로 `POST /api/auth/signup` → 미확인 계정 생성 |
| **소셜 로그인** | 제공자 계정에 남의 주소를 적어 두고 로그인 → 미확인 계정 생성 |

> 가입 폼 안에서 인증 코드를 받아 **확인 전에는 계정을 만들지 않는** 방식도 검토했다.
> 이메일 경로는 그것으로 닫히지만 **소셜 경로에는 가입 폼이 없어서** 미완료 상태를 담아 둘
> 장치를 한 벌 더 만들어야 한다. 규칙 하나로 두 경로를 닫는 쪽을 택했다.

---

## 밀어내기가 안전한 이유

**확인 메일은 언제나 그 주소의 진짜 소유자에게 간다.**

선점한 쪽은 확인을 끝낼 수 없고, 소유자가 확인을 끝내는 순간 계정이 잠겨 더는 밀리지 않는다.
즉 이 경쟁은 **항상 소유자가 이긴다.**

남는 것은 선점자가 계속 밀어내 소유자의 확인 링크를 무효로 만드는 방해뿐이다. 얻는 것이 없는
공격이고, 원래 문제(주소가 영구히 잠기는 것)보다 가볍다.

---

## 갈래

### 이메일 가입 (`AuthService#signUp`)

| 주소를 쥔 계정 | 결과 |
| --- | --- |
| 없음 | 계정 생성 + 확인 메일 |
| **확인된 계정** | `DuplicateEmailException` (409) |
| **미확인 계정** | **밀어내고** 새로 만든다 |

### 소셜 로그인 (`SocialAccountLinker#resolve`)

| 주소를 쥔 계정 | 제공자가 이메일 소유를 확인해 줬는가 | 결과 |
| --- | --- | --- |
| (이미 연결된 소셜 계정) | — | 그 계정으로 로그인. 이메일을 보지 않는다 |
| 없음 | 확인해 줌 | 계정 생성 (확인 완료 상태) |
| 없음 | 안 해 줌 | 계정 생성 + **우리가 확인 메일을 보낸다** |
| **확인된 계정** | 확인해 줌 | 그 계정에 연결 |
| **확인된 계정** | 안 해 줌 | `SocialLinkBlockedException` (409) |
| **미확인 계정** | 확인해 줌 | **밀어내고** 새로 만든다 |
| **미확인 계정** | 안 해 줌 | `SocialLinkBlockedException` (409) |

마지막 줄에서 밀어내지 않는 이유: 양쪽 다 주인이라는 증거가 없다. 여기서 밀어내면
**확인되지 않은 계정을 아무나 지울 수 있게 된다.**

---

## 밀어내기의 대가 — 비밀번호가 사라진다

미확인 계정에 제공자가 확인해 준 소셜 로그인이 들어오면, 기존 계정을 **연결하지 않고 밀어낸다.**

**왜 연결하지 않는가.** 그 계정에 남아 있는 비밀번호는 소유가 증명되지 않은 쪽이 정한 값이다.
붙이기만 하면 남의 주소로 미리 가입해 둔 사람이 그 비밀번호로 계속 들어올 수 있다 — 소셜
로그인이 계정 탈취 경로가 되는 지점이다. **이것은 이번 변경 전까지 실제로 열려 있던 경로다.**

**대가.** 정상적인 사용자도 비밀번호를 잃는다. 이메일로 가입해 두고 확인 링크를 누르기 전에
소셜로 들어온 경우다. 확인되지 않은 계정에는 회사 데이터가 딸릴 수 없어 잃는 것은 비밀번호
뿐이고, 비밀번호 재설정으로 다시 설정할 수 있다. **되돌릴 수 없는 쪽은 탈취다.**

---

## 네이버 — 이메일을 확인되지 않은 것으로 취급한다

네이버는 `email_verified` 에 해당하는 값을 주지 않는다. Google 은 준다.

네이버가 회원 이메일을 바꿀 때 인증 메일을 보내므로 실제로는 검증된 주소일 가능성이 높다.
하지만 **그것은 우리 쪽 추측이지 네이버가 API 로 한 보증이 아니다.** 추측을 근거로 기존 계정에
자동 연결하면, 그 추측이 틀린 날 계정 탈취가 된다. 그래서 확인되지 않은 것으로 둔다
(`NaverOAuthClient` 가 `emailVerified=false` 를 고정으로 넘긴다).

### 그래서 지금 이렇게 동작한다

| 상황 | Google | 네이버 |
| --- | --- | --- |
| 처음 가입 | 바로 진행 (`SELECT_WORKSPACE`) | 계정은 생기고 **우리 확인 메일**을 받는다 (`EMAIL_VERIFICATION_REQUIRED`) |
| 이미 **확인된** 이메일 계정이 있음 | 연결됨 | **409 — 붙지 않는다** |
| 이미 **미확인** 이메일 계정이 있음 | 밀어내고 새로 만듦 | **409** |
| 두 번째 로그인 이후 | 동일 | 동일 (연결된 뒤로는 이메일을 보지 않는다) |

즉 **네이버로 처음 가입하는 것은 되고, 이미 이메일로 가입한 계정에 네이버를 붙이는 것은 안
된다.** Google 과 비대칭이며, 사용자 눈에는 "구글은 되는데 네이버는 왜 안 되지" 로 보인다.

`SocialLinkBlockedException` 의 문구는 이유를 설명하지 않는다. 구분해서 알려 주면 "이 주소가
이미 가입돼 있다" 는 사실이 새어 나가기 때문이다.

---

## 아직 없는 것

이 규칙을 완성하려면 다음이 필요하다. 이번 범위에 넣지 않았다.

| 항목 | 왜 필요한가 |
| --- | --- |
| **계정 설정의 소셜 연결** | 로그인한 사용자가 직접 누르는 연결은 제공자의 이메일 확인 없이도 안전하다. 붙으면 위 네이버 409 제약이 실질적으로 사라진다. `SocialLinkBlockedException` 의 문구도 그때 함께 바꿔야 한다 |
| **미확인 계정 만료** | 선점된 계정이 시간이 지나면 저절로 사라지게 한다. 밀어내기의 보조 장치다 |
| **가입 요청 제한** | 반복 밀어내기로 확인 링크를 계속 무효화하는 방해를 막는다 |
| **중복 이메일 응답 흐리기** | `signUp` 이 `DuplicateEmailException` 을 그대로 돌려주므로 "이 주소가 가입돼 있는가" 를 지금도 알아낼 수 있다. 가입 화면에서 흔히 받아들이는 교환이지만, 바꾸려면 확인 메일 문구까지 함께 바꿔야 한다 |

---

## DB — 계정 삭제가 가능해야 한다

밀어내기는 `DELETE FROM shared.users` 다. `V6__user_delete_cascade.sql` 이 `users` 를 참조하는
외래 키 전부에 `ON DELETE CASCADE` 를 건다.

| 테이블 | 제약 |
| --- | --- |
| `user_sessions` | `fk_user_sessions_user` |
| `user_mfa_methods` | `fk_user_mfa_user` |
| `user_tokens` | `fk_user_tokens_user` |
| `mfa_challenges` | `fk_mfa_challenges_user` |
| `user_workspace_memberships` | `fk_uwm_user` |
| `user_identities` | `fk_user_identities_user` (V5 에서 이미 적용) |

애플리케이션에서 자식 행을 순서대로 지우지 않는다. `users` 를 참조하는 테이블이 늘어날 때마다
지우는 코드를 함께 고쳐야 하고, 한 곳을 빠뜨리면 삭제가 실패한다.

**주의 — `flush` 가 필요하다.** Hibernate 의 기본 실행 순서는 INSERT 가 DELETE 보다 앞이다.
같은 트랜잭션에서 밀어내고 새로 만들면 DELETE 가 나중에 나가 `ux_users_email` 위반이 된다.
`UnverifiedAccountReclaimer` 가 삭제 직후 `flush()` 를 부르는 이유다.

확인:

```sql
SELECT c.conname,
       CASE c.confdeltype WHEN 'c' THEN 'CASCADE' ELSE 'NO ACTION' END AS on_delete
FROM pg_constraint c
JOIN pg_class t     ON t.oid = c.confrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE c.contype = 'f' AND n.nspname = 'shared' AND t.relname = 'users'
ORDER BY 1;
```

여섯 개가 모두 `CASCADE` 여야 한다.
