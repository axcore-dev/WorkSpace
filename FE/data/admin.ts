/**
 * 운영자 콘솔(`/admin`) 데모 데이터.
 *
 * 고객사 1곳당 워크스페이스 1개. 생성·수정은 운영자만 한다.
 * 실제 값은 BE의 운영자 API가 생기면 그쪽에서 온다 — 여기 값은 전부 가상이다.
 * 사업자등록번호는 국세청 체크섬을 통과하는 값으로 맞춰 뒀다(조회 버튼 검증을 실제로 통과해야 하므로).
 */

export type WsStatus = "live" | "invited" | "suspended";
export type IntegrationHealth = "ok" | "error" | "none";
export type SystemState = "ok" | "authFail" | "idle";
export type MappingState = "mapped" | "review" | "unmapped";
export type BillingState = "paid" | "due" | "overdue";
export type MemberState = "active" | "pending";

export const WS_STATUS_LABEL: Record<WsStatus, string> = {
  live: "운영 중",
  invited: "초대 메일 발송함",
  suspended: "중지",
};

export const SYSTEM_STATE_LABEL: Record<SystemState, string> = {
  ok: "정상",
  authFail: "인증 실패",
  idle: "동기화 없음",
};

export const MAPPING_STATE_LABEL: Record<MappingState, string> = {
  mapped: "매핑됨",
  review: "검토 필요",
  unmapped: "미매핑",
};

export const BILLING_STATE_LABEL: Record<BillingState, string> = {
  paid: "입금 완료",
  due: "청구 예정",
  overdue: "미수금",
};

export const PLANS = ["Enterprise", "Growth", "Starter"] as const;
export type Plan = (typeof PLANS)[number];

/** 본사 외 사업장 */
export type Site = {
  name: string;
  bizNumber: string;
  address: string;
  bizType: string;
  bizItem: string;
};

export type ExternalSystem = {
  name: string;
  kind: "ERP" | "MES" | "WMS";
  site: string;
  state: SystemState;
  lastSync: string;
};

/** 원본 항목 ↔ 온톨로지 개념 — 연동 탭의 주인공 */
export type Mapping = {
  system: string;
  source: string;
  concept: string;
  /** 온톨로지 AI가 매긴 확신도(%) — 낮으면 사람이 봐야 한다 */
  confidence: number;
  state: MappingState;
};

export type Member = {
  name: string | null;
  email: string;
  role: string;
  state: MemberState;
  invitedAt: string;
  lastSeen: string;
};

export type Invoice = {
  period: string;
  plan: Plan;
  usage: string;
  amount: number;
  state: BillingState;
};

/**
 * 담당자 — 접속 링크 받는 사람과 연락 담당을 나눈다.
 * 실무자가 링크를 받고 계약·정산 연락은 다른 사람에게 가는 경우가 있다.
 */
export type Contacts = {
  /** 접속 링크가 나가는 주소. 이 사람이 첫 관리자가 된다 */
  link: { name: string; email: string };
  /** 평소 연락처. 링크는 여기로 가지 않는다 */
  contact: { name: string; email: string; phone: string };
  /** 참조 수신 — 발송 메일에 CC로 들어간다 */
  cc: string[];
};

export type Usage = {
  storageGb: number;
  storageLimitGb: number;
  queries: number;
  queryLimit: number;
  syncs: number;
  /** null = 무제한 */
  syncLimit: number | null;
};

export type AdminWorkspace = {
  /** 워크스페이스 이름 = URL 식별자. 만든 뒤 바꿀 수 없다 */
  slug: string;
  company: string;
  bizNumber: string;
  corpNumber: string;
  bizType: string;
  bizItem: string;
  address: string;
  website: string;
  status: WsStatus;
  plan: Plan;
  createdAt: string;
  /** 담당 운영자 (우리 쪽) */
  operator: string;
  lastActive: string;
  linkSentAt: string;
  /** 접속 링크를 실제로 열었는지 */
  linkOpened: boolean;
  taxEmail: string;
  memo: string;
  contacts: Contacts;
  sites: Site[];
  systems: ExternalSystem[];
  mappings: Mapping[];
  members: Member[];
  usage: Usage;
  invoices: Invoice[];
};

export const ADMIN_WORKSPACES: AdminWorkspace[] = [
  {
    slug: "hanbit-prod",
    company: "한빛제철 주식회사",
    bizNumber: "123-45-67891",
    corpNumber: "110111-1234567",
    bizType: "제조업",
    bizItem: "1차 철강 제조",
    address: "경북 포항시 남구 철강로 12",
    website: "https://hanbit-steel.co.kr",
    status: "live",
    plan: "Enterprise",
    createdAt: "2026-03-14",
    operator: "김운영",
    lastActive: "2시간 전",
    linkSentAt: "2026-03-14",
    linkOpened: true,
    taxEmail: "tax@hanbit.co.kr",
    memo: "포항 2공장 MES 인증 정보 재발급 대기 중.",
    contacts: {
      link: { name: "홍길동", email: "hong@hanbit.co.kr" },
      contact: { name: "김구매", email: "kim@hanbit.co.kr", phone: "054-000-0000" },
      cc: ["it@hanbit.co.kr"],
    },
    sites: [
      {
        name: "포항 2공장",
        bizNumber: "123-45-67891",
        address: "경북 포항시 남구 공단로 55",
        bizType: "제조업",
        bizItem: "철강 압연",
      },
      {
        name: "서울 사무소",
        bizNumber: "123-45-67891",
        address: "서울 강남구 테헤란로 200",
        bizType: "서비스업",
        bizItem: "경영 관리",
      },
    ],
    systems: [
      { name: "SAP ECC", kind: "ERP", site: "본사", state: "ok", lastSync: "10분 전" },
      { name: "포항 2공장 MES", kind: "MES", site: "포항 2공장", state: "authFail", lastSync: "3일 전" },
    ],
    mappings: [
      { system: "SAP ECC", source: "MATNR", concept: "품목 코드", confidence: 99, state: "mapped" },
      { system: "SAP ECC", source: "WERKS", concept: "사업장", confidence: 97, state: "mapped" },
      { system: "SAP ECC", source: "LGORT", concept: "저장 위치", confidence: 94, state: "mapped" },
      { system: "SAP ECC", source: "ZZQTY_ADJ", concept: "재고 조정 수량", confidence: 61, state: "review" },
      { system: "SAP ECC", source: "ZZFLAG_07", concept: "—", confidence: 22, state: "unmapped" },
      { system: "포항 2공장 MES", source: "EQP_ID", concept: "설비 식별자", confidence: 98, state: "mapped" },
      { system: "포항 2공장 MES", source: "TEMP_C", concept: "공정 온도", confidence: 88, state: "mapped" },
      { system: "포항 2공장 MES", source: "OP_CD2", concept: "공정 코드", confidence: 55, state: "review" },
    ],
    members: [
      {
        name: "홍길동",
        email: "hong@hanbit.co.kr",
        role: "담당자 · 관리자",
        state: "active",
        invitedAt: "2026-03-14",
        lastSeen: "2시간 전",
      },
      {
        name: "이생산",
        email: "lee@hanbit.co.kr",
        role: "편집자",
        state: "active",
        invitedAt: "2026-03-20",
        lastSeen: "어제",
      },
      {
        name: null,
        email: "choi@hanbit.co.kr",
        role: "뷰어",
        state: "pending",
        invitedAt: "2026-08-25",
        lastSeen: "—",
      },
    ],
    usage: {
      storageGb: 412,
      storageLimitGb: 500,
      queries: 12000,
      queryLimit: 20000,
      syncs: 840,
      syncLimit: null,
    },
    invoices: [
      { period: "2026-07", plan: "Enterprise", usage: "388 GB", amount: 4510000, state: "paid" },
      { period: "2026-06", plan: "Enterprise", usage: "350 GB", amount: 4200000, state: "paid" },
    ],
  },
  {
    slug: "daesung-prod",
    company: "대성화학 주식회사",
    bizNumber: "214-88-01232",
    corpNumber: "110111-2345678",
    bizType: "제조업",
    bizItem: "기초 화학물질 제조",
    address: "울산 남구 여천로 88",
    website: "https://daesung-chem.co.kr",
    status: "live",
    plan: "Growth",
    createdAt: "2026-05-02",
    operator: "박운영",
    lastActive: "어제",
    linkSentAt: "2026-05-02",
    linkOpened: true,
    taxEmail: "tax@daesung.co.kr",
    memo: "",
    contacts: {
      link: { name: "정관리", email: "jung@daesung.co.kr" },
      contact: { name: "정관리", email: "jung@daesung.co.kr", phone: "052-000-0000" },
      cc: [],
    },
    sites: [],
    systems: [
      { name: "Oracle EBS", kind: "ERP", site: "본사", state: "authFail", lastSync: "5일 전" },
    ],
    mappings: [
      { system: "Oracle EBS", source: "ITEM_ID", concept: "품목 코드", confidence: 96, state: "mapped" },
      { system: "Oracle EBS", source: "ORG_ID", concept: "사업장", confidence: 92, state: "mapped" },
      { system: "Oracle EBS", source: "ATTR12", concept: "—", confidence: 18, state: "unmapped" },
    ],
    members: [
      {
        name: "정관리",
        email: "jung@daesung.co.kr",
        role: "담당자 · 관리자",
        state: "active",
        invitedAt: "2026-05-02",
        lastSeen: "어제",
      },
    ],
    usage: {
      storageGb: 96,
      storageLimitGb: 200,
      queries: 4200,
      queryLimit: 10000,
      syncs: 210,
      syncLimit: 1000,
    },
    invoices: [{ period: "2026-07", plan: "Growth", usage: "88 GB", amount: 1200000, state: "paid" }],
  },
  {
    slug: "seojin-prod",
    company: "서진모빌리티 주식회사",
    bizNumber: "305-81-55511",
    corpNumber: "110111-3456789",
    bizType: "제조업",
    bizItem: "자동차 부품 제조",
    address: "경기 화성시 동탄산단로 7",
    website: "",
    status: "invited",
    plan: "Growth",
    createdAt: "2026-08-25",
    operator: "김운영",
    lastActive: "3일 전",
    linkSentAt: "2026-08-25",
    linkOpened: false,
    taxEmail: "",
    memo: "접속 링크 미개봉. 8/28 유선 확인 예정.",
    contacts: {
      link: { name: "최담당", email: "choi@seojin.co.kr" },
      contact: { name: "오총무", email: "oh@seojin.co.kr", phone: "031-000-0000" },
      cc: ["ceo@seojin.co.kr"],
    },
    sites: [],
    systems: [],
    mappings: [],
    members: [],
    usage: {
      storageGb: 0,
      storageLimitGb: 200,
      queries: 0,
      queryLimit: 10000,
      syncs: 0,
      syncLimit: 1000,
    },
    invoices: [],
  },
  {
    slug: "kumho-prod",
    company: "금호식품 주식회사",
    bizNumber: "412-86-77123",
    corpNumber: "110111-4567890",
    bizType: "제조업",
    bizItem: "기타 식품 제조",
    address: "전남 나주시 식품로 3",
    website: "https://kumho-food.co.kr",
    status: "suspended",
    plan: "Growth",
    createdAt: "2025-11-08",
    operator: "박운영",
    lastActive: "2개월 전",
    linkSentAt: "2025-11-08",
    linkOpened: true,
    taxEmail: "tax@kumho-food.co.kr",
    memo: "7월분 미수금. 입금 확인 후 재개.",
    contacts: {
      link: { name: "강대리", email: "kang@kumho-food.co.kr" },
      contact: { name: "강대리", email: "kang@kumho-food.co.kr", phone: "061-000-0000" },
      cc: [],
    },
    sites: [],
    systems: [{ name: "더존 ERP", kind: "ERP", site: "본사", state: "idle", lastSync: "2개월 전" }],
    mappings: [
      { system: "더존 ERP", source: "PROD_CD", concept: "품목 코드", confidence: 95, state: "mapped" },
    ],
    members: [
      {
        name: "강대리",
        email: "kang@kumho-food.co.kr",
        role: "담당자 · 관리자",
        state: "active",
        invitedAt: "2025-11-08",
        lastSeen: "2개월 전",
      },
    ],
    usage: {
      storageGb: 0,
      storageLimitGb: 200,
      queries: 0,
      queryLimit: 10000,
      syncs: 0,
      syncLimit: 1000,
    },
    invoices: [{ period: "2026-07", plan: "Growth", usage: "12 GB", amount: 1200000, state: "overdue" }],
  },
  {
    slug: "namyang-prod",
    company: "남양정밀 주식회사",
    bizNumber: "501-81-12347",
    corpNumber: "110111-5678901",
    bizType: "제조업",
    bizItem: "금속 가공기계 제조",
    address: "경남 창원시 성산구 공단로 41",
    website: "https://ny-precision.co.kr",
    status: "live",
    plan: "Starter",
    createdAt: "2026-07-19",
    operator: "김운영",
    lastActive: "5일 전",
    linkSentAt: "2026-07-19",
    linkOpened: true,
    taxEmail: "tax@ny-precision.co.kr",
    memo: "",
    contacts: {
      link: { name: "윤사원", email: "yoon@ny-precision.co.kr" },
      contact: { name: "윤사원", email: "yoon@ny-precision.co.kr", phone: "055-000-0000" },
      cc: [],
    },
    sites: [],
    systems: [],
    mappings: [],
    members: [
      {
        name: "윤사원",
        email: "yoon@ny-precision.co.kr",
        role: "담당자 · 관리자",
        state: "active",
        invitedAt: "2026-07-19",
        lastSeen: "5일 전",
      },
    ],
    usage: {
      storageGb: 18,
      storageLimitGb: 50,
      queries: 900,
      queryLimit: 3000,
      syncs: 0,
      syncLimit: 300,
    },
    invoices: [{ period: "2026-07", plan: "Starter", usage: "14 GB", amount: 390000, state: "paid" }],
  },
  {
    slug: "taeyang-prod",
    company: "태양전자 주식회사",
    bizNumber: "606-86-23450",
    corpNumber: "110111-6789012",
    bizType: "제조업",
    bizItem: "전자부품 제조",
    address: "충북 청주시 흥덕구 산단로 22",
    website: "https://ty-electronics.co.kr",
    status: "live",
    plan: "Enterprise",
    createdAt: "2026-01-27",
    operator: "박운영",
    lastActive: "1시간 전",
    linkSentAt: "2026-01-27",
    linkOpened: true,
    taxEmail: "tax@ty-electronics.co.kr",
    memo: "",
    contacts: {
      link: { name: "서차장", email: "seo@ty-electronics.co.kr" },
      contact: { name: "노팀장", email: "noh@ty-electronics.co.kr", phone: "043-000-0000" },
      cc: ["it@ty-electronics.co.kr", "tax@ty-electronics.co.kr"],
    },
    sites: [
      {
        name: "청주 1공장",
        bizNumber: "606-86-23450",
        address: "충북 청주시 흥덕구 산단로 22",
        bizType: "제조업",
        bizItem: "전자부품 제조",
      },
    ],
    systems: [
      { name: "SAP S/4HANA", kind: "ERP", site: "본사", state: "ok", lastSync: "8분 전" },
      { name: "청주 MES", kind: "MES", site: "청주 1공장", state: "ok", lastSync: "12분 전" },
      { name: "청주 WMS", kind: "WMS", site: "청주 1공장", state: "ok", lastSync: "30분 전" },
    ],
    mappings: [
      { system: "SAP S/4HANA", source: "MATNR", concept: "품목 코드", confidence: 99, state: "mapped" },
      { system: "SAP S/4HANA", source: "CHARG", concept: "배치 번호", confidence: 93, state: "mapped" },
      { system: "청주 MES", source: "LOT_NO", concept: "배치 번호", confidence: 91, state: "mapped" },
      { system: "청주 MES", source: "DEFECT_TP", concept: "불량 유형", confidence: 74, state: "review" },
      { system: "청주 WMS", source: "BIN_CD", concept: "저장 위치", confidence: 96, state: "mapped" },
    ],
    members: [
      {
        name: "서차장",
        email: "seo@ty-electronics.co.kr",
        role: "담당자 · 관리자",
        state: "active",
        invitedAt: "2026-01-27",
        lastSeen: "1시간 전",
      },
      {
        name: "노팀장",
        email: "noh@ty-electronics.co.kr",
        role: "편집자",
        state: "active",
        invitedAt: "2026-02-02",
        lastSeen: "3시간 전",
      },
    ],
    usage: {
      storageGb: 688,
      storageLimitGb: 1000,
      queries: 31000,
      queryLimit: 50000,
      syncs: 2400,
      syncLimit: null,
    },
    invoices: [
      { period: "2026-07", plan: "Enterprise", usage: "640 GB", amount: 6800000, state: "paid" },
      { period: "2026-06", plan: "Enterprise", usage: "612 GB", amount: 6800000, state: "paid" },
    ],
  },
  {
    slug: "sinheung-prod",
    company: "신흥포장 주식회사",
    bizNumber: "718-81-34560",
    corpNumber: "110111-7890123",
    bizType: "제조업",
    bizItem: "골판지 상자 제조",
    address: "인천 서구 검단로 9",
    website: "",
    status: "invited",
    plan: "Starter",
    createdAt: "2026-08-27",
    operator: "김운영",
    lastActive: "어제",
    linkSentAt: "2026-08-27",
    linkOpened: false,
    taxEmail: "",
    memo: "",
    contacts: {
      link: { name: "임과장", email: "lim@sinheung.co.kr" },
      contact: { name: "임과장", email: "lim@sinheung.co.kr", phone: "032-000-0000" },
      cc: [],
    },
    sites: [],
    systems: [],
    mappings: [],
    members: [],
    usage: {
      storageGb: 0,
      storageLimitGb: 50,
      queries: 0,
      queryLimit: 3000,
      syncs: 0,
      syncLimit: 300,
    },
    invoices: [],
  },
];

/** 연동 건강도 — 목록에서 한 칸으로 보여줄 요약값 */
export function integrationHealth(ws: AdminWorkspace): IntegrationHealth {
  if (ws.systems.length === 0) return "none";
  return ws.systems.some((s) => s.state === "authFail") ? "error" : "ok";
}

/** 국세청 사업자등록번호 검증식 — 형식만 맞는 임의 10자리를 걸러낸다 */
export function isValidBizNumber(input: string) {
  const d = input.replace(/\D/g, "");
  if (!/^\d{10}$/.test(d)) return false;
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * weights[i];
  sum += Math.floor((Number(d[8]) * 5) / 10);
  return (10 - (sum % 10)) % 10 === Number(d[9]);
}

/** 000-00-00000 형태로 (입력 중 자동 하이픈) */
export function formatBizNumber(input: string) {
  const d = input.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

/** 워크스페이스 이름 규칙 — 영문 소문자·숫자·하이픈. 만든 뒤 바꿀 수 없다 */
export function isValidSlug(v: string) {
  return /^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$/.test(v);
}

export const KRW = new Intl.NumberFormat("ko-KR");

/** 현재 로그인한 운영자 (데모) */
export const ADMIN_OPERATOR = { name: "김운영", team: "운영팀", scope: "워크스페이스 생성·수정" };

/**
 * 이번 달 예상 금액 (데모 추정식) — 기본료 + 저장 용량 단가.
 * 실제 금액은 BE 청구 로직에서 온다. 여기 값으로 청구하지 않는다.
 */
export function estimateAmount(ws: AdminWorkspace) {
  const base: Record<Plan, number> = { Enterprise: 4000000, Growth: 900000, Starter: 300000 };
  return base[ws.plan] + ws.usage.storageGb * 2000;
}

/* ────────────────────── 오늘 손볼 것 (대시보드) ────────────────────── */

/**
 * 운영자가 손대야 하는 신호. 우선순위 순서다.
 *
 * - `integration` 고객이 지금 피해를 본다 (데이터가 멈춰 있다)
 * - `link`        온보딩이 멈춰 있다
 * - `overdue`     돈
 * - `limit`       상위 요금제를 안내할 시점 (기회지 문제가 아니다)
 */
export type TaskKind = "integration" | "link" | "overdue" | "limit";

export type Task = {
  kind: TaskKind;
  slug: string;
  company: string;
  /** 무엇이 문제인지 한 줄 */
  detail: string;
  /** 언제부터인지 — 날짜 또는 상대 표현 */
  since: string;
};

export const TASK_LABEL: Record<TaskKind, string> = {
  integration: "연동 실패",
  link: "접속 링크 미개봉",
  overdue: "미수금",
  limit: "사용량 한도 임박",
};

/** 해당 신호가 무엇을 하라는 뜻인지 — 화면에 그대로 띄운다 */
export const TASK_ACTION: Record<TaskKind, string> = {
  integration: "고객사에 접속 정보 재발급을 요청해 주세요.",
  link: "담당자에게 링크를 다시 보내거나 유선으로 확인해 주세요.",
  overdue: "청구 담당자에게 입금을 확인해 주세요.",
  limit: "상위 요금제를 안내할 시점이에요.",
};

/** 사용량이 이 비율을 넘으면 한도 임박으로 본다 */
export const LIMIT_WARN_PCT = 75;

/** 저장 용량 사용률(%) */
export function storagePct(ws: AdminWorkspace) {
  if (ws.usage.storageLimitGb === 0) return 0;
  return Math.min(100, Math.round((ws.usage.storageGb / ws.usage.storageLimitGb) * 100));
}

/**
 * 처리 대기 목록. 한 워크스페이스가 여러 신호에 걸릴 수 있다.
 *
 * ponytail: "며칠 지났는지"는 계산하지 않는다 — `new Date()`를 렌더에서 쓰면 프리렌더와
 * 하이드레이션 결과가 갈린다. 발송일을 그대로 보여주고 판단은 사람이 한다.
 * 서버가 기준 시각을 내려주면 그때 경과일을 붙이는 게 맞다.
 */
export function pendingTasks(list: AdminWorkspace[] = ADMIN_WORKSPACES): Task[] {
  const tasks: Task[] = [];

  for (const ws of list) {
    // 중지된 곳은 손볼 대상이 아니다 — 미수금만 예외로 남긴다
    const active = ws.status !== "suspended";

    for (const s of ws.systems) {
      if (s.state === "authFail") {
        tasks.push({
          kind: "integration",
          slug: ws.slug,
          company: ws.company,
          detail: `${s.name} 인증 실패`,
          since: `마지막 동기화 ${s.lastSync}`,
        });
      }
    }

    if (ws.status === "invited" && !ws.linkOpened) {
      tasks.push({
        kind: "link",
        slug: ws.slug,
        company: ws.company,
        detail: `${ws.contacts.link.name}(${ws.contacts.link.email})`,
        since: `${ws.linkSentAt} 발송`,
      });
    }

    const overdue = ws.invoices.find((i) => i.state === "overdue");
    if (overdue) {
      tasks.push({
        kind: "overdue",
        slug: ws.slug,
        company: ws.company,
        detail: `${overdue.period} ${KRW.format(overdue.amount)}원`,
        since: `${overdue.plan} 요금제`,
      });
    }

    const pct = storagePct(ws);
    if (active && pct >= LIMIT_WARN_PCT) {
      tasks.push({
        kind: "limit",
        slug: ws.slug,
        company: ws.company,
        detail: `저장 용량 ${pct}% (${ws.usage.storageGb} / ${ws.usage.storageLimitGb} GB)`,
        since: `${ws.plan} 요금제`,
      });
    }
  }

  const order: TaskKind[] = ["integration", "link", "overdue", "limit"];
  return tasks.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

/* ────────────────────── 생성 폼 임시 저장 ────────────────────── */

/**
 * 작성 중인 개설 정보를 **이 브라우저에만** 남긴다.
 *
 * 서버 드래프트가 아니다 — 다른 PC·다른 브라우저에서는 보이지 않고, 방문자 데이터를 지우면
 * 사라진다. 그래서 화면에 저장 위치를 명시하고, 불러온 뒤에는 지운다. 고객사 사업자 정보가
 * 담기므로 공용 PC에 방치되지 않게 하려는 것이다.
 *
 * 드래프트 API가 생기면 이 자리를 서버 저장으로 바꾼다.
 */
export const DRAFT_KEY = "axpoint-admin-draft";

export type Draft = {
  bizNumber: string;
  company: string;
  corpNumber: string;
  bizType: string;
  bizItem: string;
  address: string;
  addressDetail: string;
  website: string;
  sites: Site[];
  linkName: string;
  linkEmail: string;
  sameContact: boolean;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  cc: string[];
  slug: string;
  plan: Plan;
  memo: string;
  /** 저장 시각 — 화면에 "언제 저장했는지" 보여준다 */
  savedAt: string;
};

export function saveDraft(draft: Omit<Draft, "savedAt">, savedAt: string) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt }));
    return true;
  } catch {
    // 시크릿 모드·저장 공간 부족 등. 실패를 삼키지 않고 화면에서 알린다.
    return false;
  }
}

export function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    // 형태가 바뀐 옛 데이터가 남아 있을 수 있다 — 최소한만 확인한다
    return typeof d?.slug === "string" && Array.isArray(d?.sites) ? d : null;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // 지우지 못해도 화면 흐름은 계속된다
  }
}

/* ────────────────────────── CSV 내려받기 ────────────────────────── */

/**
 * 값 하나를 CSV 셀로. 쉼표·따옴표·줄바꿈이 들어가면 따옴표로 감싸고 내부 따옴표는 두 번 쓴다.
 * 회사명에 쉼표가 들어가는 경우가 실제로 있어서 그냥 이어 붙이면 열이 밀린다.
 */
function csvCell(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: (string | number)[][]) {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/**
 * 브라우저에서 CSV 파일로 받게 한다. 외부 라이브러리를 쓰지 않는다.
 *
 * 앞에 BOM(`﻿`)을 붙이는 이유: 엑셀이 UTF-8을 자동으로 알아채지 못해서
 * 한글이 깨진다. 메모장·구글 시트는 BOM이 있어도 정상이다.
 */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
