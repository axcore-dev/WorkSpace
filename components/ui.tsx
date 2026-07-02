import type { Cell, StatData, TableData, Tone } from "@/data/types";
import { IconArrowDownRight, IconArrowUpRight } from "@/components/icons";

/**
 * 색상 정책 (사용자 지침):
 * - 기본은 무채색. 메인 컬러(블루)는 주요 액션·링크·강조 등 중요한 순간에만.
 * - 상태/심각도는 '옅은 색 텍스트'로만 구분 (배경 채움·알약 없음).
 * - 아이콘/배지에 컬러 배경을 넣지 않는다.
 */
const TONE_TEXT: Record<Tone, string> = {
  green: "text-emerald-600",
  amber: "text-amber-600",
  red: "text-red-600",
  violet: "text-slate-600", // 카테고리성 → 무채색
  blue: "text-slate-600",
  slate: "text-slate-500",
};

export function Badge({
  tone = "slate",
  children,
  className = "",
}: {
  tone?: Tone;
  /** @deprecated 더 이상 점 표시를 쓰지 않음 (호환용) */
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center text-xs font-medium ${TONE_TEXT[tone]} ${className}`}>
      {children}
    </span>
  );
}

/** 모듈/기능의 AI 표기 — 무채색 하이라인 태그 (컬러 배경 없음) */
export function AiBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded border border-slate-300 px-1 py-px text-[10px] font-semibold leading-none tracking-wide text-slate-500 ${className}`}
    >
      AI
    </span>
  );
}

export function Card({
  children,
  className = "",
  padding = true,
}: {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white ${padding ? "p-5" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  desc,
  action,
}: {
  title: React.ReactNode;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        {desc && <p className="mt-0.5 text-sm text-slate-500">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

const BTN_VARIANTS = {
  primary:
    "bg-primary-600 text-white hover:bg-primary-700 focus-visible:outline-primary-600 disabled:opacity-40",
  secondary:
    "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus-visible:outline-slate-400",
  ghost:
    "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-slate-400",
  danger:
    "bg-white text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50 focus-visible:outline-red-500",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BTN_VARIANTS;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "px-2.5 py-1.5 text-xs rounded-lg gap-1",
    md: "px-3.5 py-2 text-sm rounded-lg gap-1.5",
    lg: "px-5 py-2.5 text-sm rounded-lg gap-2",
  };
  return (
    <button
      type="button"
      className={`inline-flex cursor-pointer items-center justify-center font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed ${sizes[size]} ${BTN_VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function Stat({ stat }: { stat: StatData }) {
  const deltaTone = stat.deltaTone ?? "slate";
  const up = stat.delta?.startsWith("+");
  return (
    <Card className="min-w-0">
      <p className="truncate text-sm text-slate-500">{stat.label}</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <p className="text-2xl font-bold tracking-tight text-slate-900">{stat.value}</p>
        {stat.delta && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
              deltaTone === "green"
                ? "text-emerald-600"
                : deltaTone === "red"
                  ? "text-red-600"
                  : deltaTone === "amber"
                    ? "text-amber-600"
                    : "text-slate-500"
            }`}
          >
            {up ? <IconArrowUpRight size={12} /> : <IconArrowDownRight size={12} />}
            {stat.delta}
          </span>
        )}
      </div>
      {stat.sub && <p className="mt-1 truncate text-xs text-slate-400">{stat.sub}</p>}
    </Card>
  );
}

function CellView({ cell }: { cell: Cell }) {
  if (typeof cell === "object") {
    return <Badge tone={cell.tone}>{cell.badge}</Badge>;
  }
  return <>{cell}</>;
}

export function DataTable({
  data,
  dense = false,
  onRowClick,
}: {
  data: TableData;
  dense?: boolean;
  /** 지정 시 행 클릭 가능 (상세 팝업 등) */
  onRowClick?: (rowIndex: number) => void;
}) {
  const clickable = !!onRowClick;
  return (
    <div className="thin-scroll -mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            {data.columns.map((col) => (
              <th
                key={col}
                scope="col"
                className="whitespace-nowrap px-3 py-2.5 text-xs font-medium text-slate-400 first:pl-1 last:pr-1"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.rows.map((row, i) => (
            <tr
              key={i}
              onClick={clickable ? () => onRowClick(i) : undefined}
              className={`transition-colors hover:bg-slate-50/70 ${clickable ? "cursor-pointer" : ""}`}
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`whitespace-nowrap px-3 ${dense ? "py-2" : "py-3"} first:pl-1 first:font-medium first:text-slate-900 last:pr-1 text-slate-600`}
                >
                  <CellView cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 접근성 있는 토글 스위치 — ON은 무채색(다크 슬레이트), 메인 컬러 미사용 */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  size = "md",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const dims =
    size === "sm"
      ? { track: "h-5 w-9", thumb: "h-3.5 w-3.5", on: "translate-x-4" }
      : { track: "h-6 w-11", thumb: "h-4.5 w-4.5", on: "translate-x-5" };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex ${dims.track} shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? "bg-slate-500" : "bg-slate-200"
      }`}
    >
      <span
        className={`inline-block ${dims.thumb} transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? dims.on : "translate-x-1"
        }`}
      />
    </button>
  );
}

export function ProgressBar({
  value,
  tone = "slate",
  className = "",
}: {
  value: number;
  tone?: Tone;
  className?: string;
}) {
  const tones: Record<Tone, string> = {
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    violet: "bg-slate-700",
    blue: "bg-slate-700",
    slate: "bg-slate-700",
  };
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-slate-100 ${className}`}>
      <div
        className={`h-full rounded-full ${tones[tone]} transition-[width] duration-300`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-slate-400">{icon}</div>}
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {desc && <p className="mt-1 max-w-sm text-sm text-slate-500">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
