/**
 * 「데모 체험하기」 로그인.
 *
 * 화면은 이 파일의 `DEMO_ENABLED` 와 `demoLogin()` 두 개만 안다. 자격은 **브라우저에 없다** —
 * BE 가 자기 환경 변수(`DEMO_LOGIN_EMAIL` · `DEMO_LOGIN_PASSWORD`)로 계정을 고른다(#92).
 *
 * ```
 * POST /api/auth/demo-login
 *   요청  { "rememberMe": true }
 *   응답  200  `POST /api/auth/login` 과 같은 본문과 같은 refresh 쿠키. 화면이 분기를 그대로 쓴다
 *         404  이 배포에 데모 계정이 설정되지 않았다 = 기능이 꺼져 있다
 *         409  데모 계정에 2단계가 켜져 있다 — 시드 밖에서 손댄 것. BE 가 등록 자체를 막는다
 * ```
 *
 * 설계 배경과 대안 비교는 이슈 #84 · #92.
 */
import { apiPost } from "@/lib/api";

/**
 * 버튼을 보일지 — 자격이 아니라 이 플래그가 가른다. 비밀이 아니므로 번들에 실려도 된다.
 *
 * `NEXT_PUBLIC_*` 는 런타임이 아니라 **이미지 빌드 시점**에 번들에 박힌다. 컨테이너에
 * 환경 변수를 넣어도 소용없고, `FE/Dockerfile` 의 ARG → `INFRA/docker-compose.yml` 의
 * build.args → 배포 `.env` 세 곳이 다 이어져 있어야 값이 도달한다.
 */
export const DEMO_ENABLED = process.env.NEXT_PUBLIC_DEMO_ENABLED === "1";

/**
 * 시연 계정으로 로그인한다. 응답은 일반 로그인과 같은 형태라 화면이 같은 분기를 쓴다.
 * 반환 타입은 호출부가 정한다 — 여기서 아는 것은 「어디로 보내는가」뿐이다.
 */
export function demoLogin<T>(): Promise<T | null> {
  return apiPost<T>("/api/auth/demo-login", { rememberMe: true });
}
