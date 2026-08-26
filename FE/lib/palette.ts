/**
 * 차트 시리즈 색상 팔레트 — app/globals.css 의 @theme 토큰과 동기화 유지.
 * SVG 차트(components/charts.tsx)는 색을 props로만 받으므로,
 * 데이터 정의(data/*.ts)에서 hex를 직접 쓰지 말고 이 팔레트를 참조한다.
 *
 * 정책: 기본 시리즈는 primary 계열·무채색. amber/red는 경고·이상 상태에만.
 */
export const CHART = {
  /** 주 시리즈 (primary-600) */
  primary: "#0a50ff",
  /** 보조 시리즈 밝기 단계 (primary-400/300/200) — 다중 시리즈 도넛 등 */
  primary400: "#6490ff",
  primary300: "#96b5ff",
  primary200: "#c0d2ff",
  /** 비교·계획 등 중립 시리즈 (slate-300) */
  neutral: "#cbd5e1",
  /** 잔여·기타 세그먼트 (slate-200) */
  muted: "#e2e8f0",
  /** 진한 중립 — 스파크라인 등 소형 차트 라인 (slate-400) */
  neutral400: "#94a3b8",
  /** 경고 상태 (amber-500) */
  amber: "#f59e0b",
  /** 이상·중단 상태 (red-500) */
  red: "#ef4444",
} as const;
