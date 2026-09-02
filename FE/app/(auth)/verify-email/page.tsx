"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthSplit } from "@/components/auth-shell";
import { ApiRequestError, apiPost } from "@/lib/api";
import { readInvite } from "@/lib/pending-invite";

type UserResponse = { email: string; name: string; emailVerified: boolean };

type State =
  | { kind: "verifying" }
  | { kind: "done"; user: UserResponse }
  | { kind: "failed"; message: string };

/**
 * 이메일 확인 화면.
 *
 * 메일 링크(`/verify-email?token=...`)가 열리는 곳이다. 화면이 하는 일은 쿼리에서 토큰을 꺼내
 * `POST /api/auth/email/verify`로 넘기는 것뿐이다.
 *
 * BE가 토큰을 쿼리가 아니라 본문으로 받는 이유가 여기에 있다 — URL에 실으면 브라우저 히스토리,
 * 프록시 로그, Referer 헤더에 토큰이 남는다. 링크에는 어쩔 수 없이 붙지만, 서버로 넘길 때는
 * 본문에 담는다.
 *
 * 로그인 여부와 무관하게 동작한다. 메일은 로그인하지 않은 브라우저에서 열릴 수 있다.
 */
function VerifyEmailContent() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<State>({ kind: "verifying" });

  // React 18 StrictMode는 개발 중 effect를 두 번 실행한다. 토큰은 한 번만 쓸 수 있어서
  // 그대로 두면 두 번째 호출이 401을 받고 화면이 실패로 뒤집힌다.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    if (!token) {
      setState({ kind: "failed", message: "확인 링크가 올바르지 않습니다. 메일의 링크를 다시 열어 주세요" });
      return;
    }

    apiPost<UserResponse>("/api/auth/email/verify", { token })
      .then((user) => {
        if (!user) return;

        // 초대를 받고 가입한 사람이면 원래 자리로 돌려보낸다. 메일 링크는 보통 새 탭에서
        // 열려서, 여기서 이어 주지 않으면 "확인은 됐는데 어느 회사였지" 로 끊긴다.
        const invite = readInvite();
        if (invite) {
          window.location.replace(`/invite/accept?token=${encodeURIComponent(invite.token)}`);
          return;
        }
        setState({ kind: "done", user });
      })
      .catch((e: unknown) => {
        const message =
          e instanceof ApiRequestError
            ? e.message
            : "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요";
        setState({ kind: "failed", message });
      });
  }, [token]);

  return (
    <AuthSplit>
      <p className="text-xs font-semibold text-primary-600">이메일 확인</p>

      {state.kind === "verifying" && (
        <>
          <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
            확인하고 있습니다
          </h2>
          <div
            className="mt-8 flex items-center gap-3.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4"
            role="status"
            aria-live="polite"
          >
            <span className="spinner shrink-0" />
            <span className="text-sm text-slate-600">잠시만 기다려 주세요…</span>
          </div>
        </>
      )}

      {state.kind === "done" && (
        <>
          <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
            확인이 완료되었습니다
          </h2>
          <p className="mt-3 text-[15px] leading-[1.65] text-slate-500">
            <span className="font-semibold text-slate-800">{state.user.email}</span> 주소가
            확인되었습니다. 이제 로그인하면 회사를 선택할 수 있습니다.
          </p>

          <div
            className="mt-8 flex items-center gap-3.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4"
            role="status"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-emerald-600"
              aria-hidden
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span className="text-sm text-slate-700">이메일 소유가 확인되었습니다</span>
          </div>

          <Link
            href="/login"
            className="mt-6 block w-full rounded-lg bg-primary-600 py-3.5 text-center text-[15px] font-semibold text-white transition-colors hover:bg-primary-700"
          >
            로그인으로 이동
          </Link>
        </>
      )}

      {state.kind === "failed" && (
        <>
          <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
            확인하지 못했습니다
          </h2>
          <p className="mt-3 text-[15px] leading-[1.65] text-slate-500">{state.message}</p>

          {/* 재발송은 로그인이 필요하다. 인증 없이 주소만으로 보내게 두면 임의의 주소로 메일을
              보낼 수 있는 발송기가 된다. 그래서 여기서는 버튼이 아니라 안내만 둔다. */}
          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-sm leading-[1.7] text-slate-600">
              링크는 발급 후 <span className="font-medium text-slate-900">24시간</span> 동안
              유효하고 한 번만 사용할 수 있습니다. 만료되었다면 로그인 후 확인 메일을 다시
              받을 수 있습니다.
            </p>
          </div>

          <Link
            href="/login"
            className="mt-6 block w-full rounded-lg border border-slate-300 bg-white py-3.5 text-center text-sm font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50"
          >
            로그인으로 이동
          </Link>
        </>
      )}
    </AuthSplit>
  );
}

/** useSearchParams는 Suspense 경계가 필요하다. 없으면 빌드가 프리렌더 단계에서 실패한다. */
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
