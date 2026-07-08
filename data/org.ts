import type { Tone } from "./types";

/** 조직/워크스페이스·설정 관련 더미 데이터 */

/** 워크스페이스 생성 단계의 조직 검색 결과 */
export const ORG_DIRECTORY: {
  bizNumber: string;
  name: string;
  ceo: string;
  address: string;
  hasWorkspace: boolean;
  members?: number;
}[] = [
  {
    bizNumber: "123-86-01234",
    name: "(주)데모컴퍼니",
    ceo: "김정호",
    address: "경기도 안산시 단원구 성곡동",
    hasWorkspace: true,
    members: 42,
  },
  {
    bizNumber: "220-81-45678",
    name: "데모정공 (주)",
    ceo: "박민수",
    address: "인천광역시 남동구 논현동",
    hasWorkspace: false,
  },
  {
    bizNumber: "312-86-77890",
    name: "데모테크놀로지",
    ceo: "이서연",
    address: "충남 천안시 서북구 백석동",
    hasWorkspace: false,
  },
];

/** 데모 자동 로그인 계정 — 실제 배포: axcore.it.kr */
export const DEMO_USER = {
  name: "박데모",
  email: "demo@axcore.it.kr",
  role: "관리자",
  title: "제조혁신팀 팀장",
  company: "(주)데모컴퍼니",
  initials: "박",
};

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
  embed:
    | { kind: "image"; src: string }
    | { kind: "iframe"; src: string }
    | { kind: "login"; href: string };
}[] = [
  {
    slug: "hq-erp",
    name: "본사 ERP",
    system: "더존비즈온 iCUBE",
    embed: { kind: "image", src: "/assets/ExternalSystem/더존erp_1.jpg" },
  },
  {
    slug: "factory1-mes",
    name: "1공장 MES",
    system: "미라콤 Nexplant MESplus",
    embed: { kind: "iframe", src: "https://www.mespluscloud.com/exper/demo" },
  },
  {
    slug: "iot-gateway",
    name: "설비 IoT 게이트웨이",
    system: "PTC ThingWorx",
    embed: {
      kind: "login",
      href: "https://www.ptc.com/ko/products/thingworx?srsltid=AfmBOoq0MUqQgEo-LZR6yyYOG_k70srp7R7RWvlQ_6WDNkUpzwITiV8t#key-drivers",
    },
  },
];

/** 설정 > 모듈 간 데이터 연동 규칙 */
export const SYNC_RULES: {
  from: string;
  to: string;
  rule: string;
  status: { badge: string; tone: Tone };
}[] = [
  { from: "제품설계 (BOM)", to: "경영지원 (자재)", rule: "BOM 변경 시 자재 소요량 재계산", status: { badge: "동작중", tone: "green" } },
  { from: "영업관리 (수주)", to: "생산관리 (계획)", rule: "수주 확정 시 생산 계획 자동 제안", status: { badge: "동작중", tone: "green" } },
  { from: "품질검사 (불량)", to: "장비관리 (정비)", rule: "설비 기인 불량 발생 시 정비 점검 연계", status: { badge: "동작중", tone: "green" } },
  { from: "재고·물류 (안전재고)", to: "경영지원 (구매)", rule: "기준 미달 시 발주 권고 생성", status: { badge: "동작중", tone: "green" } },
  { from: "경영지원 (인사)", to: "생산관리 (작업배분)", rule: "교대 조 편성 정보 동기화", status: { badge: "비활성 (서브기능 OFF)", tone: "slate" } },
];

/** 설정 > 외부 서비스 연동 — icon은 브랜드 로고 슬러그(brand-icons.tsx) */
export const EXTERNAL_SERVICES: {
  id: string;
  name: string;
  icon: string;
  desc: string;
  connected: boolean;
  account?: string;
}[] = [
  { id: "slack", name: "Slack", icon: "slack", desc: "이상 감지·작업 지시 알림 전송", connected: true, account: "democompany-precision.slack.com" },
  { id: "gmail", name: "Gmail", icon: "gmail", desc: "분석 결과 리포트 공유", connected: true, account: "demo@democompany.co.kr" },
  { id: "drive", name: "Google Drive", icon: "googledrive", desc: "문서 백업·가져오기", connected: false },
  { id: "calendar", name: "Google Calendar", icon: "googlecalendar", desc: "정비 일정 자동 등록", connected: true, account: "demo@democompany.co.kr" },
  { id: "notion", name: "Notion", icon: "notion", desc: "이슈·조치 내역 기록", connected: false },
];

/** 설정 > 알림 설정 */
export const NOTIFICATION_PREFS: {
  event: string;
  channels: { inapp: boolean; email: boolean; slack: boolean };
}[] = [
  { event: "공정 이상 징후 (긴급)", channels: { inapp: true, email: true, slack: true } },
  { event: "설비 예지보전 경고", channels: { inapp: true, email: true, slack: true } },
  { event: "안전 재고 미달", channels: { inapp: true, email: false, slack: true } },
  { event: "스케줄링 최적화 제안", channels: { inapp: true, email: false, slack: false } },
  { event: "AS 티켓 접수", channels: { inapp: true, email: true, slack: false } },
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
