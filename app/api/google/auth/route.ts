import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildGoogleAuthUrl, isGoogleConfigured } from "@/lib/google";

/**
 * Google OAuth 동의 화면으로 리다이렉트한다.
 * CSRF 방지용 state를 짧게 사는 httpOnly 쿠키에 저장하고, 콜백에서 대조한다.
 */
export async function GET() {
  if (!isGoogleConfigured()) {
    return NextResponse.json({ error: "Google OAuth 환경 변수가 설정되지 않았습니다." }, { status: 501 });
  }
  const state = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 300,
    path: "/",
  });
  return NextResponse.redirect(buildGoogleAuthUrl(state));
}
