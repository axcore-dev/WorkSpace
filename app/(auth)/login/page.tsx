"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { DEMO_USER } from "@/data/org";

const FIELD =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-400 focus:outline-2 focus:outline-slate-300/60";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"login" | "otp">("login");
  const [email, setEmail] = useState(DEMO_USER.email);
  const [password, setPassword] = useState("demo1234!");
  const [otp, setOtp] = useState<string[]>(["4", "8", "2", "9", "1", "3"]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 데모: 검증 없이 버튼 클릭 즉시 다음 단계로 진행
  function goOtp() {
    setStep("otp");
  }
  function finish() {
    localStorage.setItem("axpoint-user", JSON.stringify({ ...DEMO_USER, email }));
    router.push("/workspace");
  }
  function handleOtpChange(i: number, v: string) {
    if (!/^\d?$/.test(v)) return;
    const next = [...otp];
    next[i] = v;
    setOtp(next);
    if (v && i < 5) otpRefs.current[i + 1]?.focus();
  }

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
        <div className="relative max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-400">
            AX Manufacturing Platform
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-[1.2] tracking-tight text-white">
            지능형 자율제조
            <br />
            운영의 코어.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-slate-400">
            분절된 제조 데이터를 하나의 런타임으로 통합하고, AI가 실시간으로 공정을 판단·최적화합니다.
            프로토타입에서 양산까지, 하나의 코어 위에서.
          </p>
        </div>
        <p className="relative text-xs text-slate-500">© 2026 AXCORE · AXpoint 데모 환경</p>
      </div>

      {/* ── 우측 폼 ── */}
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* 모바일 로고 */}
          <div className="mb-8 lg:hidden">
            <Logo height={24} />
          </div>

          {step === "login" ? (
            <>
              <p className="text-xs font-semibold text-primary-600">로그인</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                다시 오신 것을 환영합니다
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">AXpoint 운영 콘솔에 접속하세요.</p>

              <form
                className="mt-8 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  goOtp();
                }}
              >
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                    업무 이메일
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={FIELD}
                  />
                </div>
                <div>
                  <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                    비밀번호
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={FIELD}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" defaultChecked className="h-4 w-4 accent-slate-800" />
                    로그인 유지
                  </label>
                  <button
                    type="button"
                    className="cursor-pointer text-sm font-medium text-primary-600 transition-colors hover:text-primary-700"
                  >
                    비밀번호 찾기
                  </button>
                </div>
                <button
                  type="submit"
                  className="w-full cursor-pointer rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
                >
                  2단계 인증으로 계속
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-500">
                계정이 없으신가요?{" "}
                <Link href="/signup" className="font-semibold text-primary-600 transition-colors hover:text-primary-700">
                  이메일로 회원가입
                </Link>
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold text-primary-600">2단계 인증</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">인증 코드 입력</h2>
              <p className="mt-1.5 text-sm text-slate-500">
                {email}로 발송된 6자리 코드입니다.{" "}
                <span className="text-slate-400">(데모 · 자동 입력됨)</span>
              </p>

              <form
                className="mt-8"
                onSubmit={(e) => {
                  e.preventDefault();
                  finish();
                }}
              >
                <div className="flex gap-2" role="group" aria-label="OTP 인증 코드">
                  {otp.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        otpRefs.current[i] = el;
                      }}
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      aria-label={`인증 코드 ${i + 1}번째 자리`}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      className="h-12 w-full min-w-0 flex-1 rounded-lg border border-slate-300 text-center text-lg font-bold text-slate-900 transition-colors focus:border-slate-400 focus:outline-2 focus:outline-slate-300/60"
                    />
                  ))}
                </div>
                <button
                  type="submit"
                  className="mt-6 w-full cursor-pointer rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
                >
                  인증하고 계속하기
                </button>
              </form>

              <div className="mt-4 flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => setStep("login")}
                  className="cursor-pointer text-slate-500 transition-colors hover:text-slate-700"
                >
                  ← 로그인으로
                </button>
                <button type="button" className="cursor-pointer font-medium text-primary-600 transition-colors hover:text-primary-700">
                  코드 재발송
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
