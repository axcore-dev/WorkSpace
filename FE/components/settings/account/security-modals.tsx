"use client";

/**
 * 계정 보안이 여는 모달들.
 *
 * `PasswordModal`·`OtpEnrollModal`은 옛 `account-settings.tsx`에서 그대로 옮겨 왔다 —
 * 비밀번호 규칙 검증과 OTP 타이머를 새로 쓰지 않았다.
 *
 * **BE에 실제로 있는 것과 없는 것** (`docs/be/account-api-postman-test.md`):
 * - 있음: `POST /api/auth/password`(현재 비밀번호를 묻는다) · `password/reset-request`·`/reset`
 *   (메일 흐름) · `mfa/methods`·`mfa/email`·`/confirm`·`DELETE mfa/email` · `email/verify-request`
 * - 없음: SMS OTP · TOTP · 패스키 · 추가 이메일 · 소셜 연동 해제
 *
 * 이번 범위는 화면까지다. 전부 더미로 두고 BE에 없는 것은 **버튼을 비활성**으로 둔다.
 */

import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { IconCheck, IconCheckCircle, IconEye, IconEyeOff, IconKey, IconLock, IconMail, IconShield, IconX } from "@/components/icons";
import { Badge, Button, FIELD, FIELD_ERROR, Toggle } from "@/components/ui";
import { PROVIDER_LABELS } from "@/lib/auth";
import { ACCOUNT_EMAILS, DEMO_USER, SOCIAL_LOGINS } from "@/data/org";

export type TfaId = "email" | "sms" | "totp";

/** `sentTo` — 발송 대상 뒤에 붙는 조사. 이메일 주소·번호에 조사를 직접 붙이면 어긋난다 */
export const TFA_METHODS: { id: TfaId; name: string; desc: string; sentTo?: string }[] = [
  { id: "email", name: "이메일 OTP", desc: "로그인 시 이메일로 6자리 코드 발송", sentTo: "주소로" },
  { id: "sms", name: "SMS OTP", desc: "휴대전화 문자로 인증 코드 발송", sentTo: "번호로" },
  { id: "totp", name: "Google Authenticator", desc: "인증 앱 기반 TOTP" },
];

/** 데모 검증 코드 — BE 연동 시 서버가 발송·검증한다 (코드는 서버에만 존재해야 한다) */
const DEMO_OTP = "123456";
const OTP_TTL_SEC = 180;

export type TfaState = Record<TfaId, boolean>;

/**
 * 이메일 OTP는 유일한 복구 수단이라 **가장 먼저 등록해야** 한다.
 * 이메일을 끄면 나머지 수단도 함께 꺼진다 — 계정이 잠기는 조합을 만들지 않는다.
 */
export function applyTfa(tfa: TfaState, id: TfaId, on: boolean): TfaState {
  if (id === "email" && !on) return { email: false, sms: false, totp: false };
  return { ...tfa, [id]: on };
}

/**
 * 비밀번호 변경 팝업 — Assisted Password Confirmation:
 * 규칙 충족 여부와 확인 입력 일치를 실시간으로 보여준다.
 *
 * **두 흐름이다.** 기본은 현재 비밀번호를 묻는다(`POST /api/auth/password`). 잊은 사람만
 * 대표 이메일로 코드를 받는 쪽으로 넘어간다(`password/reset-request` + `/reset`).
 * 로그인된 상태에서 현재 비밀번호 확인을 빼면 세션이나 메일이 탈취됐을 때 그대로 계정을
 * 잃는다 — 잊은 사람에게만 단계가 늘어나는 편이 맞다.
 *
 * **검증은 전부 BE 소관이다.** 여기서는 입력 형식만 본다 — 자체 해시·검증 로직을 만들지
 * 않는다 (루트 CLAUDE.md AI 보안 지침).
 */
export function PasswordModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  /** `current` = 현재 비밀번호로 바꾼다 · `email` = 잊어서 메일로 인증한다 */
  const [mode, setMode] = useState<"current" | "email">("current");
  const [cur, setCur] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);

  const rules = [
    { label: "영문 포함", ok: /[a-zA-Z]/.test(pw) },
    { label: "숫자 포함", ok: /\d/.test(pw) },
    { label: "특수문자 포함", ok: /[^a-zA-Z0-9]/.test(pw) },
    { label: "8~16자리", ok: pw.length >= 8 && pw.length <= 16 },
  ];
  const valid = rules.every((r) => r.ok);
  const match = pw2.length > 0 && pw === pw2;
  /** 신원 확인이 끝났는가 — 현재 비밀번호를 넣었거나, 메일 코드 6자리를 넣었거나 */
  const identified = mode === "current" ? !!cur : code.length === 6;
  const canSubmit = identified && valid && match;

  function close() {
    setMode("current");
    setCur("");
    setCode("");
    setCodeSent(false);
    setPw("");
    setPw2("");
    setShow(false);
    setDone(false);
    onClose();
  }

  function submit() {
    setDone(true);
    onDone("비밀번호를 바꿨어요");
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="sm"
      title="비밀번호 변경"
      footer={
        !done && (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              닫기
            </Button>
            <Button
              disabled={!canSubmit}
              onClick={submit}
              title={canSubmit ? undefined : "모든 조건을 충족하면 변경할 수 있어요"}
            >
              <IconKey size={15} />
              비밀번호 변경
            </Button>
          </div>
        )
      }
    >
      {done ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <IconCheckCircle size={40} className="text-emerald-600" />
          <p className="mt-3 text-sm font-semibold text-slate-900">비밀번호가 변경되었습니다</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            다음 로그인부터 새 비밀번호를 사용해 주세요. 모든 기기에서 다시 로그인해야 합니다.
          </p>
          <Button className="mt-5" onClick={close}>
            확인
          </Button>
        </div>
      ) : (
        <div className="space-y-4 p-5">
          {mode === "current" ? (
            <div>
              <label htmlFor="pwm-cur" className="mb-1.5 block text-sm font-medium text-slate-700">
                현재 비밀번호
              </label>
              <input
                id="pwm-cur"
                type="password"
                autoComplete="current-password"
                value={cur}
                onChange={(e) => setCur(e.target.value)}
                className={FIELD}
              />
              <button
                type="button"
                onClick={() => setMode("email")}
                className="mt-1.5 cursor-pointer text-xs text-primary-600 underline underline-offset-2"
              >
                비밀번호를 잊었어요
              </button>
            </div>
          ) : (
            <div>
              <label htmlFor="pwm-code" className="mb-1.5 block text-sm font-medium text-slate-700">
                이메일 인증 코드
              </label>
              <div className="flex gap-2">
                <input
                  id="pwm-code"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className={`${FIELD} font-mono tracking-[0.3em]`}
                />
                <Button
                  variant="secondary"
                  onClick={() => setCodeSent(true)}
                  className="shrink-0"
                >
                  {codeSent ? "다시 받기" : "코드 받기"}
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                {codeSent
                  ? `${DEMO_USER.email}로 6자리 코드를 보냈어요.`
                  : `${DEMO_USER.email}로 6자리 코드를 보내요.`}
              </p>
              <button
                type="button"
                onClick={() => setMode("current")}
                className="mt-1.5 cursor-pointer text-xs text-slate-500 underline underline-offset-2"
              >
                현재 비밀번호로 바꿀게요
              </button>
            </div>
          )}
          <div>
            <label htmlFor="pwm-new" className="mb-1.5 block text-sm font-medium text-slate-700">
              새 비밀번호
            </label>
            <div className="relative">
              <input
                id="pwm-new"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                className={`${FIELD} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "비밀번호 숨기기" : "비밀번호 표시"}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                {show ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              영문, 숫자, 특수문자를 포함하여 8~16자리 입력해 주세요.
            </p>
            {pw.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {rules.map((r) => (
                  <li
                    key={r.label}
                    className={`inline-flex items-center gap-1 text-xs ${r.ok ? "text-emerald-600" : "text-slate-400"}`}
                  >
                    {r.ok ? <IconCheck size={12} /> : <IconX size={12} />}
                    {r.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label htmlFor="pwm-new2" className="mb-1.5 block text-sm font-medium text-slate-700">
              새 비밀번호 확인
            </label>
            <input
              id="pwm-new2"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              aria-describedby="pwm-match"
              className={FIELD}
            />
            {pw2.length > 0 && (
              <p
                id="pwm-match"
                className={`mt-1.5 inline-flex items-center gap-1 text-xs ${match ? "text-emerald-600" : "text-red-600"}`}
              >
                {match ? <IconCheck size={12} /> : <IconX size={12} />}
                {match ? "새 비밀번호와 일치해요" : "새 비밀번호와 일치하지 않아요"}
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

/**
 * 2단계 인증 등록 팝업 — 발송된 6자리를 확인해야 수단이 켜진다.
 * 부모가 `key={method.id}`로 마운트하므로 열릴 때마다 타이머·입력이 초기화된다.
 */
export function OtpEnrollModal({
  method,
  target,
  onClose,
  onVerified,
}: {
  method: (typeof TFA_METHODS)[number];
  target: string;
  onClose: () => void;
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [left, setLeft] = useState(OTP_TTL_SEC);
  const [resent, setResent] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const tick = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(tick);
  }, [done]);

  const expired = left === 0;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  function verify() {
    if (expired) {
      setError("코드가 만료됐어요. 코드를 다시 받아 주세요.");
      return;
    }
    if (code !== DEMO_OTP) {
      setError("코드가 일치하지 않아요. 다시 입력하거나 코드를 다시 받아 주세요.");
      return;
    }
    setError("");
    setDone(true);
  }

  function resend() {
    setResent(true);
    setLeft(OTP_TTL_SEC);
    setCode("");
    setError("");
    setTimeout(() => setResent(false), 2200);
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`${method.name} 등록`}
      footer={
        !done && (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              취소
            </Button>
            <Button disabled={code.length !== 6} onClick={verify} title={code.length === 6 ? undefined : "6자리를 모두 입력해 주세요"}>
              <IconShield size={15} />
              확인하고 등록
            </Button>
          </div>
        )
      }
    >
      {done ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <IconCheckCircle size={40} className="text-emerald-600" />
          {/* 이름 뒤에 조사를 붙이지 않는다 — 수단 이름이 바뀌면 조사가 어긋난다 */}
          <p className="mt-3 text-sm font-semibold text-slate-900">{method.name} 등록을 마쳤어요</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            다음 로그인부터 2단계 인증을 거칩니다.
          </p>
          <Button className="mt-5" onClick={onVerified}>
            확인
          </Button>
        </div>
      ) : (
        <div className="space-y-4 p-5">
          <p className="flex items-start gap-2.5 text-sm leading-[1.6] text-slate-600">
            {method.sentTo ? (
              <IconMail size={16} className="mt-0.5 shrink-0 text-slate-400" />
            ) : (
              <IconKey size={16} className="mt-0.5 shrink-0 text-slate-400" />
            )}
            <span>
              {method.sentTo ? (
                <>
                  <span className="font-semibold text-slate-900">{target}</span> {method.sentTo} 6자리
                  코드를 보냈어요. 아래에 입력하면 등록이 끝납니다.
                </>
              ) : (
                "인증 앱에 표시된 6자리 코드를 입력하면 등록이 끝납니다."
              )}
            </span>
          </p>

          <div>
            <label htmlFor="otp-code" className="mb-1.5 block text-sm font-medium text-slate-700">
              인증 코드 6자리
            </label>
            <input
              id="otp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                setError("");
              }}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? "otp-error" : "otp-hint"}
              className={`${error ? FIELD_ERROR : FIELD} text-center text-lg font-semibold tracking-[0.4em] tabular-nums`}
            />
            {error ? (
              <p id="otp-error" className="mt-1.5 text-xs text-red-600">
                {error}
              </p>
            ) : (
              <p id="otp-hint" className="mt-1.5 text-xs text-slate-400">
                데모 코드는 {DEMO_OTP} 입니다.
              </p>
            )}
          </div>

          <div
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3"
            role="status"
            aria-live="polite"
          >
            <span className="text-xs text-slate-600">
              {expired ? (
                "코드가 만료됐어요."
              ) : (
                <>
                  <span className="font-medium tabular-nums text-slate-900">
                    {mm}:{ss}
                  </span>{" "}
                  후 만료
                </>
              )}
            </span>
            <button
              type="button"
              disabled={resent}
              onClick={resend}
              className="cursor-pointer text-xs font-semibold text-primary-600 transition-colors hover:text-primary-700 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {resent ? "코드를 다시 보냈어요" : "코드 다시 받기"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}


/**
 * 계정 › 이메일 관리.
 *
 * BE에는 **대표 이메일 재인증만** 있다 (`POST /api/auth/email/verify-request`).
 * 추가 이메일 API가 없어서 `이메일 추가`와 추가 주소의 `삭제`는 비활성으로 둔다 —
 * 앞으로 무엇이 오는지는 보이고, BE가 생기면 `disabled`를 떼는 것으로 끝난다.
 */
export function EmailModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="이메일 관리"
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button variant="secondary" size="sm" disabled>
            <IconMail size={14} />
            이메일 추가
          </Button>
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
        </div>
      }
    >
      <ul className="divide-y divide-slate-100 p-5">
        {ACCOUNT_EMAILS.map((e) => (
          <li key={e.address} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-mono text-[13px] text-slate-900">
                {e.address}
                {e.primary && <Badge tone="slate">대표</Badge>}
              </p>
              {!e.verified && e.sentAt && (
                <p className="mt-0.5 text-xs text-slate-400">{e.sentAt}에 인증 메일을 보냈어요</p>
              )}
            </div>
            <Badge tone={e.verified ? "green" : "amber"}>
              {e.verified ? "인증됨" : "인증 대기"}
            </Badge>
            {e.primary ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDone("인증 메일을 다시 보냈어요")}
              >
                인증 메일 보내기
              </Button>
            ) : (
              /* 추가 이메일 삭제 API가 없다 */
              <Button variant="ghost" size="sm" disabled>
                삭제
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}

/**
 * 계정 › 2단계 인증.
 *
 * **BE에 있는 건 이메일 OTP 하나뿐이다** (`mfa/email`). SMS·인증 앱은 자리만 두고
 * 비활성으로 둔다 — 목록에서 지우면 앞으로 무엇이 오는지 보이지 않는다.
 *
 * 켤 때는 코드 확인을 거친다(`OtpEnrollModal`). 끄는 것은 여기서 즉시 반영하지만,
 * **BE는 해제에 비밀번호를 다시 묻는다**(`DELETE /api/auth/mfa/email`) — 연동할 때
 * 비밀번호 확인 단계를 앞에 붙여야 한다.
 */
export function TfaModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [tfa, setTfa] = useState<TfaState>({ email: false, sms: false, totp: false });
  const [enrolling, setEnrolling] = useState<TfaId | null>(null);

  /** 발송 대상 — 프로필 값을 읽는다. 예전에는 이 자리에 번호가 하드코딩돼 있었다 */
  const targets: Record<TfaId, string> = {
    email: DEMO_USER.email,
    sms: DEMO_USER.phone,
    totp: "인증 앱",
  };

  /** BE에 있는 수단만 켤 수 있다 */
  const available: Record<TfaId, boolean> = { email: true, sms: false, totp: false };

  const pending = TFA_METHODS.find((m) => m.id === enrolling);

  function toggle(id: TfaId, next: boolean) {
    if (next) {
      setEnrolling(id);
      return;
    }
    setTfa((t) => applyTfa(t, id, false));
    // BE 연동 seam: 해제는 비밀번호 재확인을 먼저 받아야 한다
    onDone(`${TFA_METHODS.find((m) => m.id === id)?.name ?? "2단계 인증"}을 껐어요`);
  }

  return (
    <>
      <Modal
        open={open && !pending}
        onClose={onClose}
        size="md"
        title="2단계 인증"
        footer={
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              닫기
            </Button>
          </div>
        }
      >
        <ul className="divide-y divide-slate-100 p-5">
          {TFA_METHODS.map((m) => {
            const usable = available[m.id];
            return (
              <li key={m.id} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
                <IconShield size={16} className="shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-slate-900">{m.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {m.sentTo ? `${targets[m.id]} ${m.sentTo} 6자리 코드를 보내요` : m.desc}
                  </p>
                </div>
                <Toggle
                  checked={tfa[m.id]}
                  onChange={(v) => toggle(m.id, v)}
                  label={m.name}
                  disabled={!usable}
                />
              </li>
            );
          })}
        </ul>
      </Modal>

      {pending && (
        <OtpEnrollModal
          key={pending.id}
          method={pending}
          target={targets[pending.id]}
          onClose={() => setEnrolling(null)}
          onVerified={() => {
            setTfa((t) => applyTfa(t, pending.id, true));
            setEnrolling(null);
            onDone(`${pending.name}을 켰어요`);
          }}
        />
      )}
    </>
  );
}

/**
 * 계정 › 로그인 방법 관리 — 소셜 연동 상태.
 *
 * **제공자는 `lib/auth.ts`의 `SocialProvider`가 단일 소스다** — Google·네이버 둘뿐이다.
 * Microsoft·Kakao를 넣지 않는 이유는 그 제공자가 없어서다. 눌러도 아무 일이 일어나지 않는
 * 항목을 목록에 두지 않는다.
 *
 * **연동·해제 API가 BE에 없다.** 상태만 보이고 버튼은 비활성으로 둔다. 브랜드 로고도 쓰지
 * 않는다 — `BrandIcon`은 `public/brands/<slug>`를 그리는데 `google`·`naver` 마크가 없다.
 */
export function SocialModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="로그인 방법 관리"
      footer={
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
        </div>
      }
    >
      <ul className="divide-y divide-slate-100 p-5">
        {SOCIAL_LOGINS.map((s) => (
          <li key={s.provider} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
            <IconLock size={16} className="shrink-0 text-slate-400" />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-slate-900">
                {PROVIDER_LABELS[s.provider]}
              </p>
              {s.account && <p className="mt-0.5 truncate text-xs text-slate-400">{s.account}</p>}
            </div>
            {s.connected && <Badge tone="green">연동됨</Badge>}
            <Button variant="ghost" size="sm" disabled>
              {s.connected ? "해제" : "연동하기"}
            </Button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
