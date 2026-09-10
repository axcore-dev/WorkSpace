"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AuthSplit } from "@/components/auth-shell";
import { MfaCodeStep } from "@/components/auth/mfa-code-step";
import { linkSocialIdentity } from "@/lib/account-api";
import { ApiRequestError, apiGet, apiPost } from "@/lib/api";
import { PROVIDER_LABELS, SocialProvider, consumeOAuthPurpose, consumeState } from "@/lib/auth";
import { inviteHref, readInvite } from "@/lib/pending-invite";
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
  | { kind: "working"; purpose: "login" | "link" }
  | { kind: "mfa"; mfaToken: string }
  | { kind: "verifyEmail"; email: string }
  /** 계정 설정에서 시작한 연동 추가가 끝났다 */
  | { kind: "linked"; provider: SocialProvider }
  | { kind: "failed"; message: string; purpose: "login" | "link" };

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

  const [state, setState] = useState<State>({ kind: "working", purpose: "login" });

  // 제공자의 code 는 한 번만 교환할 수 있다. StrictMode 가 effect 를 두 번 실행하므로
  // 막지 않으면 두 번째 호출이 401 을 받고 화면이 성공에서 실패로 뒤집힌다.
  const sent = useRef(false);

  /**
   * 인증이 끝난 뒤 — 제공자 교환으로 바로 끝났든 2단계까지 거쳤든 여기로 모인다.
   *
   * 이메일 확인이 남았으면 그 안내로. 아니면 초대 → 운영자 콘솔 → 회사 선택 순으로 보낸다.
   */
  const finishLogin = useCallback(
    (result: LoginResponse) => {
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
        router.replace(inviteHref(invite));
        return;
      }

      // 운영자는 운영자 콘솔로. 이메일 로그인(login/page.tsx)과 같은 판정이다 — 소셜 로그인만
      // 이 확인이 빠져 있어서 운영자가 Google 로 들어오면 회사 선택 화면에 떨어졌다.
      // 여기 결과는 어느 화면으로 보낼지만 정한다. 실제 인가는 서버가 요청마다 DB 로 본다.
      // /me 가 실패해도 로그인은 이미 됐으니 일반 경로로 보낸다.
      return apiGet<{ internalAdmin: boolean }>("/api/auth/me")
        .then((me) => {
          router.replace(me?.internalAdmin ? "/admin" : "/workspace");
        })
        .catch(() => {
          // SELECT_WORKSPACE · READY — 회사 선택 화면으로 넘긴다.
          router.replace("/workspace");
        });
    },
    [router],
  );

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    // 검증 · 교환을 effect 본문 밖(마이크로태스크)으로 미룬다. 렌더 도중 setState 를 부르면
    // 렌더가 연쇄로 다시 돈다 (react-hooks/set-state-in-effect). 여기 검증들을 useState
    // 초기값으로 옮기지 않는 이유는 consumeState 가 저장된 state 를 소비하기 때문이다 —
    // StrictMode 가 초기화 함수를 두 번 부르면 두 번째가 실패한다.
    void (async () => {
      await Promise.resolve();

      if (!isSupported(routeProvider)) {
        setState({ kind: "failed", message: "지원하지 않는 로그인 방식입니다", purpose: "login" });
        return;
      }
      const provider = routeProvider;
      // 이 왕복이 로그인인지, 로그인한 계정에 제공자를 붙이는 것인지. 시작한 쪽(startSocialLogin)이 적어 뒀다.
      const purpose = consumeOAuthPurpose(provider);
      const label = PROVIDER_LABELS[provider];
      setState({ kind: "working", purpose });

      // 사용자가 동의 화면에서 취소하면 code 대신 error 가 온다.
      const providerError = params.get("error");
      if (providerError) {
        setState({
          kind: "failed",
          purpose,
          message:
            providerError === "access_denied"
              ? purpose === "link"
                ? "연동을 취소했습니다"
                : "로그인을 취소했습니다"
              : `${label} ${purpose === "link" ? "연동" : "로그인"}이 완료되지 않았습니다`,
        });
        return;
      }

      const code = params.get("code");
      const returnedState = params.get("state");
      // state 검증은 code 를 보내기 전에 한다. 통과하지 못한 code 를 서버로 넘기면 공격자 계정으로
      // 로그인되는(또는 공격자의 제공자 계정이 내 계정에 붙는) 것을 막을 수 없다.
      if (!consumeState(provider, returnedState)) {
        setState({
          kind: "failed",
          purpose,
          message: "요청을 확인할 수 없습니다. 처음 화면에서 다시 시도해 주세요",
        });
        return;
      }
      if (!code) {
        setState({ kind: "failed", message: "인증 코드를 받지 못했습니다", purpose });
        return;
      }

      // 연동 추가 — 로그인이 아니다. 세션은 이미 있고(refresh 쿠키), 현재 계정에 제공자를 붙이기만 한다.
      // 그 제공자 계정이 다른 사용자에게 붙어 있으면 서버가 409 로 막고 그 문구가 그대로 화면에 온다.
      if (purpose === "link") {
        linkSocialIdentity(provider, code, returnedState)
          .then(() => setState({ kind: "linked", provider }))
          .catch((e: unknown) => {
            setState({
              kind: "failed",
              purpose,
              message:
                e instanceof ApiRequestError
                  ? e.message
                  : "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요",
            });
          });
        return;
      }

      // state 를 함께 보낸다. 검증은 위에서 이미 끝났고, 이 값은 네이버가 토큰 요청에 요구해서
      // BE 가 제공자에게 그대로 넘겨주기 위한 것이다. Google 은 쓰지 않는다.
      apiPost<LoginResponse>(`/api/auth/oauth/${provider}`, { code, state: returnedState })
        .then((result) => {
          if (!result) {
            setState({ kind: "failed", message: "서버 응답이 비어 있습니다", purpose: "login" });
            return;
          }
          if (result.next === "MFA_REQUIRED" && result.mfaToken) {
            setState({ kind: "mfa", mfaToken: result.mfaToken });
            return;
          }
          return finishLogin(result);
        })
        .catch((e: unknown) => {
          setState({
            kind: "failed",
            purpose: "login",
            message:
              e instanceof ApiRequestError
                ? e.message
                : "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요",
          });
        });
    })();
  }, [finishLogin, params, routeProvider, router]);

  const label = isSupported(routeProvider) ? PROVIDER_LABELS[routeProvider] : "소셜";
  const linking = (state.kind === "working" || state.kind === "failed") && state.purpose === "link";

  return (
    <AuthSplit>
      <p className="text-xs font-semibold text-primary-600">
        {label} {linking || state.kind === "linked" ? "연동" : "로그인"}
      </p>

      {state.kind === "working" && (
        <>
          <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
            {linking ? "계정을 연결하고 있습니다" : "로그인하고 있습니다"}
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
        <MfaCodeStep
          mfaToken={state.mfaToken}
          onVerified={(result) => finishLogin(result as LoginResponse)}
          onRestart={() => router.replace("/login")}
        />
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

      {state.kind === "linked" && (
        <>
          <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
            {PROVIDER_LABELS[state.provider]} 계정을 연결했습니다
          </h2>
          <p className="mt-3 text-[15px] leading-[1.65] text-slate-500">
            다음부터 {PROVIDER_LABELS[state.provider]} 계정으로도 로그인할 수 있습니다.
          </p>
          <Link
            href="/settings/account"
            className="mt-8 block w-full rounded-lg bg-primary-600 py-3.5 text-center text-[15px] font-semibold text-white transition-colors hover:bg-primary-700"
          >
            계정 설정으로 돌아가기
          </Link>
        </>
      )}

      {state.kind === "failed" && (
        <>
          <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
            {state.purpose === "link" ? "계정을 연결하지 못했습니다" : "로그인하지 못했습니다"}
          </h2>
          <p className="mt-3 text-[15px] leading-[1.65] text-slate-500">{state.message}</p>
          <Link
            href={state.purpose === "link" ? "/settings/account" : "/login"}
            className="mt-8 block w-full rounded-lg bg-primary-600 py-3.5 text-center text-[15px] font-semibold text-white transition-colors hover:bg-primary-700"
          >
            {state.purpose === "link" ? "계정 설정으로 돌아가기" : "다시 시도"}
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
