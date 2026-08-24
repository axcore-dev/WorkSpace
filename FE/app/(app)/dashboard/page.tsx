"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart, ChartFromSpec, ComboChart, DonutChart, LineChart, Sparkline } from "@/components/charts";
import {
  IconArrowDownRight,
  IconArrowRight,
  IconArrowUpRight,
  IconCheck,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconX,
} from "@/components/icons";
import { Modal } from "@/components/modal";
import { useModules } from "@/components/module-provider";
import { Card, DataTable } from "@/components/ui";
import { CHART } from "@/lib/palette";
import {
  CASHFLOW_FORECAST,
  DASHBOARD_KPIS,
  DELIVERY_STATUS,
  LINE_STATUS,
  PRODUCTION_TREND,
  REALTIME_OPS,
} from "@/data/dashboard";
import { MODULE_BY_SLUG, MODULES } from "@/data/modules";
import { MODULE_PAGES } from "@/data/module-pages";
import type { ChartSpec } from "@/data/types";

type DetailKey = "cashflow" | "delivery" | "ops" | null;

/** 실시간 가동 현황 카드와 겹치는 KPI는 표시하지 않는다 */
const OVERLAPPED_KPI_MODULES = new Set(["production", "equipment", "quality"]);

/** 간략 통계 카드 — 카드 전체 클릭 시 상세 팝업 */
function StatCard({
  title,
  onDetail,
  children,
}: {
  title: string;
  onDetail: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card padding={false} className="transition-colors duration-150 hover:border-slate-300">
      <button type="button" onClick={onDetail} className="block w-full cursor-pointer p-5 text-left">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
          <span className="text-xs font-medium text-slate-400">상세보기</span>
        </div>
        {children}
      </button>
    </Card>
  );
}

export default function DashboardPage() {
  const { state } = useModules();
  const [syncedAgo, setSyncedAgo] = useState("3초 전");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  const [detail, setDetail] = useState<DetailKey>(null);

  const kpis = DASHBOARD_KPIS.filter((k) => state[k.moduleSlug]?.enabled && !OVERLAPPED_KPI_MODULES.has(k.moduleSlug));

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

  const defectOver = REALTIME_OPS.defectRate > REALTIME_OPS.defectLimit;
  const remaining = Math.max(0, REALTIME_OPS.targetNum - REALTIME_OPS.producedNum);
  // 예측 구간은 연한 색으로 (토스증권식 강약)
  const cashflowBarColors = CASHFLOW_FORECAST.balances.map((_, i) =>
    i >= CASHFLOW_FORECAST.forecastFrom ? CHART.primary200 : CHART.primary,
  );

  return (
    <div className="px-6 py-6 lg:px-8">
      {/* 헤더 — 서브 텍스트는 타이틀 우측, 동기화는 새로고침 툴팁으로 */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">주요 정보</h1>
          <p className="text-sm text-slate-500">오늘 챙겨야 할 현금·납기·생산 흐름을 한눈에 확인할 수 있어요.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-300 transition-colors hover:bg-slate-50"
          >
            <IconPencil size={14} />
            편집
          </button>
          <div className="group relative">
            <button
              type="button"
              onClick={() => setSyncedAgo("방금 전")}
              aria-label="새로고침"
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-300 transition-colors hover:bg-slate-50"
            >
              <IconRefresh size={14} />
              새로고침
            </button>
            <span
              role="tooltip"
              className="pointer-events-none absolute right-0 top-full z-20 mt-1.5 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            >
              마지막 동기화 {syncedAgo} · 지연 5초 이내
            </span>
          </div>
        </div>
      </div>

      {/* 최상단 — 핵심 통계 3종 (카드 클릭 시 상세) */}
      <div className="mb-4 grid gap-4 xl:grid-cols-2">
        {/* 현금흐름 예측 — 막대, 예측 구간은 연하게 */}
        <StatCard title="현금흐름 예측" onDetail={() => setDetail("cashflow")}>
          <BarChart
            labels={CASHFLOW_FORECAST.labels}
            series={[{ name: "월말 현금 잔고 (억원)", color: CHART.primary, values: CASHFLOW_FORECAST.balances }]}
            perBarColors={cashflowBarColors}
            unit="억"
            height={150}
          />
        </StatCard>

        {/* 납기 준수율 — 혼합(막대: 준수율, 선: 지연 건수) */}
        <StatCard title="납기 준수율" onDetail={() => setDetail("delivery")}>
          <ComboChart
            labels={DELIVERY_STATUS.labels}
            bars={{ name: "납기 준수율", color: CHART.primary, values: DELIVERY_STATUS.rateBars }}
            line={{ name: "납기 지연", color: CHART.amber, values: DELIVERY_STATUS.delayLine }}
            barUnit="%"
            lineUnit="건"
            height={150}
          />
        </StatCard>

        {/* 실시간 가동 현황 — 도넛 (달성 강조 / 잔여 연하게) */}
        <StatCard title="실시간 가동 현황" onDetail={() => setDetail("ops")}>
          <div className="flex items-center justify-center py-1.5">
            <DonutChart
              segments={[
                { name: "달성", value: REALTIME_OPS.producedNum, color: CHART.primary },
                { name: "잔여", value: remaining, color: CHART.muted },
              ]}
              centerValue={REALTIME_OPS.produced}
              centerLabel={`목표 ${REALTIME_OPS.target}`}
              size={150}
            />
          </div>
        </StatCard>
      </div>

      {/* KPI 위젯 — 가동 현황과 겹치는 항목 제외 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
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

      {/* 핵심 기능에서 끌어온 위젯 */}
      {addedWidgets.length > 0 && (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {addedWidgets.map((w) => (
            <Card key={w.id}>
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
      )}

      {kpis.length === 0 && addedWidgets.length === 0 && (
        <Card className="mt-6 text-center">
          <p className="text-sm text-slate-500">
            표시할 위젯이 없습니다. 프로필 &gt; 설정 &gt; 기능 활성화에서 기능을 켜거나, 편집으로 그래프를
            가져오세요.
          </p>
        </Card>
      )}

      {/* 현금흐름 예측 — 상세: 영업활동 현금흐름 재무제표 형식 */}
      <Modal
        open={detail === "cashflow"}
        onClose={() => setDetail(null)}
        size="lg"
        title="현금흐름 예측 — 영업활동 현금흐름"
      >
        <div className="space-y-5 p-5">
          <div>
            <p className="mb-1.5 text-right text-[11px] text-slate-400">(단위: 억원 · 음수는 괄호 표기)</p>
            <DataTable data={CASHFLOW_FORECAST.statement} colAlign={["left", "center", "center", "center"]} dense />
          </div>
          <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-600">
            {CASHFLOW_FORECAST.summary}
          </p>
        </div>
      </Modal>

      {/* 납기 준수율 — 상세: 월별 실적 엑셀 형태 + 리스크 주문 (리스크 주문 열 너비에 맞춰 xl) */}
      <Modal
        open={detail === "delivery"}
        onClose={() => setDetail(null)}
        size="xl"
        title="납기 준수율 상세"
      >
        <div className="space-y-5 p-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500">납기 준수율</p>
              <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">{DELIVERY_STATUS.rate}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{DELIVERY_STATUS.rateDesc}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500">지연 리스크</p>
              <p className="mt-1 text-xl font-bold tracking-tight text-red-600">{DELIVERY_STATUS.riskCount}건</p>
              <p className="mt-0.5 text-[11px] text-slate-400">진행 중 주문 17건 기준</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500">수주 잔고</p>
              <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">{DELIVERY_STATUS.backlogMonths}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{DELIVERY_STATUS.backlogDesc}</p>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">월별 납기 실적</p>
            <DataTable data={DELIVERY_STATUS.monthly} dense />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">지연 리스크 주문</p>
            <DataTable data={DELIVERY_STATUS.riskOrders} dense />
          </div>
          <Link
            href="/modules/sales"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 transition-colors hover:text-primary-800"
          >
            영업관리에서 수주 확인 <IconArrowRight size={14} />
          </Link>
        </div>
      </Modal>

      {/* 실시간 가동 현황 — 상세 */}
      <Modal
        open={detail === "ops"}
        onClose={() => setDetail(null)}
        size="xl"
        title="실시간 가동 현황"
      >
        <div className="space-y-5 p-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500">목표 달성률</p>
              <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">{REALTIME_OPS.achievedRate}%</p>
              <p className="mt-0.5 text-xs font-medium text-slate-600">
                {REALTIME_OPS.producedNum.toLocaleString()} <span className="text-slate-400">/</span>{" "}
                {REALTIME_OPS.targetNum.toLocaleString()} EA
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500">금일 불량률</p>
              <p className={`mt-1 text-xl font-bold tracking-tight ${defectOver ? "text-red-600" : "text-emerald-600"}`}>
                {REALTIME_OPS.defectRate}%{" "}
                <span className="text-sm font-semibold text-slate-400">/ 기준 {REALTIME_OPS.defectLimit}%</span>
              </p>
              <p className="mt-0.5 text-xs font-medium text-slate-600">기준치 {defectOver ? "초과" : "이내"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500">가동 설비</p>
              <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">18 / 21대</p>
              <p className="mt-0.5 text-[11px] text-slate-400">일시 정지 2 · 정비 중 1</p>
            </div>
          </div>
          <LineChart labels={PRODUCTION_TREND.labels} series={PRODUCTION_TREND.series} yUnit="EA" />
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">라인별 실시간 현황</p>
            <DataTable data={LINE_STATUS} dense />
          </div>
        </div>
      </Modal>

      {/* 위젯 편집 팝업 — 핵심 기능(ON)에서 선택 */}
      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        size="lg"
        title="위젯 편집"
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
