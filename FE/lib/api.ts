/**
 * BE(Spring) API 호출 최소 유틸.
 *
 * 지금까지 FE는 `data/*`의 목업으로만 돌았고 실제 API를 부르는 곳이 없었다. 이메일 확인과
 * 비밀번호 재설정은 서버에만 있는 토큰을 검증해야 해서 목업으로 대신할 수 없어, 여기서
 * 처음으로 실제 호출 경로를 만든다.
 *
 * 베이스 URL을 환경변수로 빼는 이유: 배포하면 BE가 같은 오리진 뒤에 붙을 수도, 별도 도메인일
 * 수도 있다. 코드에 localhost를 박아 두면 그때 전부 고쳐야 한다.
 */
import { ensureAccessToken, forceRefresh } from "./session";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

/** BE의 오류 응답 형태 — `code`는 분기용, `message`는 화면에 그대로 띄울 수 있는 문구다. */
export type ApiError = {
  code: string;
  message: string;
  fields?: Record<string, string>;
};

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError,
  ) {
    super(body.message);
  }
}

/**
 * JSON POST 한 번.
 *
 * `credentials: "include"`가 필요한 이유: refresh 토큰이 HttpOnly 쿠키로 오간다. 이걸 빼면
 * 로그인·재발급 응답의 Set-Cookie가 버려진다. 대신 BE의 `app.auth.allowed-origins`에 이
 * 오리진이 정확히 들어 있어야 한다(credentials를 쓰면 와일드카드가 불가능하다).
 *
 * @returns 204처럼 본문이 없으면 null
 */
export async function apiPost<T>(path: string, body?: unknown): Promise<T | null> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  const parsed = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    // 오류 형태가 아닌 응답(프록시가 만든 HTML 등)도 같은 타입으로 감싸 화면이 분기할 수 있게 한다.
    const fallback: ApiError = { code: "UNKNOWN", message: "요청을 처리할 수 없습니다" };
    throw new ApiRequestError(res.status, (parsed as ApiError | null) ?? fallback);
  }
  return parsed as T | null;
}

/* ─────────────────────── 로그인이 필요한 요청 ─────────────────────── */

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * access 토큰을 붙여 보낸다. 401 이면 한 번만 재발급받아 다시 보낸다.
 *
 * 재시도를 한 번으로 묶는 이유: 재발급까지 성공했는데도 401 이면 토큰 문제가 아니라 권한
 * 문제다. 그 상태로 계속 돌면 무한 루프가 된다.
 *
 * 403 은 재시도하지 않는다. 인증은 됐고 권한이 없다는 뜻이라 토큰을 새로 받아도 같다.
 */
async function authed<T>(method: Method, path: string, body?: unknown): Promise<T | null> {
  const send = async (token: string | null) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${API_BASE}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let res = await send(await ensureAccessToken());
  if (res.status === 401) {
    res = await send(await forceRefresh());
  }

  const text = await res.text();
  const parsed = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const fallback: ApiError = { code: "UNKNOWN", message: "요청을 처리할 수 없습니다" };
    throw new ApiRequestError(res.status, (parsed as ApiError | null) ?? fallback);
  }
  return parsed as T | null;
}

export const apiGet = <T,>(path: string) => authed<T>("GET", path);
export const apiPostAuthed = <T,>(path: string, body?: unknown) => authed<T>("POST", path, body);
export const apiPut = <T,>(path: string, body?: unknown) => authed<T>("PUT", path, body);
export const apiDelete = <T,>(path: string) => authed<T>("DELETE", path);
