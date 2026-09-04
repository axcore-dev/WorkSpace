import type { ICON_MAP } from "@/components/icons";
import type { SocialProvider } from "@/lib/auth";
import { MODULES } from "./modules";
import { WORKSPACE_PERMS } from "./roles";
import type { DataScope, RoleDef } from "./roles";
import type { Tone } from "./types";

/**
 * 기능 권한 id 전체 — 서브기능 27개.
 *
 * 목록을 손으로 적지 않는다. `data/modules.ts`에 서브기능이 하나 늘면 여기 자동으로 따라오고,
 * 안 그러면 「모든 권한」이라는 역할이 새 기능만 빠진 채로 남는다.
 */
const ALL_FEATURE_PERMS = MODULES.flatMap((m) => m.subfunctions.map((s) => s.id));

/** 조직/워크스페이스·설정 관련 더미 데이터 */

/** 데모 자동 로그인 계정 — 실제 배포: axcore.it.kr */
export const DEMO_USER = {
  name: "박데모",
  email: "demo@axcore.it.kr",
  role: "관리자",
  /** 부서를 별도 필드로 뺐으므로 직책만 남긴다 (이전 값: "제조혁신팀 팀장") */
  title: "팀장",
  dept: "제조혁신팀",
  empNo: "D-20180417",
  /** 지금까지 account-settings.tsx가 SMS 2FA 대상으로 하드코딩하던 값 */
  phone: "010-1234-5678",
  site: "본사",
  company: "(주)데모컴퍼니",
  initials: "박",
  /** 문의·감사 로그 조회용 식별자 */
  userId: "3a5d872b-594c-816f-8386-0002e81c3bdc",
};

/** 내부 관리자(AXCORE 운영) 데모 계정 — 계약 시 고객 워크스페이스를 개설하는 쪽 */
export const DEMO_ADMIN = {
  name: "운영팀",
  email: "ops@axcore.ai.kr",
  role: "내부 관리자",
};

/**
 * 로그인 후 내부 관리자 콘솔로 보낼 계정 목록.
 * 데모 분기용이며 **보안 경계가 아니다** — 실제 판정은 BE 세션의 역할로 한다.
 */
export const INTERNAL_ADMIN_EMAILS = [DEMO_ADMIN.email];

/** 개설 대기 화면에서 안내하는 문의처 (데모 값) */
export const SUPPORT_EMAIL = "support@axcore.ai.kr";

/** 사이드바 조직(워크스페이스) 선택기 — 기본값은 데모컴퍼니 */
export const WORKSPACES: { id: string; name: string; role: string; plan: string }[] = [
  { id: "democompany", name: "(주)데모컴퍼니", role: "관리자", plan: "AX 엔터프라이즈" },
  { id: "demo-jeonggong", name: "데모정공 (주)", role: "구성원", plan: "AX 스탠다드" },
  { id: "demo-tech", name: "데모테크놀로지", role: "구성원", plan: "AX 스탠다드" },
];

export const DEFAULT_WORKSPACE_ID = "democompany";

/** 관리 > 사용자 및 역할 (RBAC) */
export const USERS_ROLES: {
  name: string;
  email: string;
  role: string;
  dept: string;
  lastActive: string;
  status: { badge: string; tone: Tone };
}[] = [
  { name: "박데모", email: "demo@democompany.co.kr", role: "관리자", dept: "제조혁신팀", lastActive: "방금 전", status: { badge: "활성", tone: "green" } },
  { name: "김재현", email: "jhkim@democompany.co.kr", role: "공장장", dept: "생산본부", lastActive: "10분 전", status: { badge: "활성", tone: "green" } },
  { name: "이수진", email: "sjlee@democompany.co.kr", role: "품질 관리자", dept: "품질관리팀", lastActive: "1시간 전", status: { badge: "활성", tone: "green" } },
  { name: "정민호", email: "mhjung@democompany.co.kr", role: "설비 관리자", dept: "설비보전팀", lastActive: "3시간 전", status: { badge: "활성", tone: "green" } },
  { name: "오세라", email: "sroh@democompany.co.kr", role: "구매 담당", dept: "구매자재팀", lastActive: "어제", status: { badge: "활성", tone: "green" } },
  { name: "문가영", email: "gymoon@democompany.co.kr", role: "일반 사용자", dept: "해외영업팀", lastActive: "5일 전", status: { badge: "초대 대기", tone: "amber" } },
];

export const DATA_SCOPES: { value: DataScope; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "dept", label: "부서" },
  { value: "own", label: "본인" },
];

/**
 * 역할 정의 — 단일 소스.
 *
 * `name`은 `USERS_ROLES[].role`에 실제로 쓰인 값과 같아야 한다 — `roleMemberCount`가
 * 이름으로 맞추므로 어긋나면 구성원 수가 전부 0이 된다. `data/roles.test.ts`가 이걸 검증한다.
 *
 * **부서 → 역할 → 권한 3단이다** (수정요청 v12). 역할은 부서에 속하고, 권한은 켜진 것의
 * 목록이다. 예전에는 역할이 평면이었고 권한이 모듈 8개 × 없음/읽기/쓰기 격자였는데,
 * "생산관리 전부 or 전무"라 실무에서 못 쓴다. 이제 서브기능 27개 + 워크스페이스 권한 4개를
 * 개별로 켠다.
 *
 * `dept: null`은 부서에 속하지 않는다는 뜻이다 — 소유자 하나뿐이다.
 *
 * **이 값은 보안 경계가 아니다** — 실제 차단은 BE 세션의 역할 검사에서 한다.
 */
export const ROLES: RoleDef[] = [
  {
    id: "owner",
    name: "소유자",
    system: true,
    dept: null,
    desc: "모든 권한을 가진 최고 관리자",
    perms: [...WORKSPACE_PERMS.map((p) => p.id), ...ALL_FEATURE_PERMS],
    scope: "all",
    showAmounts: true,
    canDelegateInvite: true,
  },
  {
    id: "admin",
    name: "관리자",
    system: true,
    dept: "제조혁신팀",
    desc: "회사 삭제를 뺀 모든 권한",
    perms: [
      "ws:info", "ws:members", "ws:integrations",
      ...ALL_FEATURE_PERMS,
    ],
    scope: "all",
    showAmounts: true,
    canDelegateInvite: true,
  },
  {
    id: "plant-head",
    name: "공장장",
    system: false,
    dept: "생산본부",
    perms: [
      "ws:members",
      "monitoring", "workorders", "bottleneck", "reporting",
      "predict", "maintenance",
      "defects", "control",
      "items", "stock", "safety",
      "drawings", "bom",
    ],
    scope: "all",
    showAmounts: true,
    canDelegateInvite: false,
  },
  {
    id: "quality-mgr",
    name: "품질 관리자",
    system: false,
    dept: "품질관리팀",
    perms: ["defects", "control", "receiving", "specs", "tickets", "voc"],
    scope: "dept",
    showAmounts: false,
    canDelegateInvite: false,
  },
  {
    id: "equipment-mgr",
    name: "설비 관리자",
    system: false,
    dept: "설비보전팀",
    perms: ["predict", "maintenance", "monitoring", "defects"],
    scope: "dept",
    showAmounts: false,
    canDelegateInvite: false,
  },
  {
    id: "buyer",
    name: "구매 담당",
    system: false,
    dept: "구매자재팀",
    perms: ["purchasing", "items", "stock", "safety", "movements", "materials", "accounting"],
    scope: "dept",
    showAmounts: true,
    canDelegateInvite: false,
  },
  {
    id: "member",
    name: "일반 사용자",
    system: false,
    dept: "해외영업팀",
    perms: ["orders", "quotes", "forecast", "tickets", "tracking"],
    scope: "own",
    showAmounts: false,
    canDelegateInvite: false,
  },
];

/** 관리 › 초대 관리 › 초대 중인 구성원 — 보냈지만 아직 안 받은 것 */
export const PENDING_INVITES: {
  id: string;
  name: string;
  email: string;
  dept: string;
  role: string;
  /** 초대 메일 발송일 · 유효기간 — 표의 열이라 절대 날짜다. "3일 전"은 정렬도 비교도 안 된다 */
  sentAt: string;
  expiresAt: string;
}[] = [
  { id: "i1", name: "문가영", email: "gymoon@democompany.co.kr", dept: "해외영업팀", role: "일반 사용자", sentAt: "2026-09-01", expiresAt: "2026-09-08" },
  { id: "i2", name: "한지우", email: "jwhan@democompany.co.kr", dept: "품질관리팀", role: "품질 관리자", sentAt: "2026-09-04", expiresAt: "2026-09-11" },
];

/** 관리 › 초대 관리 › 초대 링크 — 받은 사람 누구나 쓸 수 있어 역할·부서를 미리 박아둔다 */
export const INVITE_LINKS: {
  id: string;
  url: string;
  role: string;
  dept: string;
  used: number;
  limit: number;
  /** 링크 만료일시 — 표의 열이라 시각까지 적는다. 만료가 하루 안에 갈리는 링크가 있다 */
  expiresAt: string;
  active: boolean;
}[] = [
  { id: "l1", url: "https://axcore.it.kr/invite/aB3xK9mQ", role: "일반 사용자", dept: "생산본부", used: 3, limit: 10, expiresAt: "2026-09-09 18:00", active: true },
  { id: "l2", url: "https://axcore.it.kr/invite/7Zp2Rt", role: "품질 관리자", dept: "품질관리팀", used: 1, limit: 1, expiresAt: "2026-09-02 09:00", active: false },
];

/** 부서 — 프로필·초대·권한 관리가 같이 본다 */
export const DEPARTMENTS = [
  "제조혁신팀",
  "생산본부",
  "품질관리팀",
  "설비보전팀",
  "구매자재팀",
  "해외영업팀",
] as const;

/** 사업장 — `EXTERNAL_SYSTEMS`에 "1공장 MES"가 있는 전제 */
export const SITES = ["본사", "1공장", "2공장"] as const;

/**
 * 계정 › 이메일.
 *
 * BE에는 **대표 이메일 재인증만** 있다 (`POST /api/auth/email/verify-request`). 추가 이메일
 * API는 없어서, 두 번째 항목은 화면에 자리만 두고 버튼을 비활성으로 둔다.
 */
export const ACCOUNT_EMAILS: {
  address: string;
  primary: boolean;
  verified: boolean;
  /** 인증 대기 중일 때 마지막 발송 시점 (표시용 문구) */
  sentAt?: string;
}[] = [
  { address: "demo@axcore.it.kr", primary: true, verified: true },
  { address: "demo@democompany.co.kr", primary: false, verified: false, sentAt: "2일 전" },
];

/**
 * 계정 › 소셜 로그인.
 *
 * **제공자는 `lib/auth.ts`의 `SocialProvider`가 단일 소스다** — `google`·`naver` 둘뿐이다.
 * 이름은 `PROVIDER_LABELS`를 읽어 쓴다. Microsoft·Kakao를 넣지 않는 이유는 그 제공자가
 * `lib/auth.ts`에 없어서다 — 눌러도 아무 일이 일어나지 않는다.
 *
 * 연동 해제 API는 BE에 없다. 화면은 상태만 보이고 해제 버튼은 비활성으로 둔다.
 */
export const SOCIAL_LOGINS: {
  provider: SocialProvider;
  account?: string;
  connected: boolean;
}[] = [
  { provider: "google", account: "demo@democompany.co.kr", connected: true },
  { provider: "naver", connected: false },
];

/**
 * 계정 › 기기 — 활성 세션.
 *
 * 현장 공용 단말을 로그아웃하지 않고 떠나는 일이 잦아서 넣었다.
 * BE에 `GET /api/auth/sessions`가 이미 있다 — 이 더미는 연동 전까지만 쓴다.
 */
export const DEVICES: {
  id: string;
  name: string;
  detail?: string;
  lastActive: string;
  location: string;
  /** 지금 보고 있는 기기 — 로그아웃 버튼을 주지 않는다 */
  current: boolean;
}[] = [
  { id: "d1", name: "Windows · Chrome", lastActive: "지금", location: "본사 · KR", current: true },
  { id: "d2", name: "1공장 공용 태블릿 · Android", detail: "현장 검사 단말", lastActive: "2026-09-02 14:20", location: "1공장 · KR", current: false },
  { id: "d3", name: "iPhone · Safari", lastActive: "2026-08-28 09:10", location: "알 수 없음", current: false },
];

/** 설정 > 외부 시스템 연동 — name은 사용자 설정 이름, system은 실제 시스템 명 */
export const CONNECTORS: {
  name: string;
  system: string;
  type: string;
  endpoint: string;
  status: { badge: string; tone: Tone };
}[] = [
  { name: "본사 ERP", system: "더존비즈온 iCUBE", type: "ERP", endpoint: "https://erp.democompany.co.kr/api", status: { badge: "정상", tone: "green" } },
  { name: "1공장 MES", system: "미라콤 MESplus", type: "MES", endpoint: "https://mes.democompany.local/v2", status: { badge: "정상", tone: "green" } },
  { name: "설비 IoT 게이트웨이", system: "PTC ThingWorx", type: "센서", endpoint: "mqtt://iot.democompany.local:8883", status: { badge: "지연", tone: "amber" } },
];

/** 외부 시스템 추가/설정 팝업의 시스템 유형 목록 */
export const CONNECTOR_TYPES = ["ERP", "MES", "PLM", "QMS", "WMS", "CRM", "센서", "기타"];

/**
 * 좌측 패널 외부 시스템 바로가기 — name은 사용자가 설정한 "목록에 표시될 이름"(CONNECTORS와 동일).
 * 임시로 IFrame 임베드로 노출한다. embed 종류:
 *  - image: 스크린샷 이미지로 대체
 *  - iframe: 실제 페이지 임베드
 *  - login: X-Frame-Options 등으로 임베드가 막힌 시스템 — 로그인 안내 목업 버튼만 표시
 */
export const EXTERNAL_SYSTEMS: {
  slug: string;
  name: string;
  system: string;
  /** 사이드바 축소 모드(80px)에서는 아이콘만 남는다 — 없으면 빈 줄이 된다 */
  icon: keyof typeof ICON_MAP;
  embed:
    | { kind: "image"; src: string }
    | { kind: "iframe"; src: string }
    | { kind: "login"; href: string };
}[] = [
  {
    slug: "hq-erp",
    name: "본사 ERP",
    system: "더존비즈온 iCUBE",
    icon: "database",
    embed: { kind: "image", src: "/assets/ExternalSystem/더존erp_1.jpg" },
  },
  {
    slug: "factory1-mes",
    name: "1공장 MES",
    system: "미라콤 Nexplant MESplus",
    icon: "hardDrive",
    embed: { kind: "iframe", src: "https://www.mespluscloud.com/exper/demo" },
  },
  {
    slug: "iot-gateway",
    name: "설비 IoT 게이트웨이",
    system: "PTC ThingWorx",
    icon: "cpu",
    embed: {
      kind: "login",
      href: "https://www.ptc.com/ko/products/thingworx?srsltid=AfmBOoq0MUqQgEo-LZR6yyYOG_k70srp7R7RWvlQ_6WDNkUpzwITiV8t#key-drivers",
    },
  },
];


/** 법인(신용)정보 수집·이용 동의 전문 (요약 더미) */
export const CONSENT_TEXT = {
  title: "법인(신용)정보 수집·이용 동의",
  version: "v1.2 (2026-05-01 시행)",
  sections: [
    {
      heading: "1. 수집·이용 목적",
      body: "워크스페이스(조직) 개설 심사, 서비스 계약의 체결·이행, 요금 정산, 부정 이용 방지",
    },
    {
      heading: "2. 수집 항목",
      body: "사업자등록번호, 상호, 대표자 성명, 사업장 주소, 업종·업태, 법인 신용평가 등급(신용정보원 제공)",
    },
    {
      heading: "3. 보유·이용 기간",
      body: "서비스 이용 계약 종료 후 5년까지 (관련 법령에 따른 보존 기간 포함)",
    },
    {
      heading: "4. 동의 거부 권리",
      body: "동의를 거부할 수 있으나, 거부 시 워크스페이스 생성이 제한됩니다.",
    },
  ],
};
