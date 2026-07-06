/**
 * Google OAuth (Gmail · Google Calendar) 연동 스캐폴딩 (서버 전용)
 *
 * 사용 준비:
 *  1. Google Cloud Console에서 OAuth 클라이언트 생성 (웹 애플리케이션)
 *  2. 승인된 리디렉션 URI에 GOOGLE_REDIRECT_URI 값을 등록
 *  3. `.env.local`에 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI 입력
 *
 * 플로우: buildGoogleAuthUrl()로 사용자를 동의 화면으로 보내고,
 * 콜백(route handler)에서 exchangeCodeForTokens()로 토큰을 교환한다.
 * 토큰 저장은 Supabase 연동 후 테이블에 두는 것을 권장 (lib/supabase.ts 참고).
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/** 데모에서 사용할 스코프 — Gmail 읽기/발송, Calendar 일정 관리 */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
];

export function isGoogleConfigured(): boolean {
  const id = process.env.GOOGLE_CLIENT_ID;
  return !!id && !id.startsWith("YOUR_GOOGLE_CLIENT_ID");
}

/** 사용자 동의 화면 URL 생성 */
export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? "",
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/** 콜백에서 받은 code를 액세스/리프레시 토큰으로 교환 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  if (!isGoogleConfigured()) {
    throw new Error("Google OAuth 환경 변수가 설정되지 않았습니다. .env.local을 확인하세요.");
  }
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? "",
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google 토큰 교환 오류: ${res.status}`);
  return res.json();
}

/** 만료된 액세스 토큰을 리프레시 토큰으로 재발급 */
export async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google 토큰 갱신 오류: ${res.status}`);
  return res.json();
}

export interface GoogleCalendarEvent {
  summary: string;
  /** ISO datetime, 또는 종일 일정이면 YYYY-MM-DD */
  start: string;
  end?: string;
  location?: string;
}

const CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/** 이번 주 예정된 일정 실시간 조회 (Google Calendar API) */
export async function listUpcomingEvents(accessToken: string, maxResults = 8): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: new Date().toISOString(),
    maxResults: String(maxResults),
    singleEvents: "true",
    orderBy: "startTime",
  });
  const res = await fetch(`${CALENDAR_EVENTS_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google Calendar 조회 오류: ${res.status}`);
  const data = (await res.json()) as {
    items?: Array<{
      summary?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      location?: string;
    }>;
  };
  return (data.items ?? []).map((e) => ({
    summary: e.summary ?? "(제목 없음)",
    start: e.start?.dateTime ?? e.start?.date ?? "",
    end: e.end?.dateTime ?? e.end?.date,
    location: e.location,
  }));
}
