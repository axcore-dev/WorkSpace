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

/** 데모에서 사용할 스코프 — Gmail 읽기/발송, Calendar 일정 관리 + 캘린더 목록 조회(공유 캘린더 포함) */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
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
  /** 일정이 속한 캘린더 이름 (공유·팀 캘린더 구분용) */
  calendar?: string;
}

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

interface RawEvent {
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
}

async function fetchCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<RawEvent[]> {
  const params = new URLSearchParams({ timeMin, timeMax, maxResults: "20", singleEvents: "true", orderBy: "startTime" });
  const res = await fetch(`${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google Calendar 조회 오류: ${res.status}`);
  const data = (await res.json()) as { items?: RawEvent[] };
  return data.items ?? [];
}

/**
 * 오늘(00:00)부터 일주일간의 일정 실시간 조회 (Google Calendar API).
 * - timeMin을 '지금'이 아닌 '오늘 0시'로 잡는다 — Google은 timeMin 이전에 끝난 일정을
 *   제외하므로, '지금'으로 잡으면 오늘 이미 지난 일정이 전부 빠져 "오늘 일정 없음"으로 오답한다.
 * - 회사 계정은 일정이 팀/공유 캘린더에 있는 경우가 많아 calendarList의 표시 중인 캘린더를
 *   모두 조회한다. (calendar.readonly 스코프가 없는 구 토큰이면 primary만 폴백)
 */
export async function listUpcomingEvents(accessToken: string, maxResults = 20): Promise<GoogleCalendarEvent[]> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const timeMin = startOfToday.toISOString();
  const timeMax = new Date(startOfToday.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString();

  let calendars: { id: string; name?: string }[] = [{ id: "primary" }];
  try {
    const res = await fetch(`${CALENDAR_API_BASE}/users/me/calendarList`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        items?: Array<{ id?: string; summary?: string; summaryOverride?: string; selected?: boolean }>;
      };
      const visible = (data.items ?? [])
        .filter((c) => c.id && c.selected !== false)
        .slice(0, 10)
        .map((c) => ({ id: c.id!, name: c.summaryOverride ?? c.summary }));
      if (visible.length > 0) calendars = visible;
    }
  } catch {
    // 목록 조회 실패(스코프 부족 등) — primary만 조회
  }

  const settled = await Promise.allSettled(
    calendars.map(async (c) => {
      const items = await fetchCalendarEvents(accessToken, c.id, timeMin, timeMax);
      return items.map((e): GoogleCalendarEvent => ({
        summary: e.summary ?? "(제목 없음)",
        start: e.start?.dateTime ?? e.start?.date ?? "",
        end: e.end?.dateTime ?? e.end?.date,
        location: e.location,
        calendar: c.name,
      }));
    }),
  );
  const ok = settled.filter((s): s is PromiseFulfilledResult<GoogleCalendarEvent[]> => s.status === "fulfilled");
  // 전부 실패했을 때만 오류 — '빈 일정'과 '조회 실패'를 구분한다
  if (ok.length === 0) {
    throw settled.find((s): s is PromiseRejectedResult => s.status === "rejected")?.reason ?? new Error("Google Calendar 조회 오류");
  }
  return ok
    .flatMap((s) => s.value)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, maxResults);
}
