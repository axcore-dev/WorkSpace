import Link from "next/link";
import { Logo } from "@/components/logo";

/**
 * 로그인·회원가입 공통 분할 레이아웃 — 좌측 브랜드 패널은 고정, 우측 콘텐츠만 바뀐다.
 * children이 우측 폼 영역(max-w 26.5rem)에 들어간다.
 */
export function AuthSplit({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* ── 좌측 브랜드 패널 (어두운 배경) ── */}
      <div
        className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 lg:flex"
        style={{
          background:
            "linear-gradient(155deg, #0b1220 0%, #0a0f1a 45%, #05080f 100%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(520px 340px at 12% 8%, rgba(56,102,255,0.18), transparent), radial-gradient(600px 420px at 88% 100%, rgba(10,80,255,0.14), transparent)",
          }}
        />
        <Logo variant="white" height={26} className="relative self-start" />
        <div className="relative max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-400">
            AX Manufacturing Platform
          </p>
          {/* 60px가 목표치 — 좁은 패널에선 뷰포트에 비례해 줄어든다 */}
          <h1 className="mt-4 break-keep text-[clamp(2.25rem,4.1vw,3.75rem)] font-bold leading-[1.2] tracking-[-0.015em] text-white">
            모두를 위한 AI,
            <br />
            AXCORE가 만들어갑니다.
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-slate-400">
            분절된 제조 데이터를 하나의 런타임으로 통합하고, AI가 실시간으로 공정을 판단·최적화합니다.
            <br />
            프로토타입에서 양산까지, 하나의 코어 위에서.
          </p>
        </div>
        <p className="relative text-xs text-slate-500">© 2026 AXCORE</p>
      </div>

      {/* ── 우측 콘텐츠 ── */}
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-[26.5rem]">
          {/* 모바일 로고 */}
          <div className="mb-8 lg:hidden">
            <Logo height={24} />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/** 인증 화면 전용 주 액션 버튼 — 로그인·가입하기 등 폼 제출 (일반 화면은 ui.tsx Button 사용) */
export function AuthPrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="submit"
      className="w-full cursor-pointer rounded-lg bg-primary-600 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
      {...props}
    >
      {children}
    </button>
  );
}

/** 회원가입·워크스페이스·온보딩 등 카드형 인증 화면의 공통 프레임 (무채색·절제) */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <header className="mb-8 flex flex-col items-center gap-2">
        <Link href="/login" aria-label="AXCORE 홈">
          <Logo height={22} />
        </Link>
        <p className="text-xs text-slate-400">WorkSpace · AI 통합 워크스페이스</p>
      </header>
      <main className="flex w-full justify-center">{children}</main>
      <footer className="mt-10 text-xs text-slate-400">© 2026 AXCORE · WorkSpace 데모 환경</footer>
    </div>
  );
}
