"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { IconCheck, IconCheckCircle, IconEye, IconEyeOff, IconKey, IconLock, IconMail, IconShield, IconX } from "@/components/icons";
import { Badge, Button, Card, FIELD, FIELD_ERROR, SectionHeader, Toggle } from "@/components/ui";
import { DEMO_USER } from "@/data/org";

type TfaId = "email" | "sms" | "totp";

/** `sentTo` — 발송 대상 뒤에 붙는 조사. 이메일 주소·번호에 조사를 직접 붙이면 어긋난다 */
const TFA_METHODS: { id: TfaId; name: string; desc: string; sentTo?: string }[] = [
  { id: "email", name: "이메일 OTP", desc: "로그인 시 이메일로 6자리 코드 발송", sentTo: "주소로" },
  { id: "sms", name: "SMS OTP", desc: "휴대전화 문자로 인증 코드 발송", sentTo: "번호로" },
  { id: "totp", name: "Google Authenticator", desc: "인증 앱 기반 TOTP" },
];

/** 데모 검증 코드 — BE 연동 시 서버가 발송·검증한다 (코드는 서버에만 존재해야 한다) */
const DEMO_OTP = "123456";
const OTP_TTL_SEC = 180;

type TfaState = Record<TfaId, boolean>;

/**
 * 이메일 OTP는 유일한 복구 수단이라 **가장 먼저 등록해야** 한다.
 * 이메일을 끄면 나머지 수단도 함께 꺼진다 — 계정이 잠기는 조합을 만들지 않는다.
 */
function applyTfa(tfa: TfaState, id: TfaId, on: boolean): TfaState {
  if (id === "email" && !on) return { email: false, sms: false, totp: false };
  return { ...tfa, [id]: on };
}

/**
 * 비밀번호 변경 팝업 — Assisted Password Confirmation:
 * 규칙 충족 여부와 확인 입력 일치를 실시간으로 보여준다.
 */
function PasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [cur, setCur] = useState("");
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
  const canSubmit = !!cur && valid && match;

  function close() {
    setCur("");
    setPw("");
    setPw2("");
    setShow(false);
    setDone(false);
    onClose();
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
              취소
            </Button>
            <Button
              disabled={!canSubmit}
              onClick={() => setDone(true)}
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
          </div>
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
function OtpEnrollModal({
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

export function AccountSettings() {
  const [saved, setSaved] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [tfa, setTfa] = useState<TfaState>({ email: false, sms: false, totp: false });
  const [enrolling, setEnrolling] = useState<TfaId | null>(null);

  const on = Object.values(tfa).some(Boolean);
  const pending = TFA_METHODS.find((m) => m.id === enrolling);
  /** 발송 대상 — 데모 값이다. 실제로는 서버가 보유한 연락처로 보낸다 */
  const targets: Record<TfaId, string> = {
    email: DEMO_USER.email,
    sms: "010-1234-5678",
    totp: "인증 앱",
  };

  function toggle(id: TfaId, next: boolean) {
    // 켜는 것은 코드 확인을 거치고, 끄는 것은 즉시 반영한다.
    // ponytail: 데모라 해제 시 재인증이 없다. BE 연동 시 해제도 재인증 대상이다.
    if (next) setEnrolling(id);
    else setTfa((t) => applyTfa(t, id, false));
  }

  return (
    <div className="space-y-5">
      <Card>
        <SectionHeader title="프로필 관리" />
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex flex-col items-center gap-2">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-xl font-bold text-white">
              {DEMO_USER.initials}
            </span>
            <Button variant="secondary" size="sm">
              사진 변경
            </Button>
          </div>
          <form
            className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            }}
          >
            <div>
              <label htmlFor="acc-name" className="mb-1.5 block text-sm font-medium text-slate-700">
                이름
              </label>
              <input id="acc-name" defaultValue={DEMO_USER.name} className={FIELD} />
            </div>
            <div>
              <label htmlFor="acc-title" className="mb-1.5 block text-sm font-medium text-slate-700">
                직책
              </label>
              <input id="acc-title" defaultValue={DEMO_USER.title} className={FIELD} />
            </div>
            <div>
              <label htmlFor="acc-email" className="mb-1.5 block text-sm font-medium text-slate-700">
                이메일
              </label>
              <input id="acc-email" defaultValue={DEMO_USER.email} disabled className={`${FIELD} bg-slate-50 text-slate-400`} />
            </div>
            <div>
              <label htmlFor="acc-phone" className="mb-1.5 block text-sm font-medium text-slate-700">
                연락처
              </label>
              <input id="acc-phone" defaultValue="010-1234-5678" className={FIELD} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">
                {saved && <IconCheck size={15} />}
                {saved ? "저장되었습니다" : "변경사항 저장"}
              </Button>
            </div>
          </form>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <IconLock size={16} className="text-slate-400" /> 비밀번호
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">마지막 변경 2026-05-14 · 주기적으로 변경하면 더 안전해요.</p>
          </div>
          <Button variant="secondary" onClick={() => setPwOpen(true)}>
            <IconKey size={15} />
            비밀번호 변경
          </Button>
        </div>
      </Card>

      <Card>
        <SectionHeader
          title={
            <span className="flex items-center gap-2">
              <IconShield size={16} className="text-slate-400" /> 2단계 인증 설정
              <Badge tone={on ? "green" : "red"}>{on ? "활성화됨" : "비활성화"}</Badge>
            </span>
          }
          desc={
            tfa.email
              ? "수단을 켜면 코드 확인을 거쳐 등록됩니다."
              : "이메일 OTP를 먼저 등록해야 다른 수단을 쓸 수 있어요. 계정을 되찾는 수단이라 그렇습니다."
          }
        />
        <ul className="divide-y divide-slate-100">
          {TFA_METHODS.map((m) => {
            const locked = m.id !== "email" && !tfa.email;
            return (
              <li key={m.id} className="flex items-center justify-between gap-3 py-3.5">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{m.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {locked ? "이메일 OTP 등록 후 사용할 수 있어요." : m.desc}
                  </p>
                </div>
                <Toggle
                  checked={tfa[m.id]}
                  disabled={locked}
                  onChange={(v) => toggle(m.id, v)}
                  label={`${m.name} 사용`}
                />
              </li>
            );
          })}
        </ul>
      </Card>

      <PasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
      {pending && (
        <OtpEnrollModal
          key={pending.id}
          method={pending}
          target={targets[pending.id]}
          onClose={() => setEnrolling(null)}
          onVerified={() => {
            setTfa((t) => applyTfa(t, pending.id, true));
            setEnrolling(null);
          }}
        />
      )}
    </div>
  );
}
