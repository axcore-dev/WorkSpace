import Link from "next/link";
import { Logo } from "@/components/logo";

/** 회원가입·워크스페이스·온보딩 등 카드형 인증 화면의 공통 프레임 (무채색·절제) */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <header className="mb-8 flex flex-col items-center gap-2">
        <Link href="/login" aria-label="AXCORE 홈">
          <Logo height={22} />
        </Link>
        <p className="text-xs text-slate-400">AXpoint · AI 통합 워크스페이스</p>
      </header>
      <main className="flex w-full justify-center">{children}</main>
      <footer className="mt-10 text-xs text-slate-400">© 2026 AXCORE · AXpoint 데모 환경</footer>
    </div>
  );
}
