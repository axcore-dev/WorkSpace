"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { Button, Card } from "@/components/ui";
import { IconBuilding, IconCheck } from "@/components/icons";
import { CONSENT_TEXT, DEFAULT_WORKSPACE_ID, WORKSPACES } from "@/data/org";

export default function WorkspacePage() {
  const router = useRouter();
  // 데모: 데모컴퍼니가 기본 선택됨
  const [selected, setSelected] = useState(DEFAULT_WORKSPACE_ID);
  const [showConsent, setShowConsent] = useState(false);

  function persistAndContinue() {
    const ws = WORKSPACES.find((w) => w.id === selected) ?? WORKSPACES[0];
    localStorage.setItem(
      "axpoint-workspace",
      JSON.stringify({ id: ws.id, name: ws.name, role: ws.role }),
    );
    router.push("/onboarding");
  }

  return (
    <AuthShell>
      <Card className="w-full max-w-md p-8">
        <h1 className="text-lg font-bold text-slate-900">워크스페이스 선택</h1>
        <p className="mt-1 text-sm text-slate-500">
          소속 조직을 선택하고 시작하세요. 데모에서는 <span className="font-medium text-slate-700">(주)데모컴퍼니</span>가
          기본 선택되어 있습니다.
        </p>

        <ul className="mt-6 space-y-2" role="radiogroup" aria-label="워크스페이스">
          {WORKSPACES.map((ws) => {
            const active = selected === ws.id;
            return (
              <li key={ws.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelected(ws.id)}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-lg border p-3.5 text-left transition-colors duration-150 ${
                    active
                      ? "border-slate-400 bg-slate-50 ring-1 ring-slate-300"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <IconBuilding size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{ws.name}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {ws.role} · {ws.plan}
                    </span>
                  </span>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      active ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300"
                    }`}
                  >
                    {active && <IconCheck size={12} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input type="checkbox" defaultChecked className="mt-0.5 h-4 w-4 accent-slate-800" />
            <span className="text-sm text-slate-600">
              법인(신용)정보 수집·이용에 동의합니다.{" "}
              <button
                type="button"
                onClick={() => setShowConsent(!showConsent)}
                className="cursor-pointer font-medium text-primary-600 hover:text-primary-700"
              >
                {showConsent ? "접기" : "보기"}
              </button>
            </span>
          </label>
          {showConsent && (
            <dl className="thin-scroll mt-3 max-h-40 space-y-2 overflow-y-auto border-t border-slate-200 pt-3 pr-1">
              {CONSENT_TEXT.sections.map((s) => (
                <div key={s.heading}>
                  <dt className="text-xs font-semibold text-slate-700">{s.heading}</dt>
                  <dd className="mt-0.5 text-xs leading-relaxed text-slate-500">{s.body}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <Button size="lg" className="mt-5 w-full" onClick={persistAndContinue}>
          선택한 워크스페이스로 계속
        </Button>
        <p className="mt-3 text-center text-xs text-slate-400">
          {CONSENT_TEXT.version} · 동의 이력은 감사 로그에 기록됩니다.
        </p>
      </Card>
    </AuthShell>
  );
}
