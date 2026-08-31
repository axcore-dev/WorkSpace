import Link from "next/link";
import { Logo } from "@/components/logo";
import { AdminNav } from "@/components/admin/admin-nav";
import { ADMIN_OPERATOR } from "@/data/admin";
import { DEMO_ADMIN } from "@/data/org";

/**
 * 내부 관리자(AXCORE 운영) 콘솔 레이아웃 — 고객 앱(AppShell)과 크롬을 분리한다.
 *
 * 좌측 내비 + 넓은 본문. 고객 앱의 사이드바를 재사용하지 않는 이유는 메뉴·권한·데이터가
 * 전혀 다르기 때문이다. 운영자 계정 관리 메뉴는 두지 않는다 — 지금은 모든 운영자가 같은 권한이다.
 *
 * 접근 제어: 이 화면은 내부 전용이지만 여기 표시는 **보안 경계가 아니다.**
 * 실제 차단은 BE 세션의 내부 역할 검사(+ Next 미들웨어)에서 해야 한다.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="flex flex-col border-b border-slate-200 bg-white lg:w-56 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
          <Logo height={17} />
          <span className="rounded border border-slate-300 px-1.5 py-px text-[10px] font-semibold tracking-wide text-slate-500">
            운영자
          </span>
        </div>

        <AdminNav />

        <div className="mt-auto border-t border-slate-100 px-5 py-4 text-xs leading-relaxed text-slate-500">
          <p className="font-medium text-slate-700">
            {ADMIN_OPERATOR.team} {ADMIN_OPERATOR.name}
          </p>
          <p className="mt-0.5">{DEMO_ADMIN.email}</p>
          <p className="mt-1.5 text-slate-400">권한 · {ADMIN_OPERATOR.scope}</p>
          <Link
            href="/login"
            className="mt-2 inline-block font-medium text-slate-500 transition-colors duration-150 hover:text-slate-800"
          >
            로그아웃
          </Link>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-6 py-7 lg:px-8">{children}</main>
    </div>
  );
}
