/** AI대화 도메인 타입 + 커넥터·스킬 카탈로그. 대화 응답은 BE(`lib/chat-api.ts`)가 낸다 */

/** 소스 문서 한 건 — 대화(노트북)마다 따로 들고 있다 */
export interface SourceDoc {
  name: string;
  type: string;
  scope: "개인" | "팀" | "전사";
  updated: string;
}

/** 대화별 소스 상태 — 새 대화는 빈 노트북으로 시작한다 */
export interface SourceState {
  sources: SourceDoc[];
  selected: string[];
}

/** 대화(노트북) 한 건. localStorage에 이 모양 그대로 저장된다 (`lib/chat-storage.ts`) */
export interface Note {
  id: number;
  title: string;
  messages: ChatMessage[];
  src: SourceState;
}

export interface ChatSource {
  doc: string;
  snippet: string;
}

/** 추론 과정 한 단계 — 도구 사용·앱 방문을 아이콘과 함께 표시 (레퍼런스: AI 추론 과정) */
export interface TraceStep {
  icon?: "search" | "data" | "doc" | "calendar" | "mail" | "app" | "model";
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
}

/**
 * 커넥터 목록 — 한국 제조 현장이 실제로 쓰는 협업·문서·ERP 앱. 브랜드 마크는 `public/brands/`.
 * loginUrl: 연결 클릭 시 여는 로그인 페이지 (Google Calendar는 데모 즉시 연결이라 없음). url: 상세 팝업의 '웹사이트'.
 */
export type ConnectorCategory = "메신저·협업" | "문서·데이터" | "메일·일정" | "ERP·회계";

export const CONNECTOR_CATEGORIES: ConnectorCategory[] = ["메신저·협업", "문서·데이터", "메일·일정", "ERP·회계"];

export const CONNECTOR_LIB: {
  slug: string;
  name: string;
  desc: string;
  category: ConnectorCategory;
  connected?: boolean;
  url: string;
  loginUrl?: string;
}[] = [
  { slug: "slack", name: "Slack", desc: "이상 감지·작업 지시 알림을 보내고 스레드를 요약해요.", category: "메신저·협업", connected: true, url: "https://slack.com", loginUrl: "https://slack.com/signin" },
  { slug: "kakaowork", name: "카카오워크", desc: "현장 알림을 채팅방으로 보내고 결재 요청을 전달해요.", category: "메신저·협업", url: "https://www.kakaowork.com", loginUrl: "https://www.kakaowork.com/login" },
  { slug: "naverworks", name: "네이버웍스", desc: "메시지·게시판·드라이브를 연결해 공지와 문서를 찾아요.", category: "메신저·협업", url: "https://naver.worksmobile.com", loginUrl: "https://auth.worksmobile.com/login" },
  { slug: "jandi", name: "잔디", desc: "토픽에 생산·품질 알림을 올리고 대화를 요약해요.", category: "메신저·협업", url: "https://www.jandi.com", loginUrl: "https://www.jandi.com/landing/kr/login" },
  { slug: "teams", name: "Microsoft Teams", desc: "팀 채널에 리포트를 공유하고 회의록을 정리해요.", category: "메신저·협업", url: "https://www.microsoft.com/microsoft-teams", loginUrl: "https://teams.microsoft.com" },
  { slug: "googledrive", name: "Google Drive", desc: "도면·시방서 파일에 바로 접근하고 정리해요.", category: "문서·데이터", url: "https://drive.google.com", loginUrl: "https://accounts.google.com/ServiceLogin?service=wise" },
  { slug: "googlesheets", name: "Google Sheets", desc: "수율·원가 데이터를 표로 정리하고 계산해요.", category: "문서·데이터", url: "https://docs.google.com/spreadsheets", loginUrl: "https://accounts.google.com/ServiceLogin?service=wise" },
  { slug: "excel", name: "Microsoft Excel", desc: "생산 실적·재고 시트를 읽고 집계표를 만들어요.", category: "문서·데이터", url: "https://www.microsoft.com/microsoft-365/excel", loginUrl: "https://www.office.com/launch/excel" },
  { slug: "notion", name: "Notion", desc: "이슈·조치 내역을 기록하고 워크플로를 자동화해요.", category: "문서·데이터", url: "https://www.notion.so", loginUrl: "https://www.notion.so/login" },
  { slug: "gmail", name: "Gmail", desc: "분석 결과 리포트를 작성·검색하고 메일을 요약해요.", category: "메일·일정", connected: true, url: "https://mail.google.com", loginUrl: "https://accounts.google.com/ServiceLogin?service=mail" },
  { slug: "googlecalendar", name: "Google Calendar", desc: "정비 일정을 등록하고 일정을 최적화해요.", category: "메일·일정", url: "https://calendar.google.com" },
  { slug: "outlook", name: "Microsoft Outlook", desc: "협력사 메일을 요약하고 회의 일정을 잡아요.", category: "메일·일정", url: "https://outlook.office.com", loginUrl: "https://outlook.office.com" },
  { slug: "ecount", name: "이카운트 ERP", desc: "매입·매출·재고 전표를 조회하고 발주를 등록해요.", category: "ERP·회계", url: "https://www.ecount.com", loginUrl: "https://login.ecount.com" },
  { slug: "douzone", name: "더존 ERP", desc: "회계·인사·생산 데이터를 조회하고 전표를 만들어요.", category: "ERP·회계", url: "https://www.douzone.com", loginUrl: "https://www.douzone.com" },
];

/**
 * 스킬 추가 팝업 목록 — AI Skills.
 * 스킬은 특정 업무의 수행 절차·양식·규칙을 AI에게 가르치는 지침 패키지로,
 * 추가하면 AI가 해당 업무를 사내 규칙대로 수행한다.
 */
export const SKILL_LIB: { id: string; name: string; desc: string }[] = [
  { id: "daily-report", name: "일일 생산보고 작성", desc: "사내 보고 양식과 결재선 규칙대로 일일 생산·품질 보고서를 작성하는 스킬" },
  { id: "rca", name: "불량 원인 분석(RCA)", desc: "5Why·특성요인도 절차에 따라 근본 원인을 도출하고 시정조치를 제안하는 스킬" },
  { id: "po-draft", name: "구매 기안 작성", desc: "품의 규정·승인 한도에 맞춰 구매 기안 문서를 작성하는 스킬" },
  { id: "sop-answer", name: "작업표준 안내", desc: "작업표준서(SOP) 해당 조항을 인용해 현장 질문에 답변하는 스킬" },
  { id: "meeting", name: "회의록 정리", desc: "회의 내용을 사내 회의록 양식으로 요약하고 액션 아이템을 추출하는 스킬" },
];
