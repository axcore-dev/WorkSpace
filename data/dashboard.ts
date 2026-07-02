import type { StatData, Tone } from "./types";

/** 비즈니스 현황 대시보드 더미 데이터 */

export const DASHBOARD_KPIS: (StatData & { moduleSlug: string; spark: number[] })[] = [
  {
    label: "금일 생산 실적",
    value: "12,480 EA",
    delta: "+4.2%",
    deltaTone: "green",
    sub: "계획 대비 96.8%",
    moduleSlug: "production",
    spark: [82, 88, 84, 91, 94, 90, 97],
  },
  {
    label: "설비 가동률 (OEE)",
    value: "84.6%",
    delta: "+1.9%p",
    deltaTone: "green",
    sub: "가동 18 / 21대",
    moduleSlug: "equipment",
    spark: [79, 81, 80, 83, 82, 84, 85],
  },
  {
    label: "금일 불량률",
    value: "0.82%",
    delta: "-0.11%p",
    deltaTone: "green",
    sub: "목표 1.0% 이하",
    moduleSlug: "quality",
    spark: [1.2, 1.1, 1.0, 0.95, 0.9, 0.93, 0.82],
  },
  {
    label: "재고 자산",
    value: "18.6억원",
    delta: "+2.3%",
    deltaTone: "amber",
    sub: "안전 재고 미달 3품목",
    moduleSlug: "inventory",
    spark: [17.1, 17.4, 17.9, 18.0, 18.2, 18.4, 18.6],
  },
  {
    label: "이번 달 수주액",
    value: "22.4억원",
    delta: "+8.7%",
    deltaTone: "green",
    sub: "진행 중 17건",
    moduleSlug: "sales",
    spark: [14, 16, 15, 18, 19, 21, 22.4],
  },
  {
    label: "미처리 AS 티켓",
    value: "6건",
    delta: "-4",
    deltaTone: "green",
    sub: "평균 처리 1.8일",
    moduleSlug: "support",
    spark: [14, 12, 11, 9, 10, 8, 6],
  },
];

/** AI진단 알림 요약 위젯 */
export const AI_ALERTS: {
  id: string;
  severity: Tone;
  severityLabel: string;
  title: string;
  detail: string;
  time: string;
}[] = [
  {
    id: "AL-2607-014",
    severity: "red",
    severityLabel: "긴급",
    title: "CNC-07 스핀들 베어링 고장 위험 87%",
    detail: "72시간 내 고장 예측 · 정비 일정 등록 대기",
    time: "12분 전",
  },
  {
    id: "AL-2607-013",
    severity: "amber",
    severityLabel: "경고",
    title: "3라인 사출 온도 이상 편차 감지",
    detail: "표준 대비 +4.2°C · 불량률 상승 상관 감지",
    time: "38분 전",
  },
  {
    id: "AL-2607-012",
    severity: "violet",
    severityLabel: "제안",
    title: "스케줄링 최적화안 승인 대기",
    detail: "적용 시 생산 효율 +6.8% 예상",
    time: "1시간 전",
  },
];

/** 실시간 생산 현황 차트 */
export const PRODUCTION_TREND = {
  labels: ["08시", "10시", "12시", "14시", "16시", "18시", "20시"],
  series: [
    { name: "계획", color: "#cbd5e1", values: [1800, 1800, 1200, 1800, 1800, 1800, 1600] },
    { name: "실적", color: "#0a50ff", values: [1740, 1815, 1180, 1752, 1691, 1788, 1514] },
  ],
};

/** 설비 상태 분포 */
export const EQUIPMENT_STATUS = [
  { name: "가동", value: 18, color: "#0a50ff" },
  { name: "일시 정지", value: 2, color: "#f59e0b" },
  { name: "정비 중", value: 1, color: "#ef4444" },
];

/** 라인별 실시간 현황 테이블 */
export const LINE_STATUS = {
  columns: ["라인", "품목", "달성률", "사이클 타임", "상태"],
  rows: [
    ["CNC 1라인", "정밀 샤프트 Ø12", "98.0%", "41.2초", { badge: "가동", tone: "green" as Tone }],
    ["CNC 2라인", "하우징 케이스", "93.6%", "44.8초", { badge: "가동", tone: "green" as Tone }],
    ["프레스 1라인", "브래킷", "101.6%", "12.4초", { badge: "가동", tone: "green" as Tone }],
    ["프레스 2라인", "플랜지 커플링", "84.8%", "18.9초", { badge: "일시 정지", tone: "amber" as Tone }],
    ["조립 라인", "샤프트 어셈블리", "29.9%", "—", { badge: "정비 중", tone: "red" as Tone }],
  ],
};

/** 재고 하이라이트 */
export const INVENTORY_HIGHLIGHT: {
  item: string;
  status: string;
  tone: Tone;
  fill: number;
  detail: string;
}[] = [
  { item: "알루미늄 합금 6061", status: "발주 필요", tone: "red", fill: 46, detail: "안전 재고 대비 85.5%" },
  { item: "베어링 608ZZ", status: "발주 진행중", tone: "amber", fill: 58, detail: "5,000EA 입고 예정 (7/8)" },
  { item: "스테인리스강 304", status: "정상", tone: "green", fill: 88, detail: "안전 재고 대비 148%" },
  { item: "완제품 (샤프트)", status: "정상", tone: "green", fill: 74, detail: "출하 예약 8,000EA" },
];
