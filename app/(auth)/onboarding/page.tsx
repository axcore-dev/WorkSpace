"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { AiBadge, Badge, Button, Card, Toggle } from "@/components/ui";
import { ICON_MAP, IconCheck, IconCheckCircle, IconChevronLeft } from "@/components/icons";
import { EXTERNAL_SYSTEMS, MODULES } from "@/data/modules";
import {
  defaultModuleState,
  saveModuleState,
  saveSelectedSystems,
  type ModuleState,
} from "@/lib/module-state";

const STEPS = ["외부 시스템 선택", "추천 구성 검토", "확정"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [none, setNone] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [modState, setModState] = useState<ModuleState>(defaultModuleState);

  const duplicated = useMemo(
    () => EXTERNAL_SYSTEMS.filter((s) => selected.includes(s.id)).map((s) => s.duplicatesModule),
    [selected],
  );

  function toggleSystem(id: string) {
    setNone(false);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function goToReview() {
    const next = defaultModuleState();
    for (const slug of duplicated) {
      next[slug].enabled = false;
      for (const sub of Object.keys(next[slug].subs)) next[slug].subs[sub] = false;
    }
    setModState(next);
    setStep(1);
  }

  function toggleModule(slug: string, on: boolean) {
    setModState((prev) => ({
      ...prev,
      [slug]: { enabled: on, subs: Object.fromEntries(Object.keys(prev[slug].subs).map((k) => [k, on])) },
    }));
  }

  function toggleSub(slug: string, sub: string, on: boolean) {
    setModState((prev) => {
      const subs = { ...prev[slug].subs, [sub]: on };
      return { ...prev, [slug]: { enabled: Object.values(subs).some(Boolean), subs } };
    });
  }

  function confirm() {
    saveModuleState(modState);
    saveSelectedSystems(selected);
    router.push("/dashboard");
  }

  const onCount = MODULES.filter((m) => modState[m.slug].enabled).length;
  const subOnCount = MODULES.flatMap((m) => Object.values(modState[m.slug].subs).filter(Boolean)).length;
  const subTotal = MODULES.reduce((a, m) => a + m.subfunctions.length, 0);

  return (
    <AuthShell>
      <div className="w-full max-w-3xl">
        {/* 단계 표시기 (무채색) */}
        <ol className="mb-6 flex items-center justify-center gap-2" aria-label="온보딩 진행 단계">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  i <= step ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                {i < step ? <IconCheck size={13} /> : i + 1}
              </span>
              <span className={`text-sm ${i === step ? "font-semibold text-slate-900" : "text-slate-500"}`}>
                {label}
              </span>
              {i < STEPS.length - 1 && <span className="mx-1 h-px w-8 bg-slate-300" />}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <Card className="p-8">
            <h1 className="text-lg font-bold text-slate-900">온보딩 위저드 — 외부 시스템 선택</h1>
            <p className="mt-1 text-sm text-slate-500">
              사용 중인 외부 시스템을 선택하면 중복되는 자사 모듈의 OFF를 자동 추천합니다. 데모에서는
              바로 다음으로 넘어가도 됩니다.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {EXTERNAL_SYSTEMS.map((sys) => {
                const active = selected.includes(sys.id);
                return (
                  <button
                    key={sys.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleSystem(sys.id)}
                    className={`cursor-pointer rounded-lg border p-4 text-left transition-colors duration-200 ${
                      active
                        ? "border-slate-400 bg-slate-50 ring-1 ring-slate-300"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <p className="flex items-center justify-between text-sm font-semibold text-slate-900">
                      {sys.name}
                      {active && <IconCheck size={15} className="text-slate-700" />}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{sys.desc}</p>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              aria-pressed={none}
              onClick={() => {
                setNone(!none);
                setSelected([]);
              }}
              className={`mt-3 w-full cursor-pointer rounded-lg border p-4 text-left transition-colors duration-200 ${
                none
                  ? "border-slate-400 bg-slate-50 ring-1 ring-slate-300"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <p className="flex items-center justify-between text-sm font-semibold text-slate-900">
                보유 시스템 없음 (0개)
                {none && <IconCheck size={15} className="text-slate-700" />}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">자사 8대 핵심 모듈 전체 ON 기본 구성으로 시작합니다.</p>
            </button>
            <div className="mt-6 flex justify-end">
              <Button size="lg" onClick={goToReview}>
                다음 — 추천 구성 확인
              </Button>
            </div>
          </Card>
        )}

        {step === 1 && (
          <Card className="p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-bold text-slate-900">추천 구성 검토 및 조정</h1>
                <p className="mt-1 text-sm text-slate-500">
                  서브기능 단위로 조정할 수 있습니다. OFF 상태에서도 데이터는 보존됩니다.
                </p>
              </div>
              {duplicated.length > 0 && (
                <span className="shrink-0 text-xs font-semibold text-amber-600">
                  중복 모듈 {duplicated.length}개 OFF 추천됨
                </span>
              )}
            </div>

            <ul className="mt-6 space-y-3">
              {MODULES.map((mod) => {
                const Icon = ICON_MAP[mod.icon];
                const st = modState[mod.slug];
                const recommended = duplicated.includes(mod.slug);
                return (
                  <li key={mod.slug} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Icon size={18} className={`shrink-0 ${st.enabled ? "text-slate-700" : "text-slate-300"}`} />
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                            {mod.name}
                            {recommended && (
                              <Badge tone="amber">외부 {mod.externalSystem} 보유 — OFF 추천</Badge>
                            )}
                          </p>
                          <p className="truncate text-xs text-slate-500">{mod.summary}</p>
                        </div>
                      </div>
                      <Toggle
                        checked={st.enabled}
                        onChange={(v) => toggleModule(mod.slug, v)}
                        label={`${mod.name} 모듈 활성화`}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                      {mod.subfunctions.map((sub) => {
                        const on = st.subs[sub.id];
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggleSub(mod.slug, sub.id, !on)}
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
                              on
                                ? "border-slate-300 bg-slate-100 text-slate-700"
                                : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
                            }`}
                          >
                            {sub.name}
                            {sub.ai && <AiBadge />}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep(0)}>
                <IconChevronLeft size={16} /> 이전
              </Button>
              <Button size="lg" onClick={() => setStep(2)}>
                구성 확정하기
              </Button>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card className="p-8 text-center">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center text-slate-400">
              <IconCheckCircle size={40} />
            </span>
            <h1 className="text-lg font-bold text-slate-900">구성이 준비되었습니다</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
              모듈 <strong className="text-slate-700">{onCount}/8개 ON</strong> · 서브기능{" "}
              <strong className="text-slate-700">
                {subOnCount}/{subTotal}개 ON
              </strong>
              . 확정 즉시 좌측 패널과 비즈니스 현황 위젯에 반영되며, 이후 변경은 프로필 &gt; 설정에서 할
              수 있습니다.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button variant="secondary" onClick={() => setStep(1)}>
                <IconChevronLeft size={16} /> 다시 조정
              </Button>
              <Button size="lg" onClick={confirm}>
                워크스페이스 시작하기
              </Button>
            </div>
            <p className="mt-4 text-xs text-slate-400">확정 이력은 감사 로그에 기록됩니다.</p>
          </Card>
        )}
      </div>
    </AuthShell>
  );
}
