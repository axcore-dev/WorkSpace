"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart, ChartFromSpec, DonutChart, LineChart, Sparkline } from "@/components/charts";
import {
  IconArrowDownRight,
  IconArrowRight,
  IconArrowUpRight,
  IconCheck,
  IconChevronDown,
  IconPlus,
  IconRefresh,
  IconX,
} from "@/components/icons";
import { Modal } from "@/components/modal";
import { useModules } from "@/components/module-provider";
import { Badge, Button, Card, DataTable, ProgressBar, SectionHeader } from "@/components/ui";
import {
  AI_ALERTS,
  DASHBOARD_KPIS,
  EQUIPMENT_STATUS,
  INVENTORY_HIGHLIGHT,
  LINE_STATUS,
  PRODUCTION_TREND,
} from "@/data/dashboard";
import { MODULE_BY_SLUG, MODULES } from "@/data/modules";
import { MODULE_PAGES } from "@/data/module-pages";
import type { ChartSpec } from "@/data/types";

export default function DashboardPage() {
  const { state } = useModules();
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [syncedAgo, setSyncedAgo] = useState("3초 전");
  const [alertShown, setAlertShown] = useState(true);
  const [alertMin, setAlertMin] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [added, setAdded] = useState<string[]>([]);

  const kpis = DASHBOARD_KPIS.filter((k) => state[k.moduleSlug]?.enabled);
  const showProduction = state.production?.enabled;
  const showEquipment = state.equipment?.enabled;
  const showInventory = state.inventory?.enabled;

  // 핵심 기능(ON 모듈)에서 끌어올 수 있는 그래프 위젯 목록
  const availableWidgets = useMemo(() => {
    const list: { id: string; moduleName: string; moduleSlug: string; title: string; spec: ChartSpec }[] = [];
    for (const mod of MODULES) {
      if (!state[mod.slug]?.enabled) continue;
      const page = MODULE_PAGES[mod.slug];
      if (!page) continue;
      for (const tab of page.tabs) {
        if (tab.chart) {
          list.push({
            id: `${mod.slug}:${tab.id}`,
            moduleName: mod.name,
            moduleSlug: mod.slug,
            title: tab.chart.title,
            spec: tab.chart,
          });
        }
      }
    }
    return list;
  }, [state]);

  const addedWidgets = availableWidgets.filter((w) => added.includes(w.id));

  function toggleWidget(id: string) {
    setAdded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 lg:px-8">
      {/* 헤더 */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">비즈니스 현황</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            통합 제조 데이터 실시간 현황 · 동기화 지연 5초 이내 · 마지막 동기화 {syncedAgo}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="차트 유형 선택">
            {(["line", "bar"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={chartType === t}
                onClick={() => setChartType(t)}
                className={`cursor-pointer rounded-[7px] px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                  chartType === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t === "line" ? "꺾은선" : "막대"}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
            <IconPlus size={14} />
            위젯 추가
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setSyncedAgo("방금 전")}>
            <IconRefresh size={14} />
            새로고침
          </Button>
        </div>
      </div>

      {/* AI진단 알림 요약 — 최소화/닫기 */}
      {alertShown && (
        <Card className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-slate-900">AI진단 알림 요약</h2>
              <span className="text-xs font-semibold text-red-600">긴급 1</span>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href="/ai-diagnosis"
                className="mr-1 inline-flex items-center gap-1 text-sm font-semibold text-primary-700 transition-colors hover:text-primary-800"
              >
                AI진단으로 이동 <IconArrowRight size={15} />
              </Link>
              <button
                type="button"
                onClick={() => setAlertMin((v) => !v)}
                aria-label={alertMin ? "펼치기" : "최소화"}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <IconChevronDown size={16} className={`transition-transform ${alertMin ? "-rotate-90" : ""}`} />
              </button>
              <button
                type="button"
                onClick={() => setAlertShown(false)}
                aria-label="닫기"
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <IconX size={16} />
              </button>
            </div>
          </div>
          {!alertMin && (
            <ul className="mt-4 grid gap-2.5 md:grid-cols-3">
              {AI_ALERTS.map((alert) => (
                <li key={alert.id}>
                  <Link
                    href="/ai-diagnosis"
                    className="block h-full rounded-xl border border-slate-200 bg-white p-3.5 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-semibold ${
                          alert.severity === "red"
                            ? "text-red-600"
                            : alert.severity === "amber"
                              ? "text-amber-600"
                              : "text-slate-500"
                        }`}
                      >
                        {alert.severityLabel}
                      </span>
                      <span className="text-[11px] text-slate-400">{alert.time}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-snug text-slate-900">{alert.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{alert.detail}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {!alertShown && (
        <button
          type="button"
          onClick={() => setAlertShown(true)}
          className="mb-6 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50"
        >
          <IconArrowRight size={13} />
          AI진단 알림 요약 다시 표시
        </button>
      )}

      {/* KPI 위젯 */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => {
          const up = kpi.delta?.startsWith("+");
          const deltaColor =
            kpi.deltaTone === "green"
              ? "text-emerald-600"
              : kpi.deltaTone === "red"
                ? "text-red-600"
                : kpi.deltaTone === "amber"
                  ? "text-amber-600"
                  : "text-slate-500";
          return (
            <Link
              key={kpi.label}
              href={`/modules/${kpi.moduleSlug}`}
              className="group rounded-xl border border-slate-200 bg-white p-4 transition-colors duration-150 hover:border-slate-300"
              aria-label={`${kpi.label} — ${MODULE_BY_SLUG[kpi.moduleSlug]?.name} 상세로 이동`}
            >
              <p className="truncate text-xs text-slate-500">{kpi.label}</p>
              <p className="mt-1 text-lg font-bold tracking-tight text-slate-900">{kpi.value}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${deltaColor}`}>
                  {up ? <IconArrowUpRight size={11} /> : <IconArrowDownRight size={11} />}
                  {kpi.delta}
                </span>
                <Sparkline values={kpi.spark} width={64} height={20} color="#94a3b8" />
              </div>
              <p className="mt-1 truncate text-[11px] text-slate-400">{kpi.sub}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {showProduction && (
          <Card className="xl:col-span-2">
            <SectionHeader
              title="실시간 생산 현황"
              desc="시간대별 계획 대비 실적"
              action={
                <Link href="/modules/production" className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-700">
                  상세보기
                </Link>
              }
            />
            {chartType === "line" ? (
              <LineChart labels={PRODUCTION_TREND.labels} series={PRODUCTION_TREND.series} yUnit="EA" />
            ) : (
              <BarChart labels={PRODUCTION_TREND.labels} series={PRODUCTION_TREND.series} />
            )}
          </Card>
        )}

        {showEquipment && (
          <Card>
            <SectionHeader
              title="설비 상태"
              desc="전체 21대"
              action={
                <Link href="/modules/equipment" className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-700">
                  상세보기
                </Link>
              }
            />
            <div className="flex justify-center py-2">
              <DonutChart segments={EQUIPMENT_STATUS} centerValue="84.6%" centerLabel="가동률(OEE)" />
            </div>
          </Card>
        )}

        {showProduction && (
          <Card className="xl:col-span-2">
            <SectionHeader title="라인별 실시간 현황" desc="달성률·사이클 타임·설비 상태" />
            <DataTable data={LINE_STATUS} dense />
          </Card>
        )}

        {showInventory && (
          <Card>
            <SectionHeader
              title="재고 하이라이트"
              desc="안전 재고 기준"
              action={
                <Link href="/modules/inventory" className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-700">
                  상세보기
                </Link>
              }
            />
            <ul className="space-y-3.5">
              {INVENTORY_HIGHLIGHT.map((item) => (
                <li key={item.item}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-slate-800">{item.item}</p>
                    <Badge tone={item.tone}>{item.status}</Badge>
                  </div>
                  <ProgressBar value={item.fill} tone={item.tone} />
                  <p className="mt-1 text-xs text-slate-400">{item.detail}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* 핵심 기능에서 끌어온 위젯 */}
        {addedWidgets.map((w) => (
          <Card key={w.id} className="xl:col-span-2">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900">{w.title}</h2>
                <p className="mt-0.5 text-sm text-slate-500">{w.moduleName}에서 가져온 위젯</p>
              </div>
              <button
                type="button"
                onClick={() => toggleWidget(w.id)}
                aria-label="위젯 제거"
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <IconX size={16} />
              </button>
            </div>
            <ChartFromSpec spec={w.spec} />
          </Card>
        ))}
      </div>

      {kpis.length === 0 && addedWidgets.length === 0 && (
        <Card className="mt-6 text-center">
          <p className="text-sm text-slate-500">
            표시할 위젯이 없습니다. 프로필 &gt; 설정 &gt; 기능 활성화에서 기능을 켜거나, 위젯 추가로 그래프를
            가져오세요.
          </p>
        </Card>
      )}

      {/* 위젯 추가 팝업 — 핵심 기능(ON)에서 선택 */}
      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        size="lg"
        title="위젯 추가"
        desc="ON 상태인 핵심 기능의 그래프를 비즈니스 현황으로 가져옵니다."
      >
        <div className="p-5">
          {availableWidgets.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              가져올 수 있는 그래프가 없습니다. 설정에서 기능을 먼저 켜 주세요.
            </p>
          ) : (
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {availableWidgets.map((w) => {
                const on = added.includes(w.id);
                return (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => toggleWidget(w.id)}
                      className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border p-3.5 text-left transition-colors ${
                        on ? "border-slate-400 bg-slate-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900">{w.title}</span>
                        <span className="block truncate text-xs text-slate-400">{w.moduleName}</span>
                      </span>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                          on ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {on ? <IconCheck size={13} /> : <IconPlus size={13} />}
                        {on ? "추가됨" : "추가"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Modal>
    </div>
  );
}
