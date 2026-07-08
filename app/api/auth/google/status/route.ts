import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isGoogleConfigured } from "@/lib/google";

/**
 * Google 연동 상태 조회/해제 — 토큰 값은 절대 응답에 담지 않고 존재 여부만 알려준다.
 * 커넥터 팝업·설정 화면이 실제 연결 상태를 표시하는 데 사용한다.
 */
export async function GET() {
  const cookieStore = await cookies();
  const connected =
    !!cookieStore.get("google_refresh_token")?.value || !!cookieStore.get("google_access_token")?.value;
  return NextResponse.json({ configured: isGoogleConfigured(), connected });
}

/** 연결 해제 — 저장된 토큰 쿠키를 삭제한다 */
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("google_access_token");
  cookieStore.delete("google_refresh_token");
  return NextResponse.json({ ok: true });
}
