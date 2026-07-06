import { CHART } from "@/lib/palette";
import type { StatData, Tone } from "./types";

/** 주요 정보 대시보드 더미 데이터 */

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

/**
 * 현금흐름 예측 — 월말 현금 잔고 추이. 예측 구간은 연한 색으로 구분(토스증권식).
 * 상세는 영업활동 현금흐름 재무제표 형식.
 */
export const CASHFLOW_FORECAST = {
  asOf: "7월 기준",
  labels: ["5월", "6월", "7월", "8월", "9월"],
  /** 월말 현금 잔고 (억원) — 5·6월 실적, 7월~ 예측 */
  balances: [3.6, 4.2, 5.1, 2.0, 4.4],
  /** 이 인덱스부터 예측 구간 (연한 색) */
  forecastFrom: 2,
  summary: "9월까지 현금이 바닥나는 구간은 없어요. 다만 8월엔 부가세 납부가 겹쳐 잔고가 2.0억원까지 줄어요.",
  /** 상세 — 영업활동 현금흐름 (재무제표 형식 · 회계식 표기: 음수는 괄호, 단위 억원) */
  statement: {
    columns: ["구분", "7월 (예측)", "8월 (예측)", "9월 (예측)"],
    rows: [
      ["Ⅰ. 영업활동 현금흐름", "", "", ""],
      ["　매출채권 회수", "21.8", "19.2", "23.5"],
      ["　매입채무 지급", "(12.6)", "(11.8)", "(12.9)"],
      ["　급여 지급", "(4.3)", "(4.3)", "(4.5)"],
      ["　세금 납부 (부가세·원천세)", "(1.2)", "(3.6)", "(1.2)"],
      ["　기타 영업비 지출", "(2.8)", "(2.6)", "(2.5)"],
      [
        "영업활동 순현금흐름",
        { badge: "0.9", tone: "green" as Tone },
        { badge: "(3.1)", tone: "red" as Tone },
        { badge: "2.4", tone: "green" as Tone },
      ],
      ["기초 현금", "4.2", "5.1", "2.0"],
      [
        "기말 현금",
        { badge: "5.1", tone: "green" as Tone },
        { badge: "2.0", tone: "amber" as Tone },
        { badge: "4.4", tone: "green" as Tone },
      ],
    ],
  },
};

/** 납기 준수율 — 준수율(막대) + 지연 건수(선) 혼합 그래프, 상세는 엑셀 형태 */
export const DELIVERY_STATUS = {
  rate: "96.2%",
  rateDesc: "최근 90일 납기 준수율",
  riskCount: 2,
  backlogMonths: "2.6개월",
  backlogDesc: "평소 가동률 기준 수주 잔고",
  summary: "진행 중인 주문 17건 중 2건에 납기 지연 리스크가 있어요.",
  labels: ["3월", "4월", "5월", "6월", "7월"],
  rateBars: [94.8, 95.6, 94.1, 96.0, 96.2],
  delayLine: [6, 5, 7, 4, 2],
  /** 상세 — 월별 실적 (엑셀 형태) */
  monthly: {
    columns: ["월", "완료 주문", "정시 납품", "지연", "준수율", "평균 지연일"],
    rows: [
      ["3월", "115건", "109건", "6건", "94.8%", "2.1일"],
      ["4월", "114건", "109건", "5건", "95.6%", "1.8일"],
      ["5월", "119건", "112건", "7건", "94.1%", "2.4일"],
      ["6월", "121건", "116건", "4건", "96.0%", "1.5일"],
      ["7월 (진행중)", "53건", "51건", "2건", "96.2%", "1.2일"],
    ],
  },
  riskOrders: {
    columns: ["수주번호", "고객사", "품목", "납기", "리스크 사유", "상태"],
    rows: [
      [
        "SO-2606-31",
        "한빛모터스",
        "플랜지 커플링",
        "07-06",
        "프레스 2라인 일시 정지 · 진척 42%",
        { badge: "지연 위험", tone: "red" as Tone },
      ],
      [
        "SO-2607-05",
        "한빛모터스",
        "정밀 샤프트 Ø12",
        "07-18",
        "CNC-07 정비 예정과 생산 일정 겹침",
        { badge: "주의", tone: "amber" as Tone },
      ],
    ],
  },
};

/** 실시간 가동 현황 — 도넛(달성/잔여, 강약 구분) · 불량률 신호등 */
export const REALTIME_OPS = {
  achievedRate: 96.8,
  producedNum: 12480,
  targetNum: 12900,
  produced: "12,480 EA",
  target: "12,900 EA",
  defectRate: 0.82,
  defectLimit: 2.0,
  summary: "오늘 목표의 96.8%를 만들었어요. 불량률은 0.82%로 기준치(2%) 안이에요.",
};

/** 실시간 생산 현황 차트 */
export const PRODUCTION_TREND = {
  labels: ["08시", "10시", "12시", "14시", "16시", "18시", "20시"],
  series: [
    { name: "계획", color: CHART.neutral, values: [1800, 1800, 1200, 1800, 1800, 1800, 1600] },
    { name: "실적", color: CHART.primary, values: [1740, 1815, 1180, 1752, 1691, 1788, 1514] },
  ],
};

/** 설비 상태 분포 */
export const EQUIPMENT_STATUS = [
  { name: "가동", value: 18, color: CHART.primary },
  { name: "일시 정지", value: 2, color: CHART.amber },
  { name: "정비 중", value: 1, color: CHART.red },
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
