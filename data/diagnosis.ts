import type { Tone } from "./types";

/** AI진단 허브 더미 데이터 */

export const ANOMALIES: {
  id: string;
  severity: Tone;
  severityLabel: string;
  title: string;
  source: string;
  detectedAt: string;
  impact: string;
  cause: string;
  action: string;
  notified: string[];
}[] = [
  {
    id: "AN-2607-021",
    severity: "red",
    severityLabel: "긴급",
    title: "3라인 사출 온도 이상 편차",
    source: "생산관리 · 센서 T-0314",
    detectedAt: "2026-07-02 13:52 (탐지 후 41초 내 알림)",
    impact: "지속 시 불량률 +0.6%p 예상",
    cause: "히터 존2 출력 불안정 (제어기 노후 추정)",
    action: "히터 존2 점검 작업지시 생성 권고",
    notified: ["인앱", "Slack #생산알림", "담당: 박성우"],
  },
  {
    id: "AN-2607-020",
    severity: "amber",
    severityLabel: "경고",
    title: "프레스 2라인 압력 편차 확대",
    source: "장비관리 · PRS-02",
    detectedAt: "2026-07-02 11:20",
    impact: "유압 펌프 열화 가속 위험",
    cause: "유온 상승과 동반 발생 — 유압유 열화 추정",
    action: "유압유·필터 교체 정비 등록 권고",
    notified: ["인앱", "담당: 정민호"],
  },
  {
    id: "AN-2607-018",
    severity: "slate",
    severityLabel: "관찰",
    title: "검사 공정 처리량 저하 추세",
    source: "품질검사 · 공정 데이터",
    detectedAt: "2026-07-01 16:05",
    impact: "병목 심화 시 리드타임 +0.3일",
    cause: "수작업 검사 비중 증가 (신규 품목 투입)",
    action: "검사 인력 재배치 검토",
    notified: ["인앱"],
  },
];

/**
 * 이상 감지 시연 (UC2: 감지 → 알림 → 권장조치) — 시연 버튼 클릭 시
 * 실시간 감지된 것처럼 목록 최상단에 주입되는 신규 이벤트.
 */
export const DEMO_ANOMALY: (typeof ANOMALIES)[number] = {
  id: "AN-2607-022",
  severity: "red",
  severityLabel: "긴급",
  title: "CNC 2라인 주축 모터 과전류 감지",
  source: "생산관리 · 센서 C-0207",
  detectedAt: "방금 감지 (실시간 센서 스트림 · 탐지 후 3초 내 알림)",
  impact: "지속 시 주축 손상·라인 정지 위험",
  cause: "절삭 부하 급증 — 공구 마모 한계 도달 추정",
  action: "공구 교체 및 주축 부하 점검 작업지시 생성 권고",
  notified: ["인앱", "Slack #생산알림", "담당: 김재현 (SMS)"],
};

/** 시연 이상 이벤트의 권장조치를 등록하면 조치 이행 추적에 추가되는 항목 */
export const DEMO_ACTION: (typeof ACTION_TRACKING)[number] = {
  id: "AC-2607-12",
  title: "CNC 2라인 주축 공구 교체·부하 점검",
  origin: "이상 징후 탐지",
  owner: "김재현",
  stage: "제안",
  due: "2026-07-21",
};

export const PREDICTIONS: {
  id: string;
  equipment: string;
  risk: number;
  window: string;
  basis: string;
  recommendation: string;
  tone: Tone;
  scheduled: boolean;
}[] = [
  {
    id: "PD-2607-07",
    equipment: "CNC-07 머시닝센터",
    risk: 87,
    window: "72시간 내",
    basis: "스핀들 진동 RMS 14일 연속 상승 (2.1→5.1mm/s)",
    recommendation: "베어링 교체 — 예상 소요 4시간, 부품 재고 보유",
    tone: "red",
    scheduled: false,
  },
  {
    id: "PD-2607-06",
    equipment: "PRS-02 프레스",
    risk: 64,
    window: "7일 내",
    basis: "유온 +6°C 상승, 압력 편차 확대",
    recommendation: "유압유·필터 교체 및 펌프 점검",
    tone: "amber",
    scheduled: true,
  },
  {
    id: "PD-2607-05",
    equipment: "CMP-01 컴프레서",
    risk: 41,
    window: "14일 내",
    basis: "동일 부하 대비 전력 소비 8% 증가",
    recommendation: "흡기 필터 청소/교체",
    tone: "slate",
    scheduled: false,
  },
];

export const OPTIMIZATION = {
  id: "OPT-2607-03",
  summary: "CNC 1·2라인 작업 순서 재배치 + 야간 무인 가동 확대",
  currentPlan: {
    label: "기존 스케줄",
    efficiency: 100,
    leadTime: "5.2일",
    cost: "100%",
    utilization: "84.6%",
  },
  aiPlan: {
    label: "AI 제안 스케줄",
    efficiency: 106.8,
    leadTime: "4.6일",
    cost: "97.2%",
    utilization: "89.9%",
  },
  changes: [
    "WO-2607-021(샤프트)과 WO-2607-020(하우징) 가공 순서 교차 배치로 셋업 시간 34% 절감",
    "CNC 3라인 야간 무인 가동 71% → 88% 확대 (공구 수명 모니터링 조건부)",
    "열처리 외주 수거 일정에 맞춰 배치 크기 조정 — 대기시간 38분 → 22분",
  ],
  note: "승인 시 생산관리 > 작업지시에 즉시 반영됩니다.",
};

export type ActionStage = "제안" | "승인" | "이행" | "완료";

export const ACTION_TRACKING: {
  id: string;
  title: string;
  origin: string;
  owner: string;
  stage: ActionStage;
  due: string;
}[] = [
  { id: "AC-2607-11", title: "CNC-07 스핀들 베어링 교체", origin: "설비 예지보전", owner: "정민호", stage: "승인", due: "2026-07-04" },
  { id: "AC-2607-10", title: "3라인 히터 존2 제어기 점검", origin: "이상 징후 탐지", owner: "박성우", stage: "제안", due: "2026-07-03" },
  { id: "AC-2607-09", title: "스케줄링 최적화안 반영", origin: "스케줄링 최적화", owner: "김재현", stage: "제안", due: "2026-07-03" },
  { id: "AC-2607-08", title: "PRS-02 유압유·필터 교체", origin: "설비 예지보전", owner: "이강토", stage: "이행", due: "2026-07-03" },
  { id: "AC-2606-31", title: "프레스 금형 세척 주기 단축", origin: "품질 불량 분석", owner: "이수진", stage: "완료", due: "2026-06-30" },
];

export const STAGE_TONE: Record<ActionStage, Tone> = {
  제안: "slate",
  승인: "violet",
  이행: "blue",
  완료: "green",
};
