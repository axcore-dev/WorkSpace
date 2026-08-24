"use client";

import { useState } from "react";
import type { ChartSpec } from "@/data/types";

/**
 * 의존성 없는 순수 SVG 차트.
 * 실데이터 연동 시 차트 라이브러리로 교체 가능하도록 데이터는 props로만 받는다.
 */

function buildPath(values: number[], w: number, h: number, max: number, min: number, headroom = 0) {
  const range = max - min || 1;
  const step = w / (values.length - 1 || 1);
  return values
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * (h - headroom);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** 차트 상단 여백 — 최대값 포인트·값 라벨이 잘리지 않도록 확보 */
const CHART_PAD_TOP = 16;
/** 라인 차트 스케일 헤드룸 — 최대값이 차트 최상단 그리드에 붙지 않게 여유를 둔다 */
const LINE_HEADROOM = 20;

export function LineChart({
  labels = [],
  series = [],
  height = 180,
  yUnit = "",
}: {
  labels?: string[];
  series?: { name: string; color: string; values: number[] }[];
  height?: number;
  yUnit?: string;
}) {
  const w = 600;
  const h = height;
  const all = series.flatMap((s) => s.values);
  const max = Math.max(...all, 1);
  const min = Math.min(...all, 0);
  const range = max - min || 1;
  const n = Math.max(labels.length, ...series.map((s) => s.values.length), 1);
  const step = w / (n - 1 || 1);
  const plotY = (v: number) => h - ((v - min) / range) * (h - LINE_HEADROOM);
  const gridY = [0, 0.25, 0.5, 0.75, 1];
  // 호버 플로팅 툴팁 — 가장 가까운 데이터 포인트 열을 따라간다
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    setHoverIdx(Math.min(n - 1, Math.max(0, Math.round(frac * (n - 1)))));
  }
  const hoverEntries =
    hoverIdx == null
      ? []
      : series
          .map((s) => ({ name: s.name, color: s.color, value: s.values[hoverIdx] }))
          .filter((e) => e.value != null && e.value !== 0);
  return (
    <div>
      <div className="relative" onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)}>
        <svg viewBox={`0 -${CHART_PAD_TOP} ${w} ${h + 24 + CHART_PAD_TOP}`} className="w-full" role="img" aria-label="꺾은선 차트">
          {gridY.map((g) => (
            <line
              key={g}
              x1={0}
              x2={w}
              y1={h - g * h}
              y2={h - g * h}
              stroke="#e2e8f0"
              strokeWidth={1}
              strokeDasharray={g === 0 ? "" : "3 4"}
            />
          ))}
          {hoverIdx != null && hoverEntries.length > 0 && (
            <line x1={hoverIdx * step} x2={hoverIdx * step} y1={-CHART_PAD_TOP} y2={h} stroke="#cbd5e1" strokeWidth={1} />
          )}
          {series.map((s) => (
            <g key={s.name}>
              <path
                d={`${buildPath(s.values, w, h, max, min, LINE_HEADROOM)} L${w},${h} L0,${h} Z`}
                fill={s.color}
                opacity={0.08}
              />
              <path
                d={buildPath(s.values, w, h, max, min, LINE_HEADROOM)}
                fill="none"
                stroke={s.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {s.values.map((v, i) =>
                v === 0 ? null : (
                  <circle
                    key={`${s.name}-pt-${i}`}
                    cx={i * step}
                    cy={plotY(v)}
                    r={hoverIdx === i ? 3.4 : 2.6}
                    fill="#fff"
                    stroke={s.color}
                    strokeWidth={1.6}
                  />
                ),
              )}
            </g>
          ))}
          {labels.map((l, i) => (
            <text
              key={l + i}
              x={(i * w) / (labels.length - 1 || 1)}
              y={h + 18}
              fontSize={11}
              fill="#94a3b8"
              textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"}
            >
              {l}
            </text>
          ))}
        </svg>
        {hoverIdx != null && hoverEntries.length > 0 && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg"
            style={{
              left: `${(hoverIdx / (n - 1 || 1)) * 100}%`,
              transform: `translateX(${hoverIdx <= 0 ? "4px" : hoverIdx >= n - 1 ? "calc(-100% - 4px)" : "-50%"})`,
            }}
            role="status"
          >
            <p className="text-[11px] font-semibold text-slate-400">{labels[hoverIdx]}</p>
            {hoverEntries.map((e) => (
              <p key={e.name} className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-xs">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: e.color }} />
                <span className="text-slate-500">{e.name}</span>
                <span className="ml-auto pl-2 font-semibold text-slate-900">
                  {e.value}
                  {yUnit && <span className="ml-0.5 font-medium text-slate-400">{yUnit}</span>}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.name}
            {yUnit && <span className="text-slate-400">({yUnit})</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BarChart({
  labels = [],
  series = [],
  height = 180,
  perBarColors,
  unit = "",
}: {
  labels?: string[];
  series?: { name: string; color: string; values: number[] }[];
  height?: number;
  /** 단일 시리즈에서 막대별 색 오버라이드 (예: 예측 구간을 연하게) */
  perBarColors?: (string | undefined)[];
  /** 값 라벨 접미사 — 데이터(spec.valueUnit)에서 명시적으로 받는다. 기본값 없음 */
  unit?: string;
}) {
  const w = 600;
  const h = height;
  const all = series.flatMap((s) => s.values);
  const max = Math.max(...all, 1);
  const groups = labels.length || (series[0]?.values.length ?? 0);
  const groupW = w / groups;
  const barW = Math.min(28, (groupW * 0.6) / series.length);
  return (
    <div>
      <svg viewBox={`0 -${CHART_PAD_TOP} ${w} ${h + 24 + CHART_PAD_TOP}`} className="w-full" role="img" aria-label="막대 차트">
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1={0} x2={w} y1={h - g * h} y2={h - g * h} stroke="#e2e8f0" strokeDasharray="3 4" />
        ))}
        <line x1={0} x2={w} y1={h} y2={h} stroke="#e2e8f0" />
        {series.map((s, si) =>
          s.values.map((v, i) => {
            const bh = (v / max) * (h - 16);
            const cx = i * groupW + groupW / 2;
            const x = cx - (series.length * barW) / 2 + si * barW;
            const fill = perBarColors?.[i] ?? s.color;
            return (
              <g key={`${s.name}-${i}`}>
                <rect x={x + 1} y={h - bh} width={barW - 2} height={bh} rx={4} fill={fill}>
                  <title>{`${labels[i] ?? ""} · ${s.name}: ${v}`}</title>
                </rect>
                <text
                  x={x + barW / 2}
                  y={h - bh - 4}
                  fontSize={9}
                  fontWeight={600}
                  fill={fill === "#cbd5e1" ? "#94a3b8" : fill}
                  textAnchor="middle"
                >
                  {v}{unit}
                </text>
              </g>
            );
          }),
        )}
        {labels.map((l, i) => (
          <text
            key={l + i}
            x={i * groupW + groupW / 2}
            y={h + 18}
            fontSize={11}
            fill="#94a3b8"
            textAnchor="middle"
          >
            {l}
          </text>
        ))}
      </svg>
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {series.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** 혼합 차트 — 막대(주 지표) + 꺾은선(보조 지표, 별도 스케일) */
export function ComboChart({
  labels = [],
  bars,
  line,
  height = 180,
  barUnit = "",
  lineUnit = "",
}: {
  labels?: string[];
  bars: { name: string; color: string; values: number[] };
  line: { name: string; color: string; values: number[] };
  height?: number;
  barUnit?: string;
  lineUnit?: string;
}) {
  const w = 600;
  const h = height;
  const groups = labels.length || bars.values.length;
  const groupW = w / groups;
  const barW = Math.min(36, groupW * 0.5);
  const maxBar = Math.max(...bars.values, 1);
  const maxLine = Math.max(...line.values, 1) * 1.25 || 1;
  const lineY = (v: number) => h - (v / maxLine) * (h - 24);
  return (
    <div>
      <svg viewBox={`0 -${CHART_PAD_TOP} ${w} ${h + 24 + CHART_PAD_TOP}`} className="w-full" role="img" aria-label="혼합 차트">
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1={0} x2={w} y1={h - g * h} y2={h - g * h} stroke="#e2e8f0" strokeDasharray="3 4" />
        ))}
        <line x1={0} x2={w} y1={h} y2={h} stroke="#e2e8f0" />
        {bars.values.map((v, i) => {
          const bh = (v / maxBar) * (h - 16);
          const x = i * groupW + groupW / 2 - barW / 2;
          return (
            <g key={`bar-${i}`}>
              <rect x={x} y={h - bh} width={barW} height={bh} rx={4} fill={bars.color}>
                <title>{`${labels[i] ?? ""} · ${bars.name}: ${v}${barUnit}`}</title>
              </rect>
              <text x={x + barW / 2} y={h - bh - 4} fontSize={9} fontWeight={600} fill={bars.color} textAnchor="middle">
                {v}{barUnit}
              </text>
            </g>
          );
        })}
        <path
          d={line.values
            .map((v, i) => `${i === 0 ? "M" : "L"}${(i * groupW + groupW / 2).toFixed(1)},${lineY(v).toFixed(1)}`)
            .join(" ")}
          fill="none"
          stroke={line.color}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {line.values.map((v, i) => (
          <g key={`pt-${i}`}>
            <circle cx={i * groupW + groupW / 2} cy={lineY(v)} r={3} fill="#fff" stroke={line.color} strokeWidth={1.8}>
              <title>{`${labels[i] ?? ""} · ${line.name}: ${v}${lineUnit}`}</title>
            </circle>
            <text
              x={i * groupW + groupW / 2}
              y={lineY(v) - 8}
              fontSize={9}
              fontWeight={600}
              fill={line.color}
              textAnchor="middle"
            >
              {v}{lineUnit}
            </text>
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={l + i} x={i * groupW + groupW / 2} y={h + 18} fontSize={11} fill="#94a3b8" textAnchor="middle">
            {l}
          </text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <span className="h-2 w-2 rounded-sm" style={{ background: bars.color }} />
          {bars.name}
          {barUnit && <span className="text-slate-400">({barUnit})</span>}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <span className="h-2 w-2 rounded-full" style={{ background: line.color }} />
          {line.name}
          {lineUnit && <span className="text-slate-400">({lineUnit})</span>}
        </span>
      </div>
    </div>
  );
}

export function DonutChart({
  segments = [],
  centerLabel,
  centerValue,
  size = 168,
}: {
  segments?: { name: string; value: number; color: string }[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = 40;
  const c = 2 * Math.PI * r;
  const withOffsets = segments.map((s, i) => ({
    ...s,
    offset: segments.slice(0, i).reduce((a, x) => a + x.value / total, 0),
  }));
  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="도넛 차트">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="12" />
        {withOffsets.map((s) => (
          <circle
            key={s.name}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="12"
            strokeDasharray={`${(s.value / total) * c} ${c}`}
            strokeDashoffset={-s.offset * c}
            transform="rotate(-90 50 50)"
          />
        ))}
        {centerValue && (
          <text x="50" y="48" textAnchor="middle" fontSize="12" fontWeight="700" fill="#0f172a">
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text x="50" y="62" textAnchor="middle" fontSize="7.5" fill="#64748b">
            {centerLabel}
          </text>
        )}
      </svg>
      <ul className="space-y-1.5">
        {segments.map((s) => (
          <li key={s.name} className="flex items-center gap-2 text-sm text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            <span>{s.name}</span>
            <span className="ml-1 font-semibold text-slate-900">
              {Math.round((s.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GaugeChart({
  value = 0,
  unit = "%",
  label,
  tone = "#6444d9",
  size = 160,
}: {
  value?: number;
  unit?: string;
  label?: string;
  tone?: string;
  size?: number;
}) {
  const r = 40;
  const half = Math.PI * r; // 반원 둘레
  const frac = Math.min(100, Math.max(0, value)) / 100;
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.62} viewBox="0 0 100 62" role="img" aria-label="게이지 차트">
        <path
          d="M 10 55 A 40 40 0 0 1 90 55"
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 10 55 A 40 40 0 0 1 90 55"
          fill="none"
          stroke={tone}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${frac * half} ${half}`}
        />
        <text x="50" y="48" textAnchor="middle" fontSize="16" fontWeight="700" fill="#0f172a">
          {value}
          <tspan fontSize="9" fill="#64748b">
            {unit}
          </tspan>
        </text>
      </svg>
      {label && <p className="mt-1 text-xs text-slate-500">{label}</p>}
    </div>
  );
}

export function Sparkline({
  values,
  color = "#6444d9",
  width = 96,
  height = 28,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path
        d={buildPath(values, width, height - 2, max, min)}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        transform="translate(0,1)"
      />
    </svg>
  );
}

/** ChartSpec 데이터를 받아 적절한 차트를 렌더링 */
export function ChartFromSpec({ spec }: { spec: ChartSpec }) {
  if (spec.type === "line")
    return (
      <LineChart
        labels={spec.labels}
        series={spec.series}
        height={spec.compact ? 150 : 180}
        yUnit={spec.valueUnit ?? ""}
      />
    );
  if (spec.type === "bar")
    return (
      <BarChart
        labels={spec.labels}
        series={spec.series}
        height={spec.compact ? 150 : 180}
        unit={spec.valueUnit ?? ""}
      />
    );
  if (spec.type === "donut") return <DonutChart segments={spec.segments} />;
  return <GaugeChart value={spec.value} unit={spec.unit} label={spec.title} />;
}
