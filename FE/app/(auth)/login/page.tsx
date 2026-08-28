"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthPrimaryButton, AuthSplit, SocialAuthButtons } from "@/components/auth-shell";
import { FIELD_LG, isPersonalEmail } from "@/components/ui";
import { DEMO_USER } from "@/data/org";

/** 데모: 매직링크 대기 화면 진입 후 이 시간(ms)이 지나면 링크를 클릭한 것으로 간주한다 */
const DEMO_LINK_CLICK_MS = 5000;
const LINK_TTL_SEC = 600;

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"login" | "await">("login");
  const [email, setEmail] = useState(DEMO_USER.email);
  const [password, setPassword] = useState("demo1234!");
  const [left, setLeft] = useState(LINK_TTL_SEC);
  const [resent, setResent] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  function finish() {
    localStorage.setItem("axpoint-user", JSON.stringify({ ...DEMO_USER, email }));
    router.push("/workspace");
  }

  /** 대기 화면 진입 — 타이머·확인 상태는 여기서 리셋한다 (effect 내 동기 setState 회피) */
  function goAwait() {
    setLeft(LINK_TTL_SEC);
    setConfirmed(false);
    setStep("await");
  }

  // 매직링크 대기: 만료 카운트다운 + 데모용 자동 완료
  useEffect(() => {
    if (step !== "await") return;
    const tick = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    const clicked = setTimeout(() => setConfirmed(true), DEMO_LINK_CLICK_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(clicked);
    };
  }, [step]);

  // 링크 확인 표시를 잠깐 보여준 뒤 로그인 완료
  useEffect(() => {
    if (!confirmed) return;
    const t = setTimeout(finish, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <AuthSplit>
      {step === "login" ? (
        <>
          <p className="text-xs font-semibold text-primary-600">WorkSpace 로그인</p>
          <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
            다시 오신 것을 환영합니다
          </h2>
          <p className="mt-2.5 text-[15px] text-slate-500">
            계정이 없으신가요?{" "}
            <Link href="/signup" className="font-semibold text-primary-600 transition-colors hover:text-primary-700">
              이메일로 회원가입
            </Link>
          </p>

          <form
            className="mt-9 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              goAwait();
            }}
          >
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                이메일
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@company.co.kr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={FIELD_LG}
              />
              {isPersonalEmail(email) && (
                <p className="mt-1.5 text-xs text-amber-600">
                  개인 메일 주소예요. 회사에서 발급한 업무용 이메일 사용을 권장해요.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={FIELD_LG}
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
            <AuthPrimaryButton>로그인</AuthPrimaryButton>
          </form>

          {/* 데모: 소셜은 즉시 로그인된다 (매직링크 단계를 거치지 않는다) */}
          <SocialAuthButtons action="로그인" onSelect={finish} />
        </>
      ) : (
        <>
          <p className="text-xs font-semibold text-primary-600">2단계 인증</p>
          <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
            이메일의 로그인 링크를
            <br />
            확인해 주세요
          </h2>
          <p className="mt-3 text-[15px] leading-[1.65] text-slate-500">
            <span className="font-semibold text-slate-800">{email}</span> 주소로 1회용 로그인
            링크를 보냈습니다. 링크를 열면 이 화면이 자동으로 로그인됩니다.
          </p>

          <div className="mt-8 flex items-center gap-3.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4" role="status" aria-live="polite">
            {confirmed ? (
              <>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-emerald-600" aria-hidden>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <span className="text-sm text-slate-600">
                  링크가 확인되었습니다. <span className="font-medium text-slate-900">로그인 중…</span>
                </span>
              </>
            ) : (
              <>
                <span className="spinner shrink-0" />
                <span className="text-sm text-slate-600">
                  링크 접속 대기 중 ·{" "}
                  <span className="font-medium tabular-nums text-slate-900">
                    {mm}:{ss}
                  </span>{" "}
                  후 만료
                </span>
              </>
            )}
          </div>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              disabled={resent}
              onClick={() => {
                setResent(true);
                setLeft(LINK_TTL_SEC);
                setTimeout(() => setResent(false), 2200);
              }}
              className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white py-3.5 text-sm font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {resent ? "인증 링크를 다시 보냈습니다" : "인증 링크 다시 보내기"}
            </button>
            <button
              type="button"
              onClick={() => setStep("login")}
              className="w-full cursor-pointer py-1 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
            >
              다른 계정으로 로그인
            </button>
          </div>

          <p className="mt-6 text-[12.5px] leading-[1.6] text-slate-400">
            메일이 도착하지 않았다면 스팸함을 확인하거나, 조직 관리자에게 문의해 주세요.
          </p>
        </>
      )}
    </AuthSplit>
  );
}
