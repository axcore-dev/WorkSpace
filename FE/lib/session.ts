/**
 * access 토큰 보관.
 *
 * **메모리에만 둔다.** localStorage 에 넣지 않는 이유는 XSS 한 번에 토큰이 통째로 넘어가기
 * 때문이다. 대신 새로고침하면 사라지는데, 그건 BE 가 refresh 토큰을 HttpOnly 쿠키로 들고
 * 있어서 `/api/auth/refresh` 한 번으로 되찾을 수 있다. JS 가 읽을 수 없는 쿠키가 재발급
 * 권한을 갖고, 짧게 사는 access 토큰만 메모리에 두는 구조다.
 *
 * BE 쪽 설계와 짝을 이룬다 — `RefreshCookieFactory` 주석 참고.
 */

let accessToken: string | null = null;
/** epoch ms. 없으면 토큰도 없다 */
let expiresAt = 0;

/**
 * 만료 얼마 전부터 미리 갱신할지.
 *
 * 0 으로 두면 "아직 안 만료됨" 을 확인하고 요청을 보내는 사이에 만료돼 401 이 난다. 30초면
 * 왕복 시간과 시계 오차를 덮는다.
 */
const RENEW_MARGIN_MS = 30_000;

/** 로그인·재발급 응답에서 토큰을 받아 둔다. */
export function setAccessToken(token: string | null, expiresAtIso?: string | null) {
  accessToken = token;
  expiresAt = token && expiresAtIso ? Date.parse(expiresAtIso) : 0;
}

export function clearSession() {
  setAccessToken(null);
}

function isUsable() {
  return accessToken !== null && Date.now() < expiresAt - RENEW_MARGIN_MS;
}

/**
 * 재발급 요청을 하나로 묶는다.
 *
 * 탭 하나에서 여러 요청이 동시에 만료된 토큰을 발견하면 각자 재발급을 부른다. BE 는 회전
 * 직후 30초의 유예 창을 두고 있어 전부 로그아웃되지는 않지만(`UserSession.ROTATION_GRACE`),
 * 불필요한 왕복이고 유예 창은 최후의 보루로 남겨 두는 편이 낫다.
 */
let inFlight: Promise<string | null> | null = null;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

async function refresh(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      clearSession();
      return null;
    }
    const body = (await res.json()) as {
      accessToken?: string | null;
      accessTokenExpiresAt?: string | null;
    };
    setAccessToken(body.accessToken ?? null, body.accessTokenExpiresAt ?? null);
    return accessToken;
  } catch {
    // 네트워크 실패는 로그아웃이 아니다. 토큰은 지우되 화면이 재시도할 수 있게 둔다.
    clearSession();
    return null;
  }
}

/**
 * 쓸 수 있는 access 토큰을 돌려준다. 필요하면 쿠키로 재발급받는다.
 *
 * @returns 재발급도 실패하면 null — 부르는 쪽이 로그인 화면으로 보내야 한다
 */
export async function ensureAccessToken(): Promise<string | null> {
  if (isUsable()) return accessToken;
  if (!inFlight) {
    inFlight = refresh().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/** 401 을 받았을 때 한 번만 강제로 다시 받아 본다. */
export async function forceRefresh(): Promise<string | null> {
  clearSession();
  return ensureAccessToken();
}
