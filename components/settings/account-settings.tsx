"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { IconCheck, IconCheckCircle, IconEye, IconEyeOff, IconKey, IconLock, IconShield, IconX } from "@/components/icons";
import { Badge, Button, Card, FIELD, SectionHeader, Toggle } from "@/components/ui";
import { DEMO_USER } from "@/data/org";

const TFA_METHODS = [
  { id: "email", name: "이메일 OTP", desc: "로그인 시 이메일로 6자리 코드 발송" },
  { id: "sms", name: "SMS OTP", desc: "휴대전화 문자로 인증 코드 발송" },
  { id: "totp", name: "Google Authenticator", desc: "인증 앱 기반 TOTP" },
];

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
      desc="현재 비밀번호 확인 후 새 비밀번호로 변경됩니다."
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

export function AccountSettings() {
  const [saved, setSaved] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [tfa, setTfa] = useState<Record<string, boolean>>({ email: true, sms: false, totp: false });

  return (
    <div className="space-y-5">
      <Card>
        <SectionHeader title="프로필 관리" desc="이름·직책·연락처 등 개인 정보를 관리합니다." />
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
              <Badge tone={Object.values(tfa).some(Boolean) ? "green" : "red"}>
                {Object.values(tfa).some(Boolean) ? "활성화됨" : "비활성화"}
              </Badge>
            </span>
          }
          desc="로그인 시 추가 인증 단계를 요구해 계정을 보호합니다."
        />
        <ul className="divide-y divide-slate-100">
          {TFA_METHODS.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-3.5">
              <div>
                <p className="text-sm font-semibold text-slate-800">{m.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{m.desc}</p>
              </div>
              <Toggle checked={tfa[m.id]} onChange={(v) => setTfa({ ...tfa, [m.id]: v })} label={`${m.name} 사용`} />
            </li>
          ))}
        </ul>
      </Card>

      <PasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}
