import type { Tone } from "./types";

/** AI대화 (3분할 워크스페이스) 더미 데이터 */

export const RAG_FOLDERS: {
  name: string;
  count: number;
  docs: { name: string; type: string; scope: "개인" | "팀" | "전사"; updated: string }[];
}[] = [
  {
    name: "도면·설계",
    count: 4,
    docs: [
      { name: "정밀 샤프트 Ø12 조립도 Rev.C.pdf", type: "PDF", scope: "전사", updated: "6/29" },
      { name: "하우징 케이스 가공도 Rev.E.pdf", type: "PDF", scope: "전사", updated: "6/25" },
      { name: "브래킷 어셈블리 상세도 Rev.B.pdf", type: "PDF", scope: "팀", updated: "6/27" },
      { name: "제품 시방서_샤프트 어셈블리.docx", type: "DOCX", scope: "전사", updated: "6/18" },
    ],
  },
  {
    name: "구매·발주",
    count: 3,
    docs: [
      { name: "발주서_한국알루텍_26-0701.pdf", type: "PDF", scope: "팀", updated: "7/1" },
      { name: "거래명세서_NSK코리아_6월.pdf", type: "PDF", scope: "팀", updated: "6/30" },
      { name: "공급업체 단가표 2026 상반기.xlsx", type: "XLSX", scope: "팀", updated: "6/15" },
    ],
  },
  {
    name: "품질·검사",
    count: 2,
    docs: [
      { name: "검사성적서_LOT-260701-C.pdf", type: "PDF", scope: "팀", updated: "7/1" },
      { name: "불량 분석 리포트 6월.docx", type: "DOCX", scope: "전사", updated: "6/30" },
    ],
  },
  {
    name: "조직·규정",
    count: 2,
    docs: [
      { name: "조직도_2026.png", type: "IMG", scope: "전사", updated: "6/2" },
      { name: "품질경영 매뉴얼 v4.pdf", type: "PDF", scope: "전사", updated: "5/12" },
    ],
  },
];

export interface ChatSource {
  doc: string;
  snippet: string;
}

export interface ChatProcess {
  sources: string[];
  steps: string[];
  tools: string[];
}

export interface OcrProposal {
  docName: string;
  targetModule: string;
  fields: { label: string; value: string }[];
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
}

/** 데모용 시나리오 대화 스크립트 — 입력할 때마다 순서대로 재생 */
export const SCRIPTED_REPLIES: ChatMessage[] = [
  {
    role: "ai",
    text: "6월 CNC 1라인의 불량률은 0.91%로 전월(1.02%) 대비 0.11%p 개선되었습니다. 주요 불량 유형은 치수 불량(38%)이며, 6월 말부터 CNC-07 설비의 스핀들 진동 상승과 상관관계가 관찰됩니다. 장비관리의 정비 예측에서 해당 설비의 베어링 교체가 권고된 상태입니다.",
    sources: [
      { doc: "불량 분석 리포트 6월.docx", snippet: "6월 치수 불량은 전체의 38%로 최다 유형…" },
      { doc: "검사성적서_LOT-260701-C.pdf", snippet: "동심도 부적합 2건 — CNC-07 가공분" },
    ],
    process: {
      sources: ["품질검사 모듈 데이터", "장비관리 센서 데이터", "RAG 지식 2건"],
      steps: ["질문 의도 분석 (불량률 조회 + 원인 탐색)", "기간·라인 조건으로 품질 데이터 집계", "설비 이상 신호와 상관관계 분석", "RAG 문서에서 근거 인용"],
      tools: ["데이터 조회", "상관 분석", "RAG 검색"],
    },
  },
  {
    role: "ai",
    text: "업로드하신 발주서를 OCR로 읽었습니다. 아래 내용으로 경영지원 > 구매 관리에 등록할까요? 승인하시면 즉시 반영됩니다.",
    ocrProposal: {
      docName: "발주서_대신금속_26-0702.pdf",
      targetModule: "경영지원 > 구매 관리",
      fields: [
        { label: "공급처", value: "대신금속" },
        { label: "품목", value: "황동봉 C3604 Ø12" },
        { label: "수량", value: "800kg" },
        { label: "단가", value: "9,340원/kg" },
        { label: "납기", value: "2026-07-11" },
      ],
    },
    process: {
      sources: ["업로드 문서 1건 (OCR)"],
      steps: ["문서 유형 분류 (발주서)", "OCR 텍스트 추출 및 구조화", "품목 코드 매칭 (MAT-BR-C36)", "구매 관리 등록 제안 생성"],
      tools: ["OCR", "엔터티 추출", "모듈 액션 제안"],
    },
  },
  {
    role: "ai",
    text: "네, 반영했습니다. 구매 요청 PR-2607-013이 생성되었고 구매자재팀 오세라 팀장에게 승인 요청이 전달되었습니다. 처리 현황은 경영지원 > 구매 관리에서 확인하실 수 있습니다.",
    cta: { label: "구매 관리에서 확인", href: "/modules/management" },
    process: {
      sources: ["경영지원 모듈 (구매 관리)"],
      steps: ["사용자 승인 확인", "구매 요청 레코드 생성", "승인 워크플로 라우팅"],
      tools: ["모듈 액션 실행", "알림 전송"],
    },
  },
  {
    role: "ai",
    text: "현재 안전 재고 미달 품목은 3개입니다. ① 알루미늄 합금 6061 (충족률 85.5%, 발주 필요) ② 베어링 608ZZ (82.4%, 발주 진행중 — 7/8 입고 예정) ③ 절삭유 (90.0%). 알루미늄 합금은 8월 수요 예측(31,800EA) 기준으로 2,000kg 추가 발주를 권장합니다.",
    sources: [{ doc: "공급업체 단가표 2026 상반기.xlsx", snippet: "한국알루텍 — AL6061 4,850원/kg (2,000kg 이상 4,720원)" }],
    process: {
      sources: ["재고·물류 모듈", "영업관리 수요 예측(AI)", "RAG 지식 1건"],
      steps: ["안전 재고 기준 대비 현황 집계", "수요 예측 결과와 결합", "최적 주문량(EOQ) 산출"],
      tools: ["데이터 조회", "수요 예측 모델", "RAG 검색"],
    },
  },
];

export const SUGGESTED_QUESTIONS = [
  "6월 CNC 1라인 불량률과 원인을 알려줘",
  "안전 재고 미달 품목과 권장 발주량은?",
  "이번 주 설비 고장 위험 요약해줘",
  "한빛모터스 수주 진행 현황 알려줘",
];

export const AI_TOOLS_TEASER: { name: string; desc: string; tone: Tone }[] = [
  { name: "차트 생성기", desc: "대화 데이터를 즉시 시각화", tone: "slate" },
  { name: "자동화 룰 빌더", desc: "조건-액션 자동화 구성", tone: "slate" },
  { name: "계산 시뮬레이터", desc: "원가·수율 시뮬레이션", tone: "slate" },
];

/** 커넥터 추가 팝업(Manus형) 목록 — 브랜드 로고는 simple-icons 사용 */
export const CONNECTOR_LIB: { slug: string; name: string; desc: string; connected?: boolean }[] = [
  { slug: "slack", name: "Slack", desc: "이상 감지·작업 지시 알림을 전송하고 스레드를 요약해요.", connected: true },
  { slug: "gmail", name: "Gmail", desc: "분석 결과 리포트를 작성·검색하고 메일을 요약해요.", connected: true },
  { slug: "googledrive", name: "Google Drive", desc: "파일에 빠르게 접근하고 문서를 지능적으로 관리해요." },
  { slug: "googlecalendar", name: "Google Calendar", desc: "정비 일정을 등록하고 일정을 최적화해요.", connected: true },
  { slug: "notion", name: "Notion", desc: "이슈·조치 내역을 기록하고 워크플로를 자동화해요." },
  { slug: "github", name: "GitHub", desc: "저장소를 관리하고 변경 사항을 추적해요." },
  { slug: "googlesheets", name: "Google Sheets", desc: "수율·원가 데이터를 표로 정리하고 계산해요." },
  { slug: "jira", name: "Jira", desc: "개선 과제를 이슈로 만들고 진행을 추적해요." },
  { slug: "figma", name: "Figma", desc: "설계·라벨 시안을 불러와 검토해요." },
  { slug: "dropbox", name: "Dropbox", desc: "외부 협력사 문서를 가져와요." },
];

/** 스킬 추가 팝업 목록 */
export const SKILL_LIB: { id: string; name: string; desc: string }[] = [
  { id: "chart", name: "차트 생성기", desc: "대화 데이터를 즉시 시각화합니다." },
  { id: "summary", name: "문서 요약", desc: "긴 문서를 핵심만 요약합니다." },
  { id: "ocr", name: "OCR 문서 추출", desc: "발주서·명세서를 구조화 추출합니다." },
  { id: "forecast", name: "수요 예측", desc: "수주·판매 데이터로 수요를 예측합니다." },
  { id: "rca", name: "불량 원인 분석", desc: "RCA 기반 근본 원인을 도출합니다." },
];
