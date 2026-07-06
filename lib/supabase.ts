/**
 * Supabase 연동 스캐폴딩
 *
 * 사용 준비:
 *  1. `.env.example`을 `.env.local`로 복사하고 SUPABASE 키 3종을 채운다.
 *  2. 본격 연동 시 SDK 설치: `npm i @supabase/supabase-js`
 *     설치 후 아래 fetch 헬퍼 대신 createClient로 교체:
 *
 *     import { createClient } from "@supabase/supabase-js";
 *     export const supabase = createClient(
 *       process.env.NEXT_PUBLIC_SUPABASE_URL!,
 *       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
 *     );
 *
 * 주의: SUPABASE_SERVICE_ROLE_KEY는 서버(route handler)에서만 사용한다.
 *       NEXT_PUBLIC_ 접두사를 붙이거나 클라이언트 코드로 가져오면 안 된다.
 */

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!url && !url.includes("YOUR_PROJECT_REF");
}

/** SDK 설치 전 임시 REST 헬퍼 — `from("table")` 조회만 지원 (PostgREST) */
export async function supabaseSelect<T>(table: string, query = "select=*"): Promise<T[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!isSupabaseConfigured() || !url || !anonKey) {
    throw new Error("Supabase 환경 변수가 설정되지 않았습니다. .env.local을 확인하세요.");
  }
  const res = await fetch(`${url}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase 조회 오류: ${res.status}`);
  return (await res.json()) as T[];
}
