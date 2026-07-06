import type { IconKey } from "@/components/icons";

/** 상태 색조 — Badge/Stat 등 UI 전반에서 공유 */
export type Tone = "green" | "amber" | "red" | "violet" | "blue" | "slate";

/** 테이블 셀: 일반 텍스트 또는 상태 배지 */
export type Cell = string | number | { badge: string; tone: Tone };

export interface TableData {
  columns: string[];
  rows: Cell[][];
}

export interface StatData {
  label: string;
  value: string;
  sub?: string;
  delta?: string;
  deltaTone?: Tone;
  /** 마감 임박 표시 (예: 급여 지급 D-19) */
  dday?: string;
  /** 우측 상단 연결 버튼 — tabId의 세부 기능 탭으로 이동 */
  cta?: { label: string; tabId: string };
}

export interface ChartSpec {
  type: "line" | "bar" | "donut" | "gauge";
  title: string;
  /** line/bar */
  labels?: string[];
  series?: { name: string; color: string; values: number[] }[];
  /** 콤팩트 높이 */
  compact?: boolean;
  /** 값 접미사 (예: '천 EA') */
  valueUnit?: string;
  /** donut */
  segments?: { name: string; value: number; color: string }[];
  /** gauge */
  value?: number;
  unit?: string;
}

export interface TreeNode {
  name: string;
  meta?: string;
  badge?: { text: string; tone: Tone };
  children?: TreeNode[];
}

/** 탭별 액션 버튼 — 필요한 세부 기능에만 표시한다 */
export type TabAction = "filter" | "export" | "create";

/** 모듈 서브기능 탭 하나의 화면 구성 */
export interface SubfunctionTab {
  id: string;
  label: string;
  description: string;
  ai?: boolean;
  actions?: TabAction[];
  table?: TableData;
  chart?: ChartSpec;
  tree?: TreeNode[];
  note?: string;
}

/** 8대 핵심 모듈 정의 */
export interface ModuleDef {
  slug: string;
  name: string;
  icon: IconKey;
  summary: string;
  /** 토스식 행동 라이팅 서브타이틀 (예: '~할 수 있어요.') */
  action: string;
  /** 대응 외부 시스템 (중복 시 OFF 추천 매핑) */
  externalSystem: string;
  subfunctions: { id: string; name: string; ai?: boolean }[];
}

/** 모듈 상세 페이지 콘텐츠 */
export interface ModulePageData {
  stats: StatData[];
  tabs: SubfunctionTab[];
}

/** 행 클릭 시 뜨는 상세 팝업 (실무 필수 항목만) */
export interface DetailField {
  label: string;
  value: string;
  tone?: Tone;
}
export interface DetailRecord {
  title: string;
  subtitle?: string;
  /** 상태 — 급여 관리 팝업과 동일하게 항상 본문 하단 중앙에 표시된다 */
  status?: { label: string; tone: Tone };
  /** 상태 행의 라벨 (기본 "상태" — AS 접수는 "우선순위") */
  statusLabel?: string;
  fields: DetailField[];
  tableTitle?: string;
  table?: TableData;
}

/** 조직도 팀 클릭 시 뜨는 구성원 */
export interface Member {
  name: string;
  rank: string;
  phone: string;
  email: string;
  joined: string;
}
