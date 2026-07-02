import type { ChartSpec } from "@/data/types";

/**
 * 의존성 없는 순수 SVG 차트.
 * 실데이터 연동 시 차트 라이브러리로 교체 가능하도록 데이터는 props로만 받는다.
 */

function buildPath(values: number[], w: number, h: number, max: number, min: number) {
  const range = max - min || 1;
  const step = w / (values.length - 1 || 1);
  return values
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function LineChart({
  labels = [],
  series = [],
  height = 180,
  yUnit = "",
  showValues = false,
}: {
  labels?: string[];
  series?: { name: string; color: string; values: number[] }[];
  height?: number;
  yUnit?: string;
  showValues?: boolean;
}) {
  const w = 600;
  const h = height;
  const all = series.flatMap((s) => s.values);
  const max = Math.max(...all, 1);
  const min = Math.min(...all, 0);
  const range = max - min || 1;
  const step = w / (Math.max(...series.map((s) => s.values.length), 1) - 1 || 1);
  const gridY = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h + 24}`} className="w-full" role="img" aria-label="꺾은선 차트">
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
        {series.map((s) => (
          <g key={s.name}>
            <path
              d={`${buildPath(s.values, w, h, max, min)} L${w},${h} L0,${h} Z`}
              fill={s.color}
              opacity={0.08}
            />
            <path
              d={buildPath(s.values, w, h, max, min)}
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
                  cy={h - ((v - min) / range) * h}
                  r={2.6}
                  fill="#fff"
                  stroke={s.color}
                  strokeWidth={1.6}
                >
                  <title>{`${s.name} ${labels[i] ?? ""}: ${v}${yUnit}`}</title>
                </circle>
              ),
            )}
            {showValues &&
              s.values.map((v, i) =>
                v === 0 ? null : (
                  <text
                    key={`${s.name}-lbl-${i}`}
                    x={i * step}
                    y={h - ((v - min) / range) * h - 7}
                    fontSize={10}
                    fontWeight={600}
                    fill={s.color}
                    textAnchor="middle"
                  >
                    {v}
                  </text>
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
}: {
  labels?: string[];
  series?: { name: string; color: string; values: number[] }[];
  height?: number;
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
      <svg viewBox={`0 0 ${w} ${h + 24}`} className="w-full" role="img" aria-label="막대 차트">
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1={0} x2={w} y1={h - g * h} y2={h - g * h} stroke="#e2e8f0" strokeDasharray="3 4" />
        ))}
        <line x1={0} x2={w} y1={h} y2={h} stroke="#e2e8f0" />
        {series.map((s, si) =>
          s.values.map((v, i) => {
            const bh = (v / max) * (h - 16);
            const cx = i * groupW + groupW / 2;
            const x = cx - (series.length * barW) / 2 + si * barW;
            return (
              <g key={`${s.name}-${i}`}>
                <rect x={x + 1} y={h - bh} width={barW - 2} height={bh} rx={4} fill={s.color}>
                  <title>{`${labels[i] ?? ""} · ${s.name}: ${v}`}</title>
                </rect>
                <text
                  x={x + barW / 2}
                  y={h - bh - 4}
                  fontSize={9}
                  fontWeight={600}
                  fill={s.color === "#cbd5e1" ? "#94a3b8" : s.color}
                  textAnchor="middle"
                >
                  {v}
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
          <text x="50" y="48" textAnchor="middle" fontSize="14" fontWeight="700" fill="#0f172a">
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
        showValues={spec.showValues}
        height={spec.compact ? 150 : 180}
        yUnit={spec.valueUnit ?? ""}
      />
    );
  if (spec.type === "bar")
    return <BarChart labels={spec.labels} series={spec.series} height={spec.compact ? 150 : 180} />;
  if (spec.type === "donut") return <DonutChart segments={spec.segments} />;
  return <GaugeChart value={spec.value} unit={spec.unit} label={spec.title} />;
}
