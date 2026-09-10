"use client";

import { useEffect, useState } from "react";
import { AuthPrimaryButton } from "@/components/auth-shell";
import { FIELD_ERROR, FIELD_LG } from "@/components/ui";
import { ApiRequestError, apiPost } from "@/lib/api";

/** BE `MfaChallenge.TTL` 과 같다. 화면의 카운트다운일 뿐, 실제 만료 판정은 서버가 한다. */
const CODE_TTL_SEC = 600;

export type MfaLoginResult = {
  next: string;
  accessToken?: string | null;
  accessTokenExpiresAt?: string | null;
  user?: { id: string; email: string; name: string; emailVerified: boolean } | null;
};

/**
 * 로그인 2단계 — 메일로 받은 6자리 코드를 넣는 화면.
 *
 * 이메일 로그인(`/login`)과 소셜 로그인 콜백(`/oauth/callback/<provider>`) 둘 다 `MFA_REQUIRED` 를 받으면
 * 여기로 온다. 코드는 서버에만 있다. 맞는지 여기서 보지 않고 `POST /api/auth/mfa/verify` 에 넘겨 판정을 받고,
 * 통과하면 그제야 토큰이 든 로그인 응답이 온다 — 그 뒤는 부른 쪽(`onVerified`)이 평소 로그인과 같게 이어 간다.
 *
 * 「코드 다시 받기」는 없다. 로그인 챌린지를 새로 만드는 경로가 서버에 따로 없고, 비밀번호(또는 제공자)로
 * 다시 로그인하면 새 코드가 간다. 그래서 만료·시도 초과 때는 처음으로 돌려보낸다(`onRestart`).
 * 시도는 서버가 5회로 막는다 — 여기서 세지 않는다.
 */
export function MfaCodeStep({
  mfaToken,
  email,
  onVerified,
  onRestart,
}: {
  mfaToken: string;
  /** 코드를 받은 주소. 소셜 로그인은 모를 수 있다 — 2단계 전에는 서버가 사용자 정보를 내주지 않는다 */
  email?: string;
  onVerified: (result: MfaLoginResult) => void | Promise<void>;
  onRestart: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(CODE_TTL_SEC);

  useEffect(() => {
    const tick = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(tick);
  }, []);

  const expired = left === 0;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  async function verify() {
    if (code.length !== 6 || busy) return;
    setError(null);
    setBusy(true);
    try {
      const result = await apiPost<MfaLoginResult>("/api/auth/mfa/verify", { mfaToken, code });
      if (!result) {
        setError("서버 응답이 비어 있어요. 다시 시도해 주세요.");
        return;
      }
      await onVerified(result);
    } catch (e: unknown) {
      setError(
        e instanceof ApiRequestError
          ? e.body.message
          : "서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="text-xs font-semibold text-primary-600">2단계 인증</p>
      <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
        이메일로 받은 코드를
        <br />
        입력해 주세요
      </h2>
      <p className="mt-3 text-[15px] leading-[1.65] text-slate-500">
        {email ? (
          <>
            <span className="font-semibold text-slate-800">{email}</span> 주소로 6자리 인증 코드를 보냈어요.
          </>
        ) : (
          <>계정 이메일로 6자리 인증 코드를 보냈어요.</>
        )}{" "}
        코드는{" "}
        <span className="font-medium tabular-nums text-slate-900">
          {mm}:{ss}
        </span>{" "}
        뒤에 만료됩니다.
      </p>

      <form
        className="mt-9 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
      >
        <div>
          <label htmlFor="mfa-code" className="mb-2 block text-sm font-medium text-slate-700">
            인증 코드 6자리
          </label>
          <input
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            placeholder="000000"
            value={code}
            disabled={expired}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              setError(null);
            }}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? "mfa-error" : undefined}
            className={`${error ? FIELD_ERROR : FIELD_LG} text-center text-xl font-semibold tracking-[0.5em] tabular-nums`}
          />
        </div>

        {expired ? (
          <p className="text-sm text-amber-700" role="alert">
            코드가 만료됐어요. 다시 로그인하면 새 코드를 보내 드려요.
          </p>
        ) : (
          error && (
            <p id="mfa-error" className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )
        )}

        {!expired && (
          <AuthPrimaryButton disabled={code.length !== 6 || busy}>
            {busy ? "확인 중…" : "확인"}
          </AuthPrimaryButton>
        )}
      </form>

      <button
        type="button"
        onClick={onRestart}
        className={`w-full cursor-pointer text-sm font-medium transition-colors ${
          expired
            ? "mt-4 rounded-lg border border-slate-300 bg-white py-3.5 font-semibold text-slate-800 hover:border-slate-400 hover:bg-slate-50"
            : "mt-6 py-1 text-slate-500 hover:text-slate-800"
        }`}
      >
        {expired ? "다시 로그인" : "다른 계정으로 로그인"}
      </button>

      <p className="mt-6 text-[12.5px] leading-[1.6] text-slate-400">
        메일이 오지 않았다면 스팸함을 확인해 주세요. 코드를 5번 틀리면 처음부터 다시 로그인해야 해요.
      </p>
    </>
  );
}
