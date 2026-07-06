import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/google";

/**
 * Google OAuth 콜백 — code를 토큰으로 교환하고 httpOnly 쿠키에 저장한다.
 * 액세스 토큰은 만료 임박 60초 전에 갱신되도록 짧게, 리프레시 토큰은 길게 유지한다.
 * 토큰은 항상 서버(쿠키)에만 두고 클라이언트 JS·응답 바디로 내려보내지 않는다.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const savedState = cookieStore.get("google_oauth_state")?.value;
  cookieStore.delete("google_oauth_state");

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL("/ai-chat?google_error=state", req.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const secure = process.env.NODE_ENV === "production";
    cookieStore.set("google_access_token", tokens.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: Math.max(60, tokens.expires_in - 60),
    });
    if (tokens.refresh_token) {
      cookieStore.set("google_refresh_token", tokens.refresh_token, {
        httpOnly: true,
        sameSite: "lax",
        secure,
        path: "/",
        maxAge: 60 * 60 * 24 * 180,
      });
    }
    return NextResponse.redirect(new URL("/ai-chat?google_connected=1", req.url));
  } catch {
    return NextResponse.redirect(new URL("/ai-chat?google_error=token", req.url));
  }
}
