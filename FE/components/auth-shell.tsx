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
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="submit"
      {...props}
      className={`w-full cursor-pointer rounded-lg bg-primary-600 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

/** Google 공식 로그인 버튼의 4색 G 로고 */
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden focusable="false" className="block shrink-0">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  );
}

/**
 * 소셜 인증 버튼 — 로그인·회원가입이 같은 모양을 쓴다. 구분선("또는")까지 포함한다.
 *
 * Google·네이버 **공식 버튼 가이드**의 색·형태를 그대로 따르므로 여기만 디자인 토큰을 쓰지 않는다
 * (DESIGN.md 예외). `action`은 라벨에만 들어간다 — "Google 계정으로 로그인" / "…회원가입".
 */
export function SocialAuthButtons({ action, onSelect }: { action: string; onSelect: () => void }) {
  return (
    <>
      <div className="mt-8 flex items-center gap-4">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs text-slate-400">또는</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="mt-5 space-y-3">
        <button
          type="button"
          onClick={onSelect}
          aria-label={`Google 계정으로 ${action}`}
          className="flex h-10 w-full cursor-pointer items-center justify-center gap-2.5 rounded border border-[#747775] bg-white px-3 transition-[background-color,box-shadow] duration-150 hover:bg-[#f7f8f8] hover:shadow-[0_1px_2px_rgba(60,64,67,.3),0_1px_3px_1px_rgba(60,64,67,.15)] active:bg-[#eeeeee]"
        >
          <GoogleG />
          <span className="whitespace-nowrap text-sm font-medium leading-5 text-[#1f1f1f]">
            Google 계정으로 {action}
          </span>
        </button>
        <button
          type="button"
          onClick={onSelect}
          aria-label={`네이버 아이디로 ${action}`}
          className="flex h-10 w-full cursor-pointer items-center justify-center gap-2.5 rounded bg-[#03c75a] px-3 transition-colors duration-150 hover:bg-[#02b350] active:bg-[#02a94b]"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden focusable="false" className="block shrink-0">
            <path d="M3 4h6.6l4.9 7.9V4H21v16h-6.6L9.5 12v8H3z" fill="#fff" />
          </svg>
          <span className="whitespace-nowrap text-sm font-bold leading-5 text-white">
            네이버 아이디로 {action}
          </span>
        </button>
      </div>
    </>
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
