import Link from "next/link";
import { Logo } from "@/components/logo";
import { DEMO_ADMIN } from "@/data/org";

/**
 * 내부 관리자(AXCORE 운영) 콘솔 레이아웃 — 고객 앱(AppShell)과 크롬을 분리한다.
 *
 * 접근 제어: 이 화면은 내부 전용이지만 여기 표시는 **보안 경계가 아니다.**
 * 실제 차단은 BE 세션의 내부 역할 검사(+ Next 미들웨어)에서 해야 한다.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-3 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Logo height={17} />
            <span className="rounded border border-slate-300 px-1.5 py-px text-[10px] font-semibold tracking-wide text-slate-500">
              내부 관리자
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-500 sm:inline">{DEMO_ADMIN.email}</span>
            <Link
              href="/login"
              className="text-xs font-medium text-slate-500 transition-colors duration-150 hover:text-slate-800"
            >
              로그아웃
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8 lg:px-8">{children}</main>
    </div>
  );
}
