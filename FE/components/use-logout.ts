"use client";

import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import { clearSession } from "@/lib/session";

/**
 * 로그아웃 뒷정리 — 세 곳이 공유한다 (앱 셸 · 워크스페이스 선택 · 초대 수락의 계정 전환).
 * 끝나고 어디로 갈지는 부르는 쪽이 정한다.
 *
 * **세 가지를 다 해야 로그아웃이다.**
 *
 * 1. `clearSession()` — 메모리의 access 토큰. `lib/session.ts`의 모듈 변수라 SPA 이동으로는
 *    사라지지 않는다. 안 지우면 같은 탭에서 인증된 요청이 계속 나간다.
 * 2. `localStorage` — 화면이 읽는 사용자 표시값.
 * 3. `POST /api/auth/logout` — refresh 쿠키를 `Max-Age=0`으로 무효화한다. **안 지우면
 *    `/api/auth/refresh` 한 번으로 access 토큰을 되찾을 수 있다.** 로그아웃이 로그아웃이
 *    아니게 되고, 공용 단말에서는 다음 사람이 세션을 되살릴 수 있다.
 *
 * 서버 호출이 실패해도 삼키고 진행한다. 로컬 흔적은 이미 지웠고 남은 쿠키는 다음 로그인의
 * 세션 회전에서 무효가 된다 — 여기서 막으면 사용자가 로그아웃하지 못한 채 갇힌다.
 */
export async function endSession(): Promise<void> {
  clearSession();
  try {
    localStorage.removeItem("axpoint-user");
  } catch {
    /* 사생활 보호 모드에서는 접근 자체가 예외를 던진다 */
  }
  await apiPost("/api/auth/logout").catch(() => undefined);
}

/** 로그아웃하고 로그인 화면으로 — 앱 셸과 워크스페이스 선택 화면이 쓴다. */
export function useLogout(): () => Promise<void> {
  const router = useRouter();

  return async function logout() {
    await endSession();
    router.push("/login");
  };
}
