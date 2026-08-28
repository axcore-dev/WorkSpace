"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthPrimaryButton, AuthSplit } from "@/components/auth-shell";
import { FIELD_LG } from "@/components/ui";
import { ApiRequestError, apiPost } from "@/lib/api";

/** BE의 SignUpRequest·PasswordRequests와 같은 규칙. 한쪽만 느슨하면 그쪽으로 약한 값이 들어간다. */
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,16}$/;
const PASSWORD_MESSAGE = "영문·숫자·특수문자를 모두 포함한 8~16자여야 합니다";

/**
 * 비밀번호 재설정 화면.
 *
 * 메일 링크(`/reset-password?token=...`)가 열리는 곳이다. 현재 비밀번호를 묻지 않는다 —
 * 잊은 사람이 쓰는 경로다. 대신 토큰이 30분만 살고 한 번만 쓰인다.
 *
 * 성공하면 그 계정의 모든 세션이 폐기된다. 유출이 의심돼 바꾸는 상황에서 이미 로그인해 있던
 * 쪽을 남겨 두면 바꾼 의미가 없다.
 */
function ResetPasswordContent() {
  const token = useSearchParams().get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // 제출 전에 화면에서 막을 수 있는 것들. 서버도 같은 규칙으로 검증하지만, 왕복 한 번을
  // 아끼고 어느 필드가 틀렸는지 바로 보여줄 수 있다.
  const localError =
    password && !PASSWORD_RULE.test(password)
      ? PASSWORD_MESSAGE
      : confirm && password !== confirm
        ? "두 비밀번호가 일치하지 않습니다"
        : null;

  const canSubmit = !!token && !!password && password === confirm && !localError && !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      await apiPost("/api/auth/password/reset", { token, newPassword: password });
      setDone(true);
    } catch (err: unknown) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <AuthSplit>
        <p className="text-xs font-semibold text-primary-600">비밀번호 재설정</p>
        <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
          비밀번호를 변경했습니다
        </h2>
        <p className="mt-3 text-[15px] leading-[1.65] text-slate-500">
          보안을 위해 모든 기기에서 로그아웃되었습니다. 새 비밀번호로 다시 로그인해 주세요.
        </p>
        <Link
          href="/login"
          className="mt-8 block w-full rounded-lg bg-primary-600 py-3.5 text-center text-[15px] font-semibold text-white transition-colors hover:bg-primary-700"
        >
          로그인으로 이동
        </Link>
      </AuthSplit>
    );
  }

  // 토큰 없이 이 주소를 직접 열었거나 링크가 잘린 경우. 폼을 보여줄 이유가 없다.
  if (!token) {
    return (
      <AuthSplit>
        <p className="text-xs font-semibold text-primary-600">비밀번호 재설정</p>
        <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
          링크가 올바르지 않습니다
        </h2>
        <p className="mt-3 text-[15px] leading-[1.65] text-slate-500">
          메일에 있는 재설정 링크를 다시 열어 주세요. 링크는 발급 후 30분 동안 유효합니다.
        </p>
        <Link
          href="/login"
          className="mt-8 block w-full rounded-lg border border-slate-300 bg-white py-3.5 text-center text-sm font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50"
        >
          로그인으로 이동
        </Link>
      </AuthSplit>
    );
  }

  return (
    <AuthSplit>
      <p className="text-xs font-semibold text-primary-600">비밀번호 재설정</p>
      <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
        새 비밀번호를 설정해 주세요
      </h2>
      <p className="mt-2.5 text-[15px] text-slate-500">{PASSWORD_MESSAGE}</p>

      <form className="mt-9 space-y-5" onSubmit={submit}>
        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
            새 비밀번호
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={FIELD_LG}
          />
        </div>
        <div>
          <label htmlFor="confirm" className="mb-2 block text-sm font-medium text-slate-700">
            새 비밀번호 확인
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={FIELD_LG}
          />
        </div>

        {(localError || error) && (
          <p className="text-sm text-red-600" role="alert">
            {localError ?? error}
          </p>
        )}

        <AuthPrimaryButton disabled={!canSubmit}>
          {submitting ? "변경 중…" : "비밀번호 변경"}
        </AuthPrimaryButton>
      </form>

      <p className="mt-6 text-[12.5px] leading-[1.6] text-slate-400">
        변경하면 모든 기기에서 로그아웃됩니다. 이 링크는 한 번만 사용할 수 있습니다.
      </p>
    </AuthSplit>
  );
}

/** useSearchParams는 Suspense 경계가 필요하다. 없으면 빌드가 프리렌더 단계에서 실패한다. */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
