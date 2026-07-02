"use client";

import { useState } from "react";
import Link from "next/link";
import { GaugeChart } from "@/components/charts";
import {
  IconActivity,
  IconAlertTriangle,
  IconArrowRight,
  IconCalendar,
  IconCheck,
  IconCheckCircle,
  IconClock,
  IconGauge,
  IconWrench,
  IconZap,
} from "@/components/icons";
import { AiBadge, Badge, Button, Card, ProgressBar, SectionHeader } from "@/components/ui";
import {
  ACTION_TRACKING,
  ANOMALIES,
  OPTIMIZATION,
  PREDICTIONS,
  STAGE_TONE,
  type ActionStage,
} from "@/data/diagnosis";

const TABS = [
  { id: "anomaly", label: "이상 징후 탐지", icon: IconAlertTriangle },
  { id: "predict", label: "설비 예지보전", icon: IconWrench },
  { id: "schedule", label: "스케줄링 최적화", icon: IconZap },
  { id: "actions", label: "조치 이행 추적", icon: IconCheckCircle },
] as const;

type TabId = (typeof TABS)[number]["id"];
const STAGES: ActionStage[] = ["제안", "승인", "이행", "완료"];

export default function AiDiagnosisPage() {
  const [tab, setTab] = useState<TabId>("anomaly");
  const [scheduled, setScheduled] = useState<Record<string, boolean>>(
    Object.fromEntries(PREDICTIONS.map((p) => [p.id, p.scheduled])),
  );
  const [optApplied, setOptApplied] = useState(false);
  const [actions, setActions] = useState(ACTION_TRACKING);

  function advance(id: string) {
    setActions((prev) =>
      prev.map((a) =>
        a.id === id && a.stage !== "완료"
          ? { ...a, stage: STAGES[STAGES.indexOf(a.stage) + 1] }
          : a,
      ),
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <IconActivity size={24} className="text-slate-700" />
          <div className="flex items-center gap-2">
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900">
              AI진단 <AiBadge />
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              이상탐지 · 예지보전 · 최적화 통합 허브 — 이상 징후는 탐지 후 1분 이내 알림됩니다
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-center">
          <div>
            <p className="text-lg font-bold text-red-600">2</p>
            <p className="text-[11px] text-slate-500">긴급·경고</p>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <p className="text-lg font-bold text-emerald-600">+6.8%</p>
            <p className="text-[11px] text-slate-500">최적화 기대 효율</p>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <p className="text-lg font-bold text-slate-900">83%</p>
            <p className="text-[11px] text-slate-500">예측 정확도(90일)</p>
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="mb-5 flex flex-wrap gap-1 border-b border-slate-200" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px inline-flex cursor-pointer items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150 ${
              tab === t.id
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 이상 징후 탐지 ── */}
      {tab === "anomaly" && (
        <div className="space-y-4">
          {ANOMALIES.map((an) => (
            <Card key={an.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <Badge tone={an.severity} dot className="mt-0.5 shrink-0">
                    {an.severityLabel}
                  </Badge>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900">{an.title}</h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {an.source} · {an.detectedAt}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-400">{an.id}</span>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 px-3.5 py-2.5">
                  <dt className="text-xs font-semibold text-slate-500">추정 원인</dt>
                  <dd className="mt-0.5 text-slate-700">{an.cause}</dd>
                </div>
                <div className="rounded-xl bg-slate-50 px-3.5 py-2.5">
                  <dt className="text-xs font-semibold text-slate-500">영향도</dt>
                  <dd className="mt-0.5 text-slate-700">{an.impact}</dd>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                  <dt className="text-xs font-semibold text-slate-600">권장 조치</dt>
                  <dd className="mt-0.5 text-slate-700">{an.action}</dd>
                </div>
              </dl>
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-400">알림 발송: {an.notified.join(" · ")}</p>
                <Link
                  href="/modules/production"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-700"
                >
                  관련 모듈로 이동 <IconArrowRight size={13} />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── 설비 예지보전 ── */}
      {tab === "predict" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            센서 데이터를 분석해 고장을 24시간 전에 80% 이상 정확도로 예측합니다. 권고 승인 시
            장비관리 &gt; 정비 관리에 일정이 원클릭 등록됩니다.
          </p>
          <div className="grid gap-4 lg:grid-cols-3">
            {PREDICTIONS.map((p) => (
              <Card key={p.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900">{p.equipment}</h3>
                  <Badge tone={p.tone} dot>
                    {p.window}
                  </Badge>
                </div>
                <div className="my-3 flex justify-center">
                  <GaugeChart
                    value={p.risk}
                    label="고장 확률"
                    tone={p.tone === "red" ? "#ef4444" : p.tone === "amber" ? "#f59e0b" : "#94a3b8"}
                  />
                </div>
                <dl className="space-y-2 text-xs">
                  <div>
                    <dt className="font-semibold text-slate-500">예측 근거</dt>
                    <dd className="mt-0.5 text-slate-600">{p.basis}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">권고 조치</dt>
                    <dd className="mt-0.5 text-slate-600">{p.recommendation}</dd>
                  </div>
                </dl>
                <div className="mt-auto pt-4">
                  {scheduled[p.id] ? (
                    <p className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 py-2 text-xs font-medium text-slate-600">
                      <IconCheck size={14} className="text-emerald-600" /> 정비 일정 등록됨 — 정비 관리에서 확인
                    </p>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => setScheduled((s) => ({ ...s, [p.id]: true }))}
                    >
                      <IconCalendar size={14} />
                      정비 일정 등록
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── 스케줄링 최적화 ── */}
      {tab === "schedule" && (
        <div className="space-y-4">
          <Card>
            <SectionHeader
              title={
                <span className="flex items-center gap-2">
                  최적화안 {OPTIMIZATION.id} <AiBadge />
                </span>
              }
              desc={OPTIMIZATION.summary}
              action={
                optApplied ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-600">
                    <IconCheck size={15} className="text-emerald-600" /> 작업지시에 반영됨
                  </span>
                ) : (
                  <Button onClick={() => setOptApplied(true)}>
                    <IconZap size={15} />
                    최적화안 적용
                  </Button>
                )
              }
            />
            <div className="grid gap-4 md:grid-cols-2">
              {[OPTIMIZATION.currentPlan, OPTIMIZATION.aiPlan].map((plan, i) => {
                const isAi = i === 1;
                return (
                  <div
                    key={plan.label}
                    className={`rounded-xl border p-4 ${
                      isAi ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      {plan.label}
                      {isAi && (
                        <Badge tone="violet">효율 +{(plan.efficiency - 100).toFixed(1)}%</Badge>
                      )}
                    </p>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <dt className="text-[11px] text-slate-500">리드타임</dt>
                        <dd className="mt-0.5 text-sm font-bold text-slate-900">{plan.leadTime}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-slate-500">비용</dt>
                        <dd className="mt-0.5 text-sm font-bold text-slate-900">{plan.cost}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-slate-500">설비 가동률</dt>
                        <dd className="mt-0.5 text-sm font-bold text-slate-900">{plan.utilization}</dd>
                      </div>
                    </dl>
                    <div className="mt-3">
                      <ProgressBar value={plan.efficiency - 20} tone={isAi ? "violet" : "slate"} />
                      <p className="mt-1 text-right text-[11px] text-slate-400">
                        상대 효율 {plan.efficiency}%
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-500">주요 변경 사항</p>
              <ul className="mt-1.5 space-y-1.5">
                {OPTIMIZATION.changes.map((c) => (
                  <li key={c} className="flex items-start gap-2 text-sm text-slate-600">
                    <IconGauge size={14} className="mt-0.5 shrink-0 text-primary-500" />
                    {c}
                  </li>
                ))}
              </ul>
              <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
                {OPTIMIZATION.note} 목표: 기존 대비 생산 효율 최소 5% 이상 향상.
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* ── 조치 이행 추적 ── */}
      {tab === "actions" && (
        <Card>
          <SectionHeader
            title="권장 조치 이행 추적"
            desc="AI 분석 결과 기반 액션 아이템의 상태(제안→승인→이행→완료)를 추적합니다."
          />
          <ul className="divide-y divide-slate-100">
            {actions.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                    <span>{a.origin}</span>·<span>담당 {a.owner}</span>·
                    <span className="inline-flex items-center gap-1">
                      <IconClock size={11} /> {a.due}
                    </span>
                  </p>
                </div>
                {/* 단계 표시 */}
                <div className="flex items-center gap-1" aria-label={`현재 단계: ${a.stage}`}>
                  {STAGES.map((s, i) => {
                    const reached = STAGES.indexOf(a.stage) >= i;
                    return (
                      <span key={s} className="flex items-center gap-1">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            reached ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          {s}
                        </span>
                        {i < STAGES.length - 1 && <span className="h-px w-2 bg-slate-200" />}
                      </span>
                    );
                  })}
                </div>
                <Badge tone={STAGE_TONE[a.stage]} dot>
                  {a.stage}
                </Badge>
                {a.stage !== "완료" ? (
                  <Button size="sm" variant="secondary" onClick={() => advance(a.id)}>
                    다음 단계로
                  </Button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                    <IconCheckCircle size={14} /> 완료됨
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
