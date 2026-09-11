/**
 * 「데모 체험하기」 로그인 — **BE 실연동으로 넘길 지점.**
 *
 * 화면은 이 파일의 `DEMO_ENABLED` 와 `demoLogin()` 두 개만 안다. 자격이 어디서 오는지,
 * 어느 엔드포인트를 부르는지는 전부 여기 갇혀 있다.
 *
 * ## 지금 (임시)
 *
 * 브라우저가 환경 변수로 받은 시연 계정 자격으로 평범한 로그인을 한다.
 * `NEXT_PUBLIC_` 이라 **자격이 번들에 실리고 누구나 읽을 수 있다.** 그래서 이 계정은
 *
 * - 시연 전용 워크스페이스의 소유자여야 하고,
 * - 다른 곳에서 쓰는 비밀번호를 두면 안 되며,
 * - 운영 데이터에 닿으면 안 된다.
 *
 * 아래 BE 경로로 옮기기 전까지의 한시 조치다. 이 상태로 길게 두지 않는다.
 *
 * ## 나중 (목표) — BE 작업
 *
 * BE 가 아래 엔드포인트를 내면 **이 파일에서만** 세 가지를 한다:
 *
 * 1. `demoLogin()` 본문을 주석 처리된 한 줄로 바꾼다
 * 2. `EMAIL` · `PASSWORD` 상수를 지운다
 * 3. `NEXT_PUBLIC_DEMO_EMAIL` · `NEXT_PUBLIC_DEMO_PASSWORD` 를 Dockerfile · compose ·
 *    배포 `.env` 에서 뺀다 (`NEXT_PUBLIC_DEMO_ENABLED` 는 그대로 쓴다)
 *
 * 화면(`app/(auth)/login/page.tsx`)과 노출 플래그는 건드리지 않는다.
 *
 * ```
 * POST /api/auth/demo-login
 *   요청  { "rememberMe": true }
 *         자격을 보내지 않는다 — 서버가 자기 환경 변수(예: DEMO_LOGIN_EMAIL ·
 *         DEMO_LOGIN_PASSWORD)로 계정을 고른다. 브라우저는 계정을 알 필요가 없다.
 *   응답  200  `POST /api/auth/login` 과 같은 본문(accessToken · accessTokenExpiresAt ·
 *              next)과 같은 refresh 쿠키(Set-Cookie). 화면이 분기를 그대로 쓴다
 *         404  이 배포에 데모 계정이 설정되지 않았다 = 기능이 꺼져 있다
 *   비고  시연 계정에는 2단계(MFA)를 걸지 않는다. 걸면 코드를 받을 사람이 없다
 * ```
 *
 * 설계 배경과 대안 비교는 이슈 #84.
 */
import { apiPost } from "@/lib/api";

/**
 * 버튼을 보일지 — **자격이 아니라 이 플래그가 가른다.**
 *
 * 자격 유무로 가르면 BE 로 옮기는 순간(자격이 브라우저에서 사라진다) 버튼이 같이 사라진다.
 * 플래그는 비밀이 아니므로 번들에 실려도 되고, 옮긴 뒤에도 그대로 쓴다.
 *
 * `NEXT_PUBLIC_*` 는 런타임이 아니라 **이미지 빌드 시점**에 번들에 박힌다. 컨테이너에
 * 환경 변수를 넣어도 소용없고, `FE/Dockerfile` 의 ARG → `INFRA/docker-compose.yml` 의
 * build.args → 배포 `.env` 세 곳이 다 이어져 있어야 값이 도달한다.
 */
export const DEMO_ENABLED = process.env.NEXT_PUBLIC_DEMO_ENABLED === "1";

const EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL ?? "";
const PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "";

/**
 * 시연 계정으로 로그인한다. 응답은 일반 로그인과 같은 형태라 화면이 같은 분기를 쓴다.
 *
 * 반환 타입을 호출부가 정한다 — 이 파일이 로그인 응답 타입을 소유하면 BE 로 옮길 때
 * 함께 움직여야 할 것이 늘어난다. 여기서 아는 것은 「자격을 어떻게 구해 어디로 보내는가」뿐이다.
 */
export function demoLogin<T>(): Promise<T | null> {
  // BE 준비 후 이 한 줄로 바뀐다:
  // return apiPost<T>("/api/auth/demo-login", { rememberMe: true });
  return apiPost<T>("/api/auth/login", { email: EMAIL, password: PASSWORD, rememberMe: true });
}
