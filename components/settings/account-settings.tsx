"use client";

import { useState } from "react";
import { IconCheck, IconKey, IconLock, IconShield } from "@/components/icons";
import { Badge, Button, Card, SectionHeader, Toggle } from "@/components/ui";
import { DEMO_USER } from "@/data/org";

const FIELD =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-400 focus:outline-2 focus:outline-slate-300/60";

const TFA_METHODS = [
  { id: "email", name: "이메일 OTP", desc: "로그인 시 이메일로 6자리 코드 발송" },
  { id: "sms", name: "SMS OTP", desc: "휴대전화 문자로 인증 코드 발송" },
  { id: "totp", name: "Google Authenticator", desc: "인증 앱 기반 TOTP" },
];

export function AccountSettings() {
  const [saved, setSaved] = useState(false);
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
        <SectionHeader
          title={
            <span className="flex items-center gap-2">
              <IconLock size={16} className="text-slate-400" /> 비밀번호 변경
            </span>
          }
          desc="현재 비밀번호 확인 후 변경됩니다. 8자 이상, 대문자·숫자·특수문자를 포함해야 합니다."
        />
        <form className="grid gap-4 sm:grid-cols-3" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label htmlFor="pw-cur" className="mb-1.5 block text-sm font-medium text-slate-700">
              현재 비밀번호
            </label>
            <input id="pw-cur" type="password" autoComplete="current-password" className={FIELD} />
          </div>
          <div>
            <label htmlFor="pw-new" className="mb-1.5 block text-sm font-medium text-slate-700">
              새 비밀번호
            </label>
            <input id="pw-new" type="password" autoComplete="new-password" className={FIELD} />
          </div>
          <div>
            <label htmlFor="pw-new2" className="mb-1.5 block text-sm font-medium text-slate-700">
              새 비밀번호 확인
            </label>
            <input id="pw-new2" type="password" autoComplete="new-password" className={FIELD} />
          </div>
          <div className="sm:col-span-3">
            <Button variant="secondary">
              <IconKey size={15} />
              비밀번호 변경
            </Button>
          </div>
        </form>
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
    </div>
  );
}
