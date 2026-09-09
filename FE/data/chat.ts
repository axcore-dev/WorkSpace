/**
 * AI대화 도메인 타입 + 커넥터·스킬 카탈로그.
 *
 * 이 타입들은 화면이 쓰는 모양이다. 서버가 내는 스트림 파트는 `lib/ai/ui-messages.ts` 가
 * 정의하고, 같은 파일의 `toChatMessage` 가 그걸 여기 모양으로 접는다.
 */

/** 소스 문서 한 건 — 대화(노트북)마다 따로 들고 있다 */
export interface SourceDoc {
  /** 서버가 발급한 문서 id. 열기·삭제 요청에 쓴다. 서버를 거치지 않은 옛 저장본에는 없다 */
  id?: string;
  name: string;
  type: string;
  scope: "개인" | "팀" | "전사";
  updated: string;
  /** 색인 상태. indexing 동안은 검색에 잡히지 않고, failed 면 다시 올려야 한다 */
  status?: "indexing" | "ready" | "failed";
  /** 업무 분야(핵심 기능 slug, `MODULES`). 색인 때 모델이 분류한다. 없으면 분야 제한 없음 */
  module?: string;
}

/** 대화별 소스 상태 — 새 대화는 빈 노트북으로 시작한다 */
export interface SourceState {
  sources: SourceDoc[];
  selected: string[];
}

/**
 * 대화(노트북) 한 건. 서버(테넌트 스키마 `ai_conversations`)가 원본이고 화면은 불러와서 든다.
 * `messages` 는 대화를 열 때 받아오므로 목록만 있는 상태에서는 비어 있고 `loaded` 가 false 다.
 */
export interface Note {
  /** 서버가 발급한 대화 id(uuid) */
  id: string;
  title: string;
  messages: ChatMessage[];
  src: SourceState;
  /** 메시지를 서버에서 받아왔는지. 목록만 있는 상태와 "정말 빈 대화" 를 구분한다 */
  loaded: boolean;
}

/** 도구 실행 승인 요청 — 되돌리기 어려운 도구는 모델이 제안만 하고 사용자가 여기서 결정한다 */
export interface ToolApproval {
  approvalId: string;
  toolName: string;
  /** 사람이 읽는 도구 이름 */
  label: string;
  /** 모델이 채운 입력. 카드에 그대로 보여 준다 */
  input: unknown;
  /** 승인·거절이 끝났는지. 끝난 카드는 버튼 대신 결과를 보여 준다 */
  decision?: "approved" | "denied";
}

export interface ChatSource {
  doc: string;
  snippet: string;
}

/** 추론 과정 한 단계 — 도구 사용·앱 방문을 아이콘과 함께 표시 (레퍼런스: AI 추론 과정) */
export interface TraceStep {
  icon?: "search" | "data" | "doc" | "calendar" | "mail" | "app" | "model";
  /**
   * 이 단계가 실제로 호출한 외부 앱의 커넥터 slug (`CONNECTOR_LIB`, `public/brands/`).
   * 있으면 일반 아이콘 대신 그 앱의 공식 심볼 마크를 그린다. 사내 모듈 조회·모델 추론처럼
   * 외부 앱이 아닌 단계는 비워 둔다 — BE가 도구 이름과 함께 내려준다.
   */
  brand?: string;
  text: string;
  /** 우측에 표시되는 결과 요약 (예: "결과 9개") */
  result?: string;
  /** 행을 펼쳤을 때 보이는 도구 입력·출력 — 없으면 펼치지 못한다 */
  input?: string;
  output?: string;
}

export interface ChatProcess {
  sources: string[];
  steps: string[];
  tools: string[];
  /** 아이콘·결과가 붙은 상세 추론 단계 — 없으면 steps로 폴백 */
  trace?: TraceStep[];
  /** 접힘 상태 한 줄 요약 — 없으면 tools에서 자동 생성 */
  summary?: string;
}

export interface OcrProposal {
  docName: string;
  targetModule: string;
  fields: { label: string; value: string }[];
  /** 승인/거절이 끝났는지 — 새로고침 뒤에도 버튼이 되살아나지 않도록 메시지에 남긴다 */
  resolved?: boolean;
}

export interface ChatMessage {
  role: "user" | "ai";
  text: string;
  sources?: ChatSource[];
  process?: ChatProcess;
  ocrProposal?: OcrProposal;
  attachment?: string;
  /** 반영 완료 시 해당 기능으로 이동하는 버튼 */
  cta?: { label: string; href: string };
  /** 답변 전 순차 표시되는 추론 과정 문구 (행동 라이팅) */
  reasoning?: string[];
  /** 사용자 평가 — 추후 성능 평가용으로 보관 */
  rating?: "up" | "down";
  /** AI 활동(추론) 시간 — 출처 드로어 상단 "{n}s" */
  durationMs?: number;
  /** 서버 메시지 순번. 편집·다시 시도·평가가 이 값으로 서버 행을 가리킨다. 아직 저장 전이면 없다 */
  seq?: number;
  /** 이 답변에서 모델이 요청한 도구 승인들 */
  approvals?: ToolApproval[];
}

/**
 * 커넥터 목록 — AI 대화가 부를 수 있는 외부 앱. 브랜드 마크는 `public/brands/`.
 *
 * **BE 의 `ConnectorCatalog` 와 같은 순서·같은 slug 여야 한다.** 연결 상태는 여기 없다 — 서버가 준다
 * (`GET /api/workspace/connectors`). 예전의 `connected` 플래그와 `loginUrl` 은 데모라 뺐다.
 *
 * 2026-09-08 에 14개에서 6개로 줄였다. 카카오워크 · 네이버웍스 · 잔디 · Teams · Excel · Outlook · 이카운트 · 더존은
 * 파트너 승인이나 API 계약이 앞에 있어 1차에서 뺐다. 구글 넷은 계정 하나에 스코프만 다르다.
 */
export type ConnectorCategory = "메신저·협업" | "문서·데이터" | "메일·일정";

export const CONNECTOR_CATEGORIES: ConnectorCategory[] = ["메신저·협업", "문서·데이터", "메일·일정"];

export const CONNECTOR_LIB: {
  slug: string;
  name: string;
  desc: string;
  category: ConnectorCategory;
  url: string;
}[] = [
  {
    slug: "slack",
    name: "Slack",
    desc: "이상 감지·작업 지시 알림을 보내고 스레드를 요약해요.",
    category: "메신저·협업",
    url: "https://slack.com",
  },
  {
    slug: "googledrive",
    name: "Google Drive",
    desc: "도면·시방서 파일에 바로 접근하고 정리해요.",
    category: "문서·데이터",
    url: "https://drive.google.com",
  },
  {
    slug: "googlesheets",
    name: "Google Sheets",
    desc: "수율·원가 데이터를 표로 정리하고 계산해요.",
    category: "문서·데이터",
    url: "https://docs.google.com/spreadsheets",
  },
  {
    slug: "notion",
    name: "Notion",
    desc: "이슈·조치 내역을 기록하고 워크플로를 자동화해요.",
    category: "문서·데이터",
    url: "https://www.notion.so",
  },
  {
    slug: "gmail",
    name: "Gmail",
    desc: "분석 결과 리포트를 작성·검색하고 메일을 요약해요.",
    category: "메일·일정",
    url: "https://mail.google.com",
  },
  {
    slug: "googlecalendar",
    name: "Google Calendar",
    desc: "정비 일정을 등록하고 일정을 최적화해요.",
    category: "메일·일정",
    url: "https://calendar.google.com",
  },
];

/**
 * 스킬 추가 팝업 목록 — AI Skills.
 * 스킬은 특정 업무의 수행 절차·양식·규칙을 AI에게 가르치는 지침 패키지로,
 * 추가하면 AI가 해당 업무를 사내 규칙대로 수행한다.
 */
export const SKILL_LIB: {
  id: string;
  name: string;
  desc: string;
  /** 워크스페이스가 기본 제공하는 스킬 — 사용자가 만든 스킬과 구분해 배지를 붙인다 */
  official?: boolean;
}[] = [
  {
    id: "daily-report",
    name: "일일 생산보고 작성",
    desc: "사내 보고 양식과 결재선 규칙대로 일일 생산·품질 보고서를 작성하는 스킬",
    official: true,
  },
  {
    id: "rca",
    name: "불량 원인 분석(RCA)",
    desc: "5Why·특성요인도 절차에 따라 근본 원인을 도출하고 시정조치를 제안하는 스킬",
    official: true,
  },
  {
    id: "po-draft",
    name: "구매 기안 작성",
    desc: "품의 규정·승인 한도에 맞춰 구매 기안 문서를 작성하는 스킬",
    official: true,
  },
  {
    id: "sop-answer",
    name: "작업표준 안내",
    desc: "작업표준서(SOP) 해당 조항을 인용해 현장 질문에 답변하는 스킬",
    official: true,
  },
  {
    id: "meeting",
    name: "회의록 정리",
    desc: "회의 내용을 사내 회의록 양식으로 요약하고 액션 아이템을 추출하는 스킬",
    official: true,
  },
];
