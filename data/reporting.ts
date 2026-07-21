/** 생산관리 > 보고 자동화 (UC1: 현장 입력 → 자동 집계 → AI 보고서) 더미 데이터 */

/** 현장 실적 입력 1건 — POP 단말·태블릿에서 작업자가 입력하는 단위 */
export interface FieldEntry {
  time: string;
  line: string;
  item: string;
  qty: number;
  defects: number;
  defectType?: string;
  note?: string;
}

/** 라인 → 금일 생산 품목 (모니터링 탭과 동일 시나리오) */
export const LINE_ITEMS: Record<string, string> = {
  "CNC 1라인": "정밀 샤프트 Ø12",
  "CNC 2라인": "하우징 케이스",
  "프레스 1라인": "브래킷",
  "프레스 2라인": "플랜지 커플링",
  "조립 라인": "샤프트 어셈블리",
};

export const LINES = Object.keys(LINE_ITEMS);

/** 라인별 금일 생산 계획 (EA) */
export const LINE_PLANS: Record<string, number> = {
  "CNC 1라인": 4200,
  "CNC 2라인": 3600,
  "프레스 1라인": 3000,
  "프레스 2라인": 1800,
  "조립 라인": 1400,
};

export const DEFECT_TYPES = ["치수 불량", "표면 흠집", "가공 누락", "조립 불량", "기타"];

/** 금일 기입력분 — 시연 시작 시점에 이미 집계에 반영되어 있는 기록 */
export const SEED_ENTRIES: FieldEntry[] = [
  { time: "14:00", line: "CNC 2라인", item: LINE_ITEMS["CNC 2라인"], qty: 1210, defects: 4, defectType: "가공 누락" },
  { time: "13:30", line: "조립 라인", item: LINE_ITEMS["조립 라인"], qty: 410, defects: 3, defectType: "조립 불량" },
  { time: "13:00", line: "CNC 1라인", item: LINE_ITEMS["CNC 1라인"], qty: 1420, defects: 5, defectType: "치수 불량" },
  { time: "11:00", line: "프레스 2라인", item: LINE_ITEMS["프레스 2라인"], qty: 520, defects: 11, defectType: "표면 흠집", note: "금형 이물 — 세척 후 재가동" },
  { time: "10:30", line: "CNC 2라인", item: LINE_ITEMS["CNC 2라인"], qty: 1150, defects: 9, defectType: "치수 불량", note: "주축 소음 경미" },
  { time: "09:00", line: "프레스 1라인", item: LINE_ITEMS["프레스 1라인"], qty: 980, defects: 4, defectType: "표면 흠집" },
  { time: "08:30", line: "CNC 1라인", item: LINE_ITEMS["CNC 1라인"], qty: 1380, defects: 6, defectType: "치수 불량" },
];

/** AI 보고서 생성 시 순차 표시되는 추론 문구 */
export const REPORT_REASONING = [
  "금일 현장 입력 데이터를 집계하고 있어요",
  "계획 대비 편차와 불량 패턴을 분석하고 있어요",
  "설비·품질 데이터와 교차 확인하고 있어요",
  "보고서 초안을 작성하고 있어요",
];

/** 보고서 결재선 (목업) */
export const APPROVAL_LINE = [
  { role: "작성", name: "AXpoint AI", state: "자동 생성" },
  { role: "검토", name: "김재현 팀장", state: "검토 대기" },
  { role: "승인", name: "생산본부장", state: "승인 대기" },
];
