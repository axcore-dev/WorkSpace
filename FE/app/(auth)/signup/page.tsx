"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthPrimaryButton, AuthSplit, SocialAuthButtons } from "@/components/auth-shell";
import { FIELD_LG, isPersonalEmail } from "@/components/ui";
import { DEMO_USER } from "@/data/org";

export default function SignupPage() {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("demo@democompany.co.kr");
  const [pw, setPw] = useState("demo1234!");
  const [pw2, setPw2] = useState("demo1234!");

  const mismatch = pw2.length > 0 && pw !== pw2;

  /** 데모: 소셜은 제공자가 이미 이메일을 확인했으므로 인증 대기 없이 바로 진입한다 */
  function finishSocial() {
    localStorage.setItem("axpoint-user", JSON.stringify({ ...DEMO_USER, email }));
    router.push("/workspace");
  }

  if (sent) {
    return (
      <AuthSplit>
        <p className="text-xs font-semibold text-primary-600">이메일 인증</p>
        <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
          메일함의 가입 링크를
          <br />
          확인해 주세요
        </h2>
        <p className="mt-3 text-[15px] leading-[1.65] text-slate-500">
          <span className="font-semibold text-slate-800">{email}</span> 주소로 인증 링크를
          보냈습니다. 링크를 열면 가입이 완료됩니다.
        </p>

        <div className="mt-8 flex items-center gap-3.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4" role="status" aria-live="polite">
          <span className="spinner shrink-0" />
          <span className="text-sm text-slate-600">인증 링크 접속 대기 중</span>
        </div>

        <div className="mt-6 space-y-3">
          {/* 데모: 링크 클릭을 버튼으로 대신한다 */}
          <AuthPrimaryButton type="button" onClick={() => router.push("/login")}>
            인증 완료 — 로그인으로 이동 (데모)
          </AuthPrimaryButton>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="w-full cursor-pointer py-1 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
          >
            입력 화면으로 돌아가기
          </button>
        </div>

        <p className="mt-6 text-[12.5px] leading-[1.6] text-slate-400">
          메일이 도착하지 않았다면 스팸함을 확인하거나, 조직 관리자에게 문의해 주세요.
        </p>
      </AuthSplit>
    );
  }

  return (
    <AuthSplit>
      <p className="text-xs font-semibold text-primary-600">WorkSpace 회원가입</p>
      <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
        이메일로 시작하기
      </h2>
      <p className="mt-2.5 text-[15px] text-slate-500">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-semibold text-primary-600 transition-colors hover:text-primary-700">
          로그인
        </Link>
      </p>

      {/* 데모: 비밀번호 일치만 막고, 나머지 검증은 BE 가입 API가 한다 */}
      <form
        className="mt-9 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          setSent(true);
        }}
      >
        <div>
          <label htmlFor="su-name" className="mb-2 block text-sm font-medium text-slate-700">
            이름
          </label>
          <input id="su-name" defaultValue="박데모" placeholder="홍길동" className={FIELD_LG} />
        </div>
        <div>
          <label htmlFor="su-email" className="mb-2 block text-sm font-medium text-slate-700">
            이메일
          </label>
          <input
            id="su-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.co.kr"
            className={FIELD_LG}
          />
          {isPersonalEmail(email) ? (
            <p className="mt-1.5 text-xs text-amber-600">
              개인 메일 주소예요. 회사에서 발급한 업무용 이메일로 가입해 주세요.
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-slate-400">회사 도메인 이메일로 가입하면 워크스페이스 초대가 쉬워져요.</p>
          )}
        </div>
        <div>
          <label htmlFor="su-password" className="mb-2 block text-sm font-medium text-slate-700">
            비밀번호
          </label>
          <input
            id="su-password"
            type="password"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="8자 이상 · 대문자·숫자·특수문자 포함"
            className={FIELD_LG}
          />
        </div>
        <div>
          <label htmlFor="su-password2" className="mb-2 block text-sm font-medium text-slate-700">
            비밀번호 확인
          </label>
          <input
            id="su-password2"
            type="password"
            autoComplete="new-password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder="비밀번호를 다시 입력해 주세요"
            aria-invalid={mismatch || undefined}
            aria-describedby={mismatch ? "su-password2-error" : undefined}
            className={FIELD_LG}
          />
          {mismatch && (
            <p id="su-password2-error" className="mt-1.5 text-xs text-red-600">
              비밀번호가 서로 달라요. 다시 확인해 주세요.
            </p>
          )}
        </div>
        <AuthPrimaryButton disabled={!pw || mismatch}>가입하기</AuthPrimaryButton>
      </form>

      <SocialAuthButtons action="회원가입" onSelect={finishSocial} />
    </AuthSplit>
  );
}
