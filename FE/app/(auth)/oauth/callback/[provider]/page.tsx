"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AuthSplit } from "@/components/auth-shell";
import { ApiRequestError, apiPost } from "@/lib/api";
import { PROVIDER_LABELS, SocialProvider, consumeState } from "@/lib/auth";
import { readInvite } from "@/lib/pending-invite";
import { DEMO_USER } from "@/data/org";

/** BE의 LoginResponse.AuthStep 과 같은 값이어야 한다. */
type AuthStep = "MFA_REQUIRED" | "EMAIL_VERIFICATION_REQUIRED" | "SELECT_WORKSPACE" | "READY";

type LoginResponse = {
  next: AuthStep;
  accessToken?: string;
  accessTokenExpiresAt?: string;
  mfaToken?: string;
  user?: { id: string; email: string; name: string; emailVerified: boolean };
};

type State =
  | { kind: "working" }
  | { kind: "mfa" }
  | { kind: "verifyEmail"; email: string }
  | { kind: "failed"; message: string };

const isSupported = (value: string): value is SocialProvider =>
  value === "google" || value === "naver";

/**
 * 소셜 로그인 콜백.
 *
 * 제공자가 `/oauth/callback/<provider>?code=...&state=...` 로 되돌려 주는 화면이다. 하는 일은
 * state 를 검증하고 code 를 BE 에 넘기는 것뿐이다.
 *
 * code 를 BE 로 넘기는 이유는 교환에 client secret 이 필요하기 때문이다. 브라우저에서 직접
 * 교환하려면 secret 을 내려보내야 하고, 그러면 누구든 임의의 code 를 토큰으로 바꿀 수 있다.
 *
 * access 토큰을 저장하지 않는다. refresh 토큰이 HttpOnly 쿠키로 들어와 있어서, 앱은 언제든
 * `POST /api/auth/refresh` 로 새 access 토큰을 받을 수 있다. localStorage 에 두면 XSS 한 번에
 * 토큰이 새는데, 쿠키로 재발급할 수 있으니 그럴 이유가 없다.
 */
function OAuthCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const routeProvider = String(useParams().provider ?? "");

  const [state, setState] = useState<State>({ kind: "working" });

  // 제공자의 code 는 한 번만 교환할 수 있다. StrictMode 가 effect 를 두 번 실행하므로
  // 막지 않으면 두 번째 호출이 401 을 받고 화면이 성공에서 실패로 뒤집힌다.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    if (!isSupported(routeProvider)) {
      setState({ kind: "failed", message: "지원하지 않는 로그인 방식입니다" });
      return;
    }
    const provider = routeProvider;

    // 사용자가 동의 화면에서 취소하면 code 대신 error 가 온다.
    const providerError = params.get("error");
    if (providerError) {
      setState({
        kind: "failed",
        message:
          providerError === "access_denied"
            ? "로그인을 취소했습니다"
            : `${PROVIDER_LABELS[provider]} 로그인이 완료되지 않았습니다`,
      });
      return;
    }

    const code = params.get("code");
    const returnedState = params.get("state");
    // state 검증은 code 를 보내기 전에 한다. 통과하지 못한 code 를 서버로 넘기면 공격자 계정으로
    // 로그인되는 것을 막을 수 없다.
    if (!consumeState(provider, returnedState)) {
      setState({
        kind: "failed",
        message: "로그인 요청을 확인할 수 없습니다. 로그인 화면에서 다시 시도해 주세요",
      });
      return;
    }
    if (!code) {
      setState({ kind: "failed", message: "인증 코드를 받지 못했습니다" });
      return;
    }

    // state 를 함께 보낸다. 검증은 위에서 이미 끝났고, 이 값은 네이버가 토큰 요청에 요구해서
    // BE 가 제공자에게 그대로 넘겨주기 위한 것이다. Google 은 쓰지 않는다.
    apiPost<LoginResponse>(`/api/auth/oauth/${provider}`, { code, state: returnedState })
      .then((result) => {
        if (!result) {
          setState({ kind: "failed", message: "서버 응답이 비어 있습니다" });
          return;
        }
        if (result.next === "MFA_REQUIRED") {
          setState({ kind: "mfa" });
          return;
        }
        if (result.next === "EMAIL_VERIFICATION_REQUIRED") {
          setState({ kind: "verifyEmail", email: result.user?.email ?? "" });
          return;
        }
        localStorage.setItem(
          "axpoint-user",
          JSON.stringify({ ...DEMO_USER, name: result.user?.name, email: result.user?.email }),
        );

        // 초대 링크에서 소셜 로그인으로 넘어온 사람은 초대로 돌려보낸다. 여기서 회사 선택
        // 화면으로 보내면 초대 링크를 다시 찾아 열어야 한다. 이메일 확인 화면이 초대로 돌아가는
        // 것과 같은 판단이다. 주소가 맞는지는 초대 화면이 /me 로 다시 확인한다.
        const invite = readInvite();
        if (invite) {
          router.replace(`/invite/accept?token=${encodeURIComponent(invite.token)}`);
          return;
        }

        // SELECT_WORKSPACE · READY — 회사 선택 화면으로 넘긴다.
        router.replace("/workspace");
      })
      .catch((e: unknown) => {
        setState({
          kind: "failed",
          message:
            e instanceof ApiRequestError
              ? e.message
              : "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요",
        });
      });
  }, [params, routeProvider, router]);

  const label = isSupported(routeProvider) ? PROVIDER_LABELS[routeProvider] : "소셜";

  return (
    <AuthSplit>
      <p className="text-xs font-semibold text-primary-600">{label} 로그인</p>

      {state.kind === "working" && (
        <>
          <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
            로그인하고 있습니다
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

      {state.kind === "mfa" && (
        <>
          <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
            2단계 인증이 필요합니다
          </h2>
          <p className="mt-3 text-[15px] leading-[1.65] text-slate-500">
            이 계정은 2단계 인증이 켜져 있습니다. 인증 코드를 메일로 보냈습니다.
          </p>
          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
            <p className="text-sm leading-[1.7] text-slate-700">
              코드 입력 화면은 아직 만들지 않았습니다. 지금은 이메일과 비밀번호로 로그인해
              주세요.
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

      {state.kind === "verifyEmail" && (
        <>
          <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
            이메일 확인이 필요합니다
          </h2>
          <p className="mt-3 text-[15px] leading-[1.65] text-slate-500">
            {state.email && <span className="font-semibold text-slate-800">{state.email}</span>}
            {state.email ? " 주소로 " : ""}확인 메일을 보냈습니다. 링크를 열면 회사를 선택할 수
            있습니다.
          </p>
          <Link
            href="/login"
            className="mt-8 block w-full rounded-lg border border-slate-300 bg-white py-3.5 text-center text-sm font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50"
          >
            로그인으로 이동
          </Link>
        </>
      )}

      {state.kind === "failed" && (
        <>
          <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
            로그인하지 못했습니다
          </h2>
          <p className="mt-3 text-[15px] leading-[1.65] text-slate-500">{state.message}</p>
          <Link
            href="/login"
            className="mt-8 block w-full rounded-lg bg-primary-600 py-3.5 text-center text-[15px] font-semibold text-white transition-colors hover:bg-primary-700"
          >
            다시 시도
          </Link>
        </>
      )}
    </AuthSplit>
  );
}

/** useSearchParams는 Suspense 경계가 필요하다. 없으면 빌드가 프리렌더 단계에서 실패한다. */
export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <OAuthCallbackContent />
    </Suspense>
  );
}
