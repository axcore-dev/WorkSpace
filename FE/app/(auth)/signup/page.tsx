"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthPrimaryButton, AuthSplit, SocialAuthButtons } from "@/components/auth-shell";
import { FIELD_LG, isPersonalEmail } from "@/components/ui";
import { ApiRequestError, apiPost } from "@/lib/api";
import {
  PROVIDER_LABELS,
  SocialLoginNotConfiguredError,
  SocialProvider,
  startSocialLogin,
} from "@/lib/auth";

/** BE `SignUpRequest` 의 필드 이름. `VALIDATION_FAILED` 응답의 `fields` 키가 이것과 같다 */
type FieldErrors = Partial<Record<"name" | "email" | "password", string>>;

/**
 * 이메일 회원가입 화면.
 *
 * 화면이 하는 일은 `POST /api/auth/signup` 한 번이다. 성공하면 서버가 계정을 만들고 확인 메일을
 * 보내며, 이 화면은 "메일함을 확인해 달라"는 안내로 바뀐다. 실제 확인은 메일 링크가 여는
 * `/verify-email` 이 처리한다 — 여기서는 확인 여부를 알 수 없고, 알 필요도 없다.
 *
 * 검증은 비밀번호 일치만 여기서 본다. 형식 규칙(이메일·비밀번호·이름)은 서버가 판정하고,
 * 필드별 메시지를 그대로 받아 해당 칸 아래에 띄운다. 규칙을 양쪽에 두면 한쪽만 고쳐질 때
 * 어긋난다.
 */
export default function SignupPage() {
  const [sent, setSent] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  /** 필드에 붙일 수 없는 오류 — 네트워크 실패, 알 수 없는 서버 오류 */
  const [formError, setFormError] = useState<string | null>(null);
  /**
   * 이미 가입된 주소(`EMAIL_ALREADY_USED`). 다음 행동(로그인·비밀번호 찾기)이 다르므로 일반
   * 오류와 따로 둔다.
   *
   * 소셜로만 가입된 주소(비밀번호 없음)는 여기로 오지 않는다. 서버가 그 계정에 비밀번호를 붙여
   * 가입을 이어 가고 확인 메일을 다시 보내므로, 화면은 보통 가입과 똑같이 `sent` 로 넘어간다.
   */
  const [duplicate, setDuplicate] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);

  const mismatch = pw2.length > 0 && pw !== pw2;

  async function signUp() {
    setFormError(null);
    setDuplicate(false);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await apiPost("/api/auth/signup", {
        email: email.trim(),
        password: pw,
        name: name.trim(),
      });
      setSent(true);
    } catch (e: unknown) {
      if (e instanceof ApiRequestError) {
        if (e.body.code === "EMAIL_ALREADY_USED") {
          setDuplicate(true);
          return;
        }
        if (e.body.code === "VALIDATION_FAILED" && e.body.fields) {
          // 어느 칸이 틀렸는지 서버가 알려 준다. 칸 아래에 붙이고, 위쪽 일반 문구는 생략한다.
          setFieldErrors(e.body.fields);
          return;
        }
        setFormError(e.body.message);
        return;
      }
      // fetch 자체가 실패했다. 로그인 화면처럼 데모로 넘어가지 않는다 — "메일을 보냈다"는
      // 화면을 거짓으로 띄우면 사용자는 오지 않을 메일을 기다리게 된다.
      setFormError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * 소셜 가입. 로그인 화면과 같은 경로다 — 제공자 화면으로 보내고, 돌아오는
   * `/oauth/callback/<provider>` 에서 서버가 "처음 보는 이메일이면 계정을 만든다".
   * 가입과 로그인을 서버가 한 갈래로 처리하므로 화면이 둘을 구분할 필요가 없다.
   */
  function signUpWith(provider: SocialProvider) {
    setSocialError(null);
    try {
      startSocialLogin(provider);
    } catch (e: unknown) {
      const label = PROVIDER_LABELS[provider];
      setSocialError(
        e instanceof SocialLoginNotConfiguredError
          ? `${label} 가입이 아직 설정되지 않았습니다`
          : `${label} 가입을 시작할 수 없습니다`,
      );
    }
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
          <span className="font-semibold text-slate-800">{email.trim()}</span> 주소로 인증 링크를
          보냈습니다. 링크를 열면 가입이 완료되고, 그 뒤 로그인할 수 있습니다.
        </p>

        <div
          className="mt-8 flex items-center gap-3.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4"
          role="status"
          aria-live="polite"
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
          <span className="text-sm text-slate-700">인증 메일을 보냈습니다</span>
        </div>

        {/* 재발송은 로그인이 필요한 API 다(`/api/auth/email/verify-request`). 주소만으로 보낼 수
            있게 두면 임의의 주소로 메일을 보내는 발송기가 되므로, 여기서는 버튼 대신 안내만 둔다. */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-sm leading-[1.7] text-slate-600">
            링크는 발급 후 <span className="font-medium text-slate-900">24시간</span> 동안
            유효하고 한 번만 사용할 수 있습니다. 메일이 오지 않으면 스팸함을 확인해 주세요.
            만료되었다면 로그인 후 확인 메일을 다시 받을 수 있습니다.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <Link
            href="/login"
            className="block w-full rounded-lg bg-primary-600 py-3.5 text-center text-[15px] font-semibold text-white transition-colors hover:bg-primary-700"
          >
            로그인으로 이동
          </Link>
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setEmail("");
              setPw("");
              setPw2("");
            }}
            className="w-full cursor-pointer py-1 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
          >
            다른 이메일로 가입하기
          </button>
        </div>
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

      <form
        className="mt-9 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void signUp();
        }}
      >
        <div>
          <label htmlFor="su-name" className="mb-2 block text-sm font-medium text-slate-700">
            이름
          </label>
          <input
            id="su-name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={fieldErrors.name ? "su-name-error" : undefined}
            className={FIELD_LG}
          />
          {fieldErrors.name && (
            <p id="su-name-error" className="mt-1.5 text-xs text-red-600">
              {fieldErrors.name}
            </p>
          )}
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
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={fieldErrors.email ? "su-email-error" : undefined}
            className={FIELD_LG}
          />
          {fieldErrors.email ? (
            <p id="su-email-error" className="mt-1.5 text-xs text-red-600">
              {fieldErrors.email}
            </p>
          ) : isPersonalEmail(email) ? (
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
            placeholder="영문·숫자·특수문자 포함 8~16자"
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? "su-password-error" : undefined}
            className={FIELD_LG}
          />
          {fieldErrors.password && (
            <p id="su-password-error" className="mt-1.5 text-xs text-red-600">
              {fieldErrors.password}
            </p>
          )}
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
        {duplicate && (
          <div className="rounded-md bg-amber-50 px-4 py-3 text-sm leading-[1.65] text-amber-800" role="alert">
            이미 가입된 주소예요.{" "}
            <Link href="/login" className="font-semibold underline underline-offset-2">
              로그인
            </Link>
            하거나, 비밀번호를 모르면 로그인 화면의 「비밀번호 찾기」를 이용해 주세요.
          </div>
        )}
        {formError && (
          <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {formError}
          </p>
        )}

        <AuthPrimaryButton disabled={!pw || mismatch || submitting}>
          {submitting ? "가입 중…" : "가입하기"}
        </AuthPrimaryButton>
      </form>

      <SocialAuthButtons action="회원가입" onSelect={signUpWith} />

      {socialError && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {socialError}
        </p>
      )}
    </AuthSplit>
  );
}
