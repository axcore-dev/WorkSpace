/**
 * 운영자 콘솔(`/admin`) 데모 데이터.
 *
 * 고객사 1곳당 워크스페이스 1개. 생성·수정은 운영자만 한다.
 * 실제 값은 BE의 운영자 API가 생기면 그쪽에서 온다 — 여기 값은 전부 가상이다.
 * 사업자등록번호는 국세청 체크섬을 통과하는 값으로 맞춰 뒀다(조회 버튼 검증을 실제로 통과해야 하므로).
 */

export type WsStatus = "active" | "pending" | "suspended";
export type IntegrationHealth = "ok" | "error" | "none";
export type SystemState = "ok" | "authFail" | "idle";
export type MappingState = "mapped" | "review" | "unmapped";
export type BillingState = "paid" | "due" | "overdue";
export type MemberState = "active" | "pending";

/**
 * 상태 3종 — 값과 라벨을 1:1로 맞춘다.
 *
 * BE(`shared.workspaces.status`)는 `provisioning/active/suspended/terminated` 4종이지만
 * **FE가 기준이고 BE가 여기에 맞춘다**(수정요청v10 ⑦).
 * `terminated`는 FE에 두지 않는다 — 삭제 없이 비활성화만 있다.
 */
export const WS_STATUS_LABEL: Record<WsStatus, string> = {
  active: "활성화",
  pending: "대기중",
  suspended: "비활성화",
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
 * 담당자 — 고객사 쪽 창구 한 명.
 *
 * v10 전에는 「접속 링크 받는 사람」과 「연락 담당」을 나눠 두었는데,
 * 접속 링크를 운영팀이 복사해 직접 보내는 방식으로 바뀌면서 둘을 나눌 이유가 없어졌다.
 * (더미 7곳 중 4곳은 이미 같은 사람이었다.)
 */
export type Contacts = {
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
  /**
   * 테넌트 스키마 이름 = URL 식별자. 생성 후 BE가 자동 부여하며 바꿀 수 없다.
   * 규칙은 `ax_` + PK를 5자리로 채운 값 (BE `V2__workspaces.sql`).
   */
  schemaName: string;
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
  taxEmail: string;
  memo: string;
  contacts: Contacts;
  systems: ExternalSystem[];
  mappings: Mapping[];
  members: Member[];
  usage: Usage;
  invoices: Invoice[];
};

export const ADMIN_WORKSPACES: AdminWorkspace[] = [
  {
    schemaName: "ax_00001",
    company: "한빛제철 주식회사",
    bizNumber: "123-45-67891",
    corpNumber: "110111-1234567",
    bizType: "제조업",
    bizItem: "1차 철강 제조",
    address: "경북 포항시 남구 철강로 12",
    website: "https://hanbit-steel.co.kr",
    status: "active",
    plan: "Enterprise",
    createdAt: "2026-03-14",
    operator: "김운영",
    lastActive: "2시간 전",
    taxEmail: "tax@hanbit.co.kr",
    memo: "포항 2공장 MES 인증 정보 재발급 대기 중.",
    contacts: {
      contact: { name: "김구매", email: "kim@hanbit.co.kr", phone: "054-000-0000" },
      cc: ["it@hanbit.co.kr"],
    },
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
    schemaName: "ax_00002",
    company: "대성화학 주식회사",
    bizNumber: "214-88-01232",
    corpNumber: "110111-2345678",
    bizType: "제조업",
    bizItem: "기초 화학물질 제조",
    address: "울산 남구 여천로 88",
    website: "https://daesung-chem.co.kr",
    status: "active",
    plan: "Growth",
    createdAt: "2026-05-02",
    operator: "박운영",
    lastActive: "어제",
    taxEmail: "tax@daesung.co.kr",
    memo: "",
    contacts: {
      contact: { name: "정관리", email: "jung@daesung.co.kr", phone: "052-000-0000" },
      cc: [],
    },
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
    schemaName: "ax_00003",
    company: "서진모빌리티 주식회사",
    bizNumber: "305-81-55511",
    corpNumber: "110111-3456789",
    bizType: "제조업",
    bizItem: "자동차 부품 제조",
    address: "경기 화성시 동탄산단로 7",
    website: "",
    status: "pending",
    plan: "Growth",
    createdAt: "2026-08-25",
    operator: "김운영",
    lastActive: "3일 전",
    taxEmail: "",
    memo: "접속 링크 미개봉. 8/28 유선 확인 예정.",
    contacts: {
      contact: { name: "오총무", email: "oh@seojin.co.kr", phone: "031-000-0000" },
      cc: ["ceo@seojin.co.kr"],
    },
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
    schemaName: "ax_00004",
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
    taxEmail: "tax@kumho-food.co.kr",
    memo: "7월분 미수금. 입금 확인 후 재개.",
    contacts: {
      contact: { name: "강대리", email: "kang@kumho-food.co.kr", phone: "061-000-0000" },
      cc: [],
    },
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
    schemaName: "ax_00005",
    company: "남양정밀 주식회사",
    bizNumber: "501-81-12347",
    corpNumber: "110111-5678901",
    bizType: "제조업",
    bizItem: "금속 가공기계 제조",
    address: "경남 창원시 성산구 공단로 41",
    website: "https://ny-precision.co.kr",
    status: "active",
    plan: "Starter",
    createdAt: "2026-07-19",
    operator: "김운영",
    lastActive: "5일 전",
    taxEmail: "tax@ny-precision.co.kr",
    memo: "",
    contacts: {
      contact: { name: "윤사원", email: "yoon@ny-precision.co.kr", phone: "055-000-0000" },
      cc: [],
    },
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
    schemaName: "ax_00006",
    company: "태양전자 주식회사",
    bizNumber: "606-86-23450",
    corpNumber: "110111-6789012",
    bizType: "제조업",
    bizItem: "전자부품 제조",
    address: "충북 청주시 흥덕구 산단로 22",
    website: "https://ty-electronics.co.kr",
    status: "active",
    plan: "Enterprise",
    createdAt: "2026-01-27",
    operator: "박운영",
    lastActive: "1시간 전",
    taxEmail: "tax@ty-electronics.co.kr",
    memo: "",
    contacts: {
      contact: { name: "노팀장", email: "noh@ty-electronics.co.kr", phone: "043-000-0000" },
      cc: ["it@ty-electronics.co.kr", "tax@ty-electronics.co.kr"],
    },
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
    schemaName: "ax_00007",
    company: "신흥포장 주식회사",
    bizNumber: "718-81-34560",
    corpNumber: "110111-7890123",
    bizType: "제조업",
    bizItem: "골판지 상자 제조",
    address: "인천 서구 검단로 9",
    website: "",
    status: "pending",
    plan: "Starter",
    createdAt: "2026-08-27",
    operator: "김운영",
    lastActive: "어제",
    taxEmail: "",
    memo: "",
    contacts: {
      contact: { name: "임과장", email: "lim@sinheung.co.kr", phone: "032-000-0000" },
      cc: [],
    },
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

/**
 * 테넌트 스키마 이름 규칙 — BE `ck_workspaces_schema_name` 제약과 같은 식이다.
 * 소문자 `ax_` + 5자리 이상 숫자. 대문자로 쓰지 않는다 — 저장값·URL과 화면이 갈린다.
 */
export const SCHEMA_NAME_RE = /^ax_[0-9]{5,}$/;

/**
 * 다음에 부여될 스키마 이름 — **더미 단계의 후내다.**
 *
 * 실제로는 BE가 INSERT 뒤 PK를 채번하고 나서야 정한다(`ax_` + lpad(id,5,'0')).
 * 그래서 생성 폼에서 미리 보여줄 수 없고, 만든 **뒤에** 결과로만 보여준다.
 */
export function nextSchemaName(list: AdminWorkspace[] = ADMIN_WORKSPACES) {
  return `ax_${String(list.length + 1).padStart(5, "0")}`;
}

export const KRW = new Intl.NumberFormat("ko-KR");

/** 현재 로그인한 운영자 (데모) — 권한 구분이 없으므로 scope 필드를 두지 않는다 */
export const ADMIN_OPERATOR = { name: "김운영", team: "운영팀" };

/**
 * 이번 달 예상 금액 (데모 추정식) — 기본료 + 저장 용량 단가.
 * 실제 금액은 BE 청구 로직에서 온다. 여기 값으로 청구하지 않는다.
 */
export function estimateAmount(ws: AdminWorkspace) {
  const base: Record<Plan, number> = { Enterprise: 4000000, Growth: 900000, Starter: 300000 };
  // BE의 `plan`은 자유 문자열이라 여기 없는 값이 올 수 있다. 그대로 더하면 undefined가 섞여
  // 화면에 NaN원이 뜬다. 모르는 요금제는 기본료 0으로 두고 사용량만 계산한다.
  return (base[ws.plan] ?? 0) + ws.usage.storageGb * 2000;
}

/**
 * 청구 상태 — 미수금이 있으면 그게 상태다. 없으면 청구 예정.
 *
 * 화면 두 곳(요금 목록·상세 청구 내역)이 같은 판정을 쓰므로
 * 여기 한 곳에만 둔다. 흩어져 있으면 한쪽만 고쳐서 같은 고객사에 대해
 * 두 화면이 다른 말을 하게 된다.
 */
export function billingState(ws: AdminWorkspace): BillingState {
  if (ws.invoices.some((i) => i.state === "overdue")) return "overdue";
  return "due";
}

/** 청구 상태 색 — 미수금만 빨강 */
export const BILLING_TONE: Record<BillingState, "green" | "slate" | "red"> = {
  paid: "green",
  due: "slate",
  overdue: "red",
};

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
  contactName: string;
  contactEmail: string;
  contactPhone: string;
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
    return typeof d?.bizNumber === "string" && typeof d?.company === "string" ? d : null;
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

/* ────────────────────────── 감사 로그 (목업) ────────────────────────── */

/**
 * **이것은 감사 증적이 아니다.** 화면 형태를 보여주기 위한 더미다.
 *
 * 감사 로그의 가치는 믿을 수 있다는 것 하나에서 나오는데, 지금 콘솔은 접근 판정이
 * 브라우저에 있고(`INTERNAL_ADMIN_EMAILS`), 기록 주체가 클라이언트이며, 아무것도 저장하지
 * 않는다. 서버 기록과 역할 검사가 붙기 전까지 화면에 경고 배너를 고정한다.
 */
/**
 * BE(`shared.admin_audit_logs.action`)가 남기는 종류와 1:1이다.
 *
 * `terminate`(해지)는 `deactivate`(비활성화)와 다르다 — 계약이 끝난 것과 잠시 멈춘 것이다.
 * `enter`는 운영자가 소속 없이 고객 워크스페이스 안으로 들어간 기록이라 가장 무겁다.
 */
export type AuditAction =
  | "create"
  | "update"
  | "deactivate"
  | "activate"
  | "terminate"
  | "issue_link"
  | "enter";

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  create: "생성",
  update: "수정",
  deactivate: "비활성화",
  activate: "활성화",
  terminate: "해지",
  issue_link: "링크 발급",
  enter: "워크스페이스 진입",
};

export type AuditEntry = {
  /** "2026-09-01 14:20" — 저장된 문자열이다. 렌더에서 `new Date()`로 만들지 않는다 */
  at: string;
  operator: string;
  action: AuditAction;
  /** 워크스페이스 스키마 이름 — 상세 링크에 쓴다 */
  targetSchema: string;
  targetName: string;
  /** 무엇이 어떻게 바뀌었는지 한 줄. 없으면 "—" */
  detail: string;
};

/**
 * 시각 내림차순으로 저장한다. `at`이 "YYYY-MM-DD HH:MM" 고정 폭이라
 * 문자열 비교가 곳 시각 비교다 — 화면에서도 `localeCompare`로 정렬한다.
 *
 * 상태 변화는 더미의 현재 상태와 앞뒤가 맞다:
 * ax_00004 금호식품은 08-21 활성화 뒤 08-31 비활성화(현재 suspended),
 * ax_00005 남양정밀은 08-26 비활성화 뒤 08-28 활성화(현재 active).
 */
export const AUDIT_LOG: AuditEntry[] = [
  { at: "2026-09-01 14:20", operator: "김운영", action: "update", targetSchema: "ax_00001", targetName: "한빛제철 주식회사", detail: "요금제 Growth → Enterprise" },
  { at: "2026-09-01 11:05", operator: "박운영", action: "update", targetSchema: "ax_00006", targetName: "태양전자 주식회사", detail: "세금계산서 수신 주소 변경" },
  { at: "2026-09-01 09:40", operator: "이운영", action: "update", targetSchema: "ax_00005", targetName: "남양정밀 주식회사", detail: "운영자 메모 수정" },
  { at: "2026-08-31 17:40", operator: "김운영", action: "deactivate", targetSchema: "ax_00004", targetName: "금호식품 주식회사", detail: "—" },
  { at: "2026-08-31 16:12", operator: "박운영", action: "update", targetSchema: "ax_00002", targetName: "대성화학 주식회사", detail: "담당자 이메일 변경" },
  { at: "2026-08-31 10:05", operator: "이운영", action: "update", targetSchema: "ax_00003", targetName: "서진모빌리티 주식회사", detail: "본사 주소 수정" },
  { at: "2026-08-29 15:33", operator: "김운영", action: "update", targetSchema: "ax_00001", targetName: "한빛제철 주식회사", detail: "운영자 메모 수정" },
  { at: "2026-08-28 13:47", operator: "박운영", action: "activate", targetSchema: "ax_00005", targetName: "남양정밀 주식회사", detail: "—" },
  { at: "2026-08-28 11:20", operator: "이운영", action: "update", targetSchema: "ax_00007", targetName: "신흥포장 주식회사", detail: "세금계산서 수신 추가" },
  { at: "2026-08-27 16:58", operator: "김운영", action: "create", targetSchema: "ax_00007", targetName: "신흥포장 주식회사", detail: "—" },
  { at: "2026-08-27 09:15", operator: "박운영", action: "update", targetSchema: "ax_00006", targetName: "태양전자 주식회사", detail: "참조 수신 1명 추가" },
  { at: "2026-08-26 14:02", operator: "이운영", action: "deactivate", targetSchema: "ax_00005", targetName: "남양정밀 주식회사", detail: "—" },
  { at: "2026-08-25 17:22", operator: "김운영", action: "create", targetSchema: "ax_00003", targetName: "서진모빌리티 주식회사", detail: "—" },
  { at: "2026-08-25 10:41", operator: "박운영", action: "update", targetSchema: "ax_00002", targetName: "대성화학 주식회사", detail: "요금제 Starter → Growth" },
  { at: "2026-08-24 15:09", operator: "이운영", action: "update", targetSchema: "ax_00004", targetName: "금호식품 주식회사", detail: "운영자 메모 수정" },
  { at: "2026-08-22 11:37", operator: "김운영", action: "update", targetSchema: "ax_00001", targetName: "한빛제철 주식회사", detail: "법인등록번호 수정" },
  { at: "2026-08-21 16:44", operator: "박운영", action: "activate", targetSchema: "ax_00004", targetName: "금호식품 주식회사", detail: "—" },
  { at: "2026-08-20 09:58", operator: "이운영", action: "update", targetSchema: "ax_00006", targetName: "태양전자 주식회사", detail: "담당자 연락처 수정" },
];


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
