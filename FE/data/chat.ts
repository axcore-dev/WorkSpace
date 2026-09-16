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
  tools: string[];
  /** 아이콘·결과가 붙은 상세 추론 단계 */
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
  /** AI 가 만든 파일(docx · xlsx). 화면이 내려받기 버튼을 그린다 — `GET /ai/exports/:exportId?name=` */
  files?: { exportId: string; fileName: string }[];
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
/**
 * 스킬 — 이 턴에 모델이 따를 작업 방식. `instructions` 가 시스템 프롬프트에 그대로 붙는다(`chat-llm.ts` skillInstructions).
 *
 * 문서를 만드는 스킬은 **답 자체가 문서**다 — 마크다운 제목 · 표 · 목록으로 바로 복사해 쓸 수 있게 쓴다. 수치는 지어내지
 * 않고 업무 데이터 도구로 조회해 출처를 적는다. 파일(docx · xlsx)이 필요하면 `export_document` 도구가 만든다(`server/export-tools.ts`).
 */
/** 스킬 분야 — 모달이 이 순서로 묶어 보인다. slug 는 `ai_skills.category` 에 그대로 저장된다 */
export const SKILL_CATEGORIES = [
  { id: "doc", name: "문서 작성" },
  { id: "data", name: "데이터 정리" },
  { id: "production", name: "생산 · 품질" },
  { id: "purchase", name: "구매 · 경영" },
  { id: "other", name: "기타" },
] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number]["id"];

export interface Skill {
  /** 기본 제공은 코드의 slug, 회사 스킬은 `co-<행 id>` (`lib/ai/skills.ts`) */
  id: string;
  name: string;
  desc: string;
  category: SkillCategory;
  /** 워크스페이스가 기본 제공하는 스킬 — 회사가 만든 스킬(`ai_skills` 행)과 구분해 배지를 붙인다 */
  official?: boolean;
  /** 모델에게 주는 작업 방식. 양식 · 순서 · 하지 말 것 */
  instructions: string;
}

export const SKILL_LIB: Skill[] = [
  {
    id: "doc-report",
    category: "doc",
    name: "업무 보고서 작성",
    desc: "주간·월간·현황 보고서를 사내 양식으로. 수치는 업무 데이터에서 조회해 출처를 적는 스킬",
    official: true,
    instructions:
      "답 자체가 보고서다. 구조: # 제목(무엇 · 기간) → 요약 3줄(결론 먼저) → 실적/현황 표(항목 · 수치 · 전 기간 대비 · 비고) → 이슈와 원인 → 다음 기간 계획 → 출처. " +
      "수치 · 건수 · 상태는 반드시 업무 데이터 도구로 조회하고, 조회하지 못한 항목은 「확인 필요」로 남긴다. 지어내지 않는다. " +
      "표의 숫자에는 단위와 기준일을 적는다. 문장은 개조식(-체)으로 짧게. 사용자가 기간 · 대상을 말하지 않았으면 먼저 한 줄로 되묻지 말고 이번 주 · 전체를 기본으로 쓰고 그렇게 가정했다고 첫 줄에 적는다.",
  },
  {
    id: "doc-official",
    category: "doc",
    name: "공문·협조전 작성",
    desc: "수신·참조·제목·본문·붙임·발신 순의 공문 양식으로 대외 문서나 부서 간 협조전을 작성하는 스킬",
    official: true,
    instructions:
      "공문 양식으로 쓴다: 문서번호(빈칸) · 시행일(오늘) · 수신 · 참조 · 제목 → 본문(1. 경위 2. 요청 사항 3. 기한 · 회신 방법) → 붙임 → 발신(회사명 · 부서 · 담당자 · 연락처는 사용자가 준 것만). " +
      "본문은 격식체(-합니다), 항목은 1. 2. 3. 번호로. 사용자가 준 사실만 쓰고 모르는 값은 [ ] 로 비워 둔다. 마지막에 「끝.」을 붙인다.",
  },
  {
    id: "doc-email",
    category: "doc",
    name: "거래처 메일 작성",
    desc: "발주 · 납기 · 품질 문의 등 거래처에 보내는 메일을 제목부터 마무리까지 쓰는 스킬",
    official: true,
    instructions:
      "메일 한 통을 완성한다: 제목 한 줄(용건 + 식별자: 발주번호 · 도면번호 등) → 인사 → 용건(무엇을 · 왜) → 요청 사항과 기한 → 첨부 안내 → 마무리 인사 · 서명 자리. " +
      "존댓말, 한 문단 3문장 이내. 발주번호 · 수량 · 납기 같은 값은 업무 데이터 도구로 확인해 쓰고, 확인 못 한 값은 [확인 필요] 로 표시한다. 상대가 모르는 사내 용어는 풀어 쓴다.",
  },
  {
    id: "data-table",
    category: "data",
    name: "데이터 요약표",
    desc: "업무 데이터를 조회해 표로 정리하고 합계 · 평균 · 상위 항목을 덧붙이는 스킬",
    official: true,
    instructions:
      "답의 중심은 표다. 업무 데이터 도구로 조회한 행을 요청한 기준으로 정렬해 마크다운 표로 만들고, 아래에 합계 · 평균 · 최댓값 같은 요약 한 줄과 눈에 띄는 점 두 줄을 적는다. " +
      "표는 20행까지만 보이고 넘으면 「외 N건」으로 적는다. 숫자는 단위 · 소수 자릿수를 맞추고, 조회한 전체 건수(total)와 기준 시각을 표 아래에 적는다.",
  },
  {
    id: "daily-report",
    category: "production",
    name: "일일 생산보고 작성",
    desc: "사내 보고 양식과 결재선 규칙대로 일일 생산·품질 보고서를 작성하는 스킬",
    official: true,
    instructions:
      "오늘(또는 사용자가 말한 날)의 생산 · 품질 보고서를 쓴다. 구조: 제목(일자 · 라인) → 요약 → 작업지시별 실적 표(작업지시 · 제품 · 계획 · 양품 · 불량 · 진행률) → 비가동 · 불량 특이사항 → 내일 계획 → 결재선 자리(담당 · 검토 · 승인). " +
      "실적 · 비가동 · 불량은 업무 데이터 도구(작업지시 · 공정 실적 · 비가동 · 불량 개념)로 조회한다. 없는 값은 「확인 필요」.",
  },
  {
    id: "rca",
    category: "production",
    name: "불량 원인 분석(RCA)",
    desc: "5Why·특성요인도 절차에 따라 근본 원인을 도출하고 시정조치를 제안하는 스킬",
    official: true,
    instructions:
      "문제 정의(무엇이 · 언제 · 어디서 · 얼마나) → 사실 수집(불량 기록 · 실적 · 비가동을 업무 데이터 도구로 조회) → 5Why 표(Why 1~5 · 근거) → 특성요인도 4M(사람 · 설비 · 자재 · 방법)별 후보 → 근본 원인 → 시정조치(즉시 · 재발 방지, 담당 · 기한 자리). " +
      "근거가 없는 원인은 「가설」로 표시하고 확인 방법을 적는다.",
  },
  {
    id: "po-draft",
    category: "purchase",
    name: "구매 기안 작성",
    desc: "품의 규정·승인 한도에 맞춰 구매 기안 문서를 작성하는 스킬",
    official: true,
    instructions:
      "구매 기안 양식: 제목 → 구매 목적 · 배경 → 품목 표(품목 코드 · 품명 · 규격 · 수량 · 단가 · 금액 · 거래처 · 납기) → 총액(부가세 별도 표기) → 예산 · 승인 한도 검토 → 결재선 자리. " +
      "품목 · 거래처 · 재고 · 안전재고는 업무 데이터 도구로 조회해 근거(현재 재고 · 안전재고 미달)를 적는다. 단가를 모르면 [단가 확인] 으로 둔다.",
  },
  {
    id: "sop-answer",
    category: "production",
    name: "작업표준 안내",
    desc: "작업표준서(SOP) 해당 조항을 인용해 현장 질문에 답변하는 스킬",
    official: true,
    instructions:
      "참고 문서에서 해당 조항을 찾아 「문서명 · 조항」을 먼저 인용하고, 그 조항을 현장 말로 풀어 단계별로 답한다. 문서에 없는 절차는 만들어 내지 않고 「표준서에 없음 — 담당자 확인」으로 답한다. 안전 관련 항목은 맨 위에 둔다.",
  },
  {
    id: "meeting",
    category: "doc",
    name: "회의록 정리",
    desc: "회의 내용을 사내 회의록 양식으로 요약하고 액션 아이템을 추출하는 스킬",
    official: true,
    instructions:
      "회의록 양식: 회의명 · 일시 · 참석자 → 안건별 논의 요약(결정 사항을 굵게) → 액션 아이템 표(할 일 · 담당 · 기한) → 다음 회의. 사용자가 준 내용만 쓰고 담당 · 기한이 없으면 [미정] 으로 둔다.",
  },
];
