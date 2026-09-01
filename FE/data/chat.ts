/** AI대화 더미 데이터 */

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
  /** 이 대화에서 업로드한 문서 — 지식도우미 답변의 최우선 출처로 인용 */
  uploaded: string[];
}

/** 대화(노트북) 한 건. localStorage에 이 모양 그대로 저장된다 (`lib/chat-storage.ts`) */
export interface Note {
  id: number;
  title: string;
  messages: ChatMessage[];
  replyIdx: number;
  src: SourceState;
}

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
  {
    name: "작업표준·FAQ",
    count: 4,
    docs: [
      { name: "작업표준서_CNC 가공 SOP-114 Rev.D.pdf", type: "PDF", scope: "전사", updated: "7/14" },
      { name: "작업표준서_프레스 성형 SOP-208 Rev.B.pdf", type: "PDF", scope: "전사", updated: "7/10" },
      { name: "현장 FAQ 모음_2026.docx", type: "DOCX", scope: "전사", updated: "7/18" },
      { name: "안전작업 지침서 v3.pdf", type: "PDF", scope: "전사", updated: "6/20" },
    ],
  },
];

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
}

/** 데모용 시나리오 대화 스크립트 — 질문 키워드에 맞춰 재생 */
export const SCRIPTED_REPLIES: ChatMessage[] = [
  {
    role: "ai",
    text: "6월 CNC 1라인의 불량률은 0.91%로 전월(1.02%) 대비 0.11%p 개선되었습니다. 주요 불량 유형은 치수 불량(38%)이며, 6월 말부터 CNC-07 설비의 스핀들 진동 상승과 상관관계가 관찰됩니다. 장비관리의 정비 예측에서 해당 설비의 베어링 교체가 권고된 상태입니다.",
    reasoning: [
      "질문의 의도를 파악하고 있어요",
      "품질검사 데이터를 살펴보고 있어요",
      "설비 센서 데이터와 상관관계를 확인 중이에요",
      "관련 문서에서 근거를 찾고 있어요",
    ],
    sources: [
      { doc: "불량 분석 리포트 6월.docx", snippet: "6월 치수 불량은 전체의 38%로 최다 유형…" },
      { doc: "검사성적서_LOT-260701-C.pdf", snippet: "동심도 부적합 2건 — CNC-07 가공분" },
    ],
    process: {
      sources: ["품질검사 모듈 데이터", "장비관리 센서 데이터", "RAG 지식 2건"],
      steps: ["질문 의도 분석 (불량률 조회 + 원인 탐색)", "기간·라인 조건으로 품질 데이터 집계", "설비 이상 신호와 상관관계 분석", "RAG 문서에서 근거 인용"],
      tools: ["데이터 조회", "상관 분석", "RAG 검색"],
      summary: "3개의 도구 사용됨, 품질 데이터 조회됨, 문서 검색됨",
      trace: [
        { icon: "data", text: "품질검사 > 불량 분석 방문 — 6월 CNC 1라인 불량률 집계", result: "결과 4건" },
        { icon: "data", text: "장비관리 센서 데이터와 상관관계 분석", result: "상관 1건" },
        { icon: "doc", text: "소스 문서에서 근거 검색 (불량 분석 리포트 6월)", result: "인용 2건" },
        { icon: "model", text: "원인 가설 정리 및 답변 생성" },
      ],
    },
  },
  {
    role: "ai",
    text: "업로드하신 발주서를 OCR로 읽었습니다. 아래 내용으로 경영지원 > 구매 관리에 등록할까요? 승인하시면 즉시 반영됩니다.",
    reasoning: ["업로드한 문서를 읽고 있어요", "발주서 항목을 추출하고 있어요", "품목 코드를 매칭하고 있어요"],
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
      summary: "3개의 도구 사용됨, 문서 판독됨, 구매 관리 확인됨",
      trace: [
        { icon: "doc", text: "업로드 문서 OCR 판독 (발주서_대신금속_26-0702.pdf)", result: "5개 필드" },
        { icon: "search", text: "품목 코드 매칭 — 황동봉 C3604 Ø12", result: "MAT-BR-C36" },
        { icon: "app", text: "경영지원 > 구매 관리 방문 — 기존 발주 이력 대조", result: "이력 1건" },
        { icon: "model", text: "구매 등록 제안 생성" },
      ],
    },
  },
  {
    role: "ai",
    text: "네, 반영했습니다. 구매 요청 PR-2607-013이 생성되었고 구매자재팀 오세라 팀장에게 승인 요청이 전달되었습니다. 처리 현황은 경영지원 > 구매 관리에서 확인하실 수 있습니다.",
    reasoning: ["구매 요청을 생성하고 있어요", "승인 워크플로를 연결 중이에요"],
    cta: { label: "구매 관리에서 확인", href: "/modules/management" },
    process: {
      sources: ["경영지원 모듈 (구매 관리)"],
      steps: ["사용자 승인 확인", "구매 요청 레코드 생성", "승인 워크플로 라우팅"],
      tools: ["모듈 액션 실행", "알림 전송"],
      summary: "2개의 도구 사용됨, 구매 요청 생성됨, 알림 전송됨",
      trace: [
        { icon: "app", text: "경영지원 > 구매 관리 방문 — 구매 요청 생성", result: "PR-2607-013" },
        { icon: "mail", text: "승인 요청 알림 전송 (구매자재팀 오세라 팀장)", result: "전송됨" },
      ],
    },
  },
  {
    role: "ai",
    text: "현재 안전 재고 미달 품목은 3개입니다.\n① 알루미늄 합금 6061 — 충족률 85.5%, 발주 필요\n② 베어링 608ZZ — 82.4%, 발주 진행중 (7/8 입고 예정)\n③ 절삭유 — 90.0%\n알루미늄 합금은 8월 수요 예측(31,800EA) 기준으로 2,000kg 추가 발주를 권장합니다.",
    reasoning: [
      "질문의 의도를 파악하고 있어요",
      "재고 데이터를 살펴보고 있어요",
      "수요 예측 결과를 확인 중이에요",
      "최적 주문량을 계산하고 있어요",
    ],
    sources: [{ doc: "공급업체 단가표 2026 상반기.xlsx", snippet: "한국알루텍 — AL6061 4,850원/kg (2,000kg 이상 4,720원)" }],
    process: {
      sources: ["재고·물류 모듈", "영업관리 수요 예측(AI)", "RAG 지식 1건"],
      steps: ["안전 재고 기준 대비 현황 집계", "수요 예측 결과와 결합", "최적 주문량(EOQ) 산출"],
      tools: ["데이터 조회", "수요 예측 모델", "RAG 검색"],
      summary: "3개의 도구 사용됨, 재고 데이터 조회됨, 예측 모델 사용됨",
      trace: [
        { icon: "app", text: "재고·물류 > 안전 재고 방문 — 기준 미달 품목 집계", result: "3품목" },
        { icon: "model", text: "8월 수요 예측 결과 결합 (신뢰도 88%)" },
        { icon: "doc", text: "공급업체 단가표에서 대량 단가 확인", result: "인용 1건" },
        { icon: "model", text: "최적 주문량(EOQ) 산출" },
      ],
    },
  },
  {
    role: "ai",
    text: "이번 주 고장 위험이 높은 설비는 2대입니다.\n① CNC-07 머시닝센터 — 스핀들 베어링 마모, 고장 확률 87% (72시간 내 교체 권고)\n② PRS-02 프레스 — 유압 펌프 열화, 고장 확률 64%\nCNC-07 베어링 교체 일정을 7/4(토) 오전으로 Google Calendar에 등록해 두었고, 담당 정민호 팀장에게 공유했습니다.",
    reasoning: [
      "질문의 의도를 파악하고 있어요",
      "장비관리 센서 데이터를 살펴보고 있어요",
      "고장 예측 모델 결과를 정리하고 있어요",
      "Google Calendar에서 정비 일정을 확인 중이에요",
    ],
    cta: { label: "장비관리에서 확인", href: "/modules/equipment" },
    process: {
      sources: ["장비관리 모듈 (정비 예측 AI)", "Google Calendar"],
      steps: ["센서 이상 신호 집계 (진동·유온·전력)", "고장 확률 상위 설비 선별", "정비 가능 시간대 탐색 및 일정 등록"],
      tools: ["데이터 조회", "예측 모델", "Google Calendar"],
      summary: "3개의 도구 사용됨, 센서 데이터 조회됨, Google Calendar 사용됨",
      trace: [
        { icon: "data", text: "장비관리 센서 이상 신호 집계 (진동·유온·전력)", result: "21대" },
        { icon: "model", text: "고장 예측 모델로 상위 위험 설비 선별", result: "2대" },
        { icon: "app", text: "장비관리 > 정비 예측 방문 — 권고 조치 확인" },
        { icon: "calendar", text: "Google Calendar 정비 일정 등록 (7/4 오전)", result: "등록됨" },
      ],
    },
  },
  {
    role: "ai",
    text: "한빛모터스 수주는 2건이 진행 중입니다.\n① SO-2607-05 정밀 샤프트 Ø12 24,000EA (8.6억원) — 생산 진척 51%, 납기 7/18\n② SO-2606-31 플랜지 커플링 8,000EA (2.4억원) — 납기 7/6 임박, 프레스 2라인 일시 정지로 지연 리스크가 있어요.\n생산관리에서 라인 재가동 일정을 먼저 확인해 보세요.",
    reasoning: [
      "질문의 의도를 파악하고 있어요",
      "영업관리 수주 데이터를 살펴보고 있어요",
      "생산 진척과 납기를 대조하고 있어요",
    ],
    cta: { label: "영업관리에서 확인", href: "/modules/sales" },
    process: {
      sources: ["영업관리 모듈 (수주)", "생산관리 모듈 (작업지시)"],
      steps: ["고객사 조건으로 수주 조회", "작업지시 진척률 결합", "납기 리스크 판정"],
      tools: ["데이터 조회", "리스크 분석"],
      summary: "2개의 도구 사용됨, 수주 데이터 조회됨, 리스크 분석됨",
      trace: [
        { icon: "app", text: "영업관리 > 수주 관리 방문 — 한빛모터스 진행 건 조회", result: "2건" },
        { icon: "data", text: "생산관리 작업지시 진척률 결합" },
        { icon: "model", text: "납기 리스크 판정", result: "리스크 1건" },
      ],
    },
  },
  // ── 지식도우미 (UC3: 작업표준·FAQ 검색형 답변) ──
  {
    role: "ai",
    text: "CNC 가공 공구 교체 기준은 작업표준서 SOP-114 Rev.D 4.2절에 정의되어 있습니다.\n① 초경 엔드밀 — 누적 절삭 2,400분 도달 또는 진동·이음 발생 시 즉시 교체\n② 드릴 — 누적 절삭 1,800분\n③ 인서트 팁 — 마모 한계 VB 0.3mm 도달 시\n교체 후에는 첫 가공품 3개를 전수 측정해 치수를 확인한 뒤 양산을 재개합니다. 참고로 CNC-07은 스핀들 진동 상승이 감지되어 조기 교체 대상입니다.",
    reasoning: [
      "질문의 의도를 파악하고 있어요",
      "작업표준·FAQ 문서를 검색하고 있어요",
      "해당 조항을 찾아 정리하고 있어요",
    ],
    sources: [
      { doc: "작업표준서_CNC 가공 SOP-114 Rev.D.pdf", snippet: "4.2 공구 교체 기준 — 초경 엔드밀 누적 절삭 2,400분 또는 이상 진동 발생 시…" },
      { doc: "현장 FAQ 모음_2026.docx", snippet: "Q. 공구 수명 전 이상 진동이 느껴지면? A. 즉시 교체 후 설비보전팀에 통보" },
    ],
    process: {
      sources: ["작업표준·FAQ 문서 2건", "장비관리 센서 데이터"],
      steps: ["질문 의도 분석 (작업표준 조회)", "작업표준·FAQ 문서 검색", "관련 조항 인용 및 현재 설비 상태 결합"],
      tools: ["RAG 검색", "데이터 조회"],
      summary: "2개의 도구 사용됨, 작업표준 검색됨, 조항 인용됨",
      trace: [
        { icon: "search", text: "작업표준·FAQ 폴더에서 '공구 교체' 검색", result: "결과 3건" },
        { icon: "doc", text: "SOP-114 Rev.D 4.2절 조항 인용", result: "인용 2건" },
        { icon: "data", text: "장비관리 센서 데이터 확인 — CNC-07 진동 상승", result: "1건" },
        { icon: "model", text: "기준 요약 및 답변 생성" },
      ],
    },
  },
  {
    role: "ai",
    text: "불량품 발견 시 처리 절차는 4단계입니다.\n① 식별 — 부적합 태그(적색)를 부착하고 라인에서 즉시 격리\n② 이동 — 부적합품 보관 구역(B-2)으로 이동\n③ 등록 — 품질검사 > 불량 분석에 로트번호와 함께 등록 (품질관리팀에 자동 통보)\n④ 처분 — 재작업·특채·폐기 여부를 품질관리팀장이 24시간 내 결정\n동일 유형 불량이 3회 이상 반복되면 시정조치(CAPA)가 자동 발행됩니다.",
    reasoning: [
      "질문의 의도를 파악하고 있어요",
      "현장 FAQ와 품질 규정을 검색하고 있어요",
      "절차를 단계별로 정리하고 있어요",
    ],
    cta: { label: "품질검사에서 확인", href: "/modules/quality" },
    sources: [
      { doc: "현장 FAQ 모음_2026.docx", snippet: "Q. 불량품을 발견하면? A. 적색 태그 부착 → B-2 구역 격리 → 시스템 등록" },
      { doc: "품질경영 매뉴얼 v4.pdf", snippet: "8.7 부적합품 관리 — 처분 결정은 발견 후 24시간 이내" },
    ],
    process: {
      sources: ["작업표준·FAQ 문서 1건", "품질경영 매뉴얼"],
      steps: ["질문 의도 분석 (절차 조회)", "FAQ·규정 문서 검색", "절차 단계 정리"],
      tools: ["RAG 검색"],
      summary: "1개의 도구 사용됨, FAQ·규정 검색됨, 절차 정리됨",
      trace: [
        { icon: "search", text: "작업표준·FAQ 폴더에서 '불량품 처리' 검색", result: "결과 2건" },
        { icon: "doc", text: "현장 FAQ 모음·품질경영 매뉴얼 8.7절 인용", result: "인용 2건" },
        { icon: "model", text: "4단계 절차로 재구성해 답변 생성" },
      ],
    },
  },
];

/**
 * 캘린더 확인 폴백 스크립트 — API 키 미설정 시 사용.
 * 제조(정비 예측·납기) 시나리오를 섞지 않고 Google Calendar와 소스 문서 활용만 보여준다.
 */
export const SCRIPTED_CALENDAR_REPLY: ChatMessage = {
  role: "ai",
  text: "이번 주 Google Calendar 일정은 4건이에요.\n① 7/8(수) 10:00 주간 운영회의\n② 7/9(목) 14:00 한국알루텍 미팅 (발주 협의)\n③ 7/10(금) 11:00 품질경영 매뉴얼 개정 검토\n④ 7/11(토) 09:00 사내 안전 교육\n한국알루텍 미팅 전에 소스의 '공급업체 단가표 2026 상반기.xlsx'를 미리 확인해 두면 좋겠어요.",
  reasoning: [
    "질문의 의도를 파악하고 있어요",
    "Google Calendar에서 일정을 불러오고 있어요",
    "선택한 소스 문서를 함께 확인하고 있어요",
  ],
  process: {
    sources: ["Google Calendar", "워크스페이스 소스 2건"],
    steps: ["Google Calendar 일정 실시간 조회", "소스 문서 대조", "일정 요약 정리"],
    tools: ["Google Calendar", "RAG 검색"],
    summary: "2개의 도구 사용됨, Google Calendar 조회됨, 소스 문서 참조됨",
    trace: [
      { icon: "calendar", text: "Google Calendar에서 이번 주 일정을 실시간 조회함", result: "일정 4건" },
      { icon: "doc", text: "소스 문서 대조 — 공급업체 단가표 2026 상반기.xlsx, 품질경영 매뉴얼 v4.pdf", result: "참조 2건" },
      { icon: "model", text: "일정 요약 및 준비사항 정리" },
    ],
  },
};

/**
 * 소스 파일 업로드 시 재생되는 RAG 인덱싱 스크립트 (UC3: 문서 업로드 → 분석 → 검색형 답변).
 * 업로드 직후 대화에 표시되어 문서가 지식 인덱스에 등록되는 과정을 보여준다.
 */
export function ragIngestMessage(names: string[]): ChatMessage {
  const first = names[0];
  const label = names.length > 1 ? `'${first}' 외 ${names.length - 1}건` : `'${first}'`;
  return {
    role: "ai",
    text: `${label} 문서 분석을 마쳤어요. 텍스트를 추출해 34개 구절로 나누고 지식 인덱스에 등록했습니다. 이제 이 문서 내용으로 질문하면 해당 구절을 근거로 답변해 드려요.\n예: "불량품 발견 시 처리 절차는?", "CNC 공구 교체 기준 알려줘"`,
    reasoning: [
      "업로드한 문서를 읽고 있어요",
      "텍스트를 추출하고 구절을 나누고 있어요",
      "임베딩을 생성해 지식 인덱스에 등록하고 있어요",
    ],
    process: {
      sources: [`업로드 문서 ${names.length}건`],
      steps: ["문서 텍스트 추출", "구절(청크) 분할", "임베딩 생성 및 인덱스 등록"],
      tools: ["문서 파서", "RAG 인덱싱"],
      summary: "2개의 도구 사용됨, 문서 판독됨, 지식 인덱스 등록됨",
      trace: [
        { icon: "doc", text: `업로드 문서 텍스트 추출 (${first})`, result: `${names.length}건` },
        { icon: "model", text: "구절(청크) 분할 — 검색 단위로 재구성", result: "34개 구절" },
        { icon: "data", text: "임베딩 생성 및 지식 인덱스 등록", result: "등록됨" },
      ],
    },
  };
}

/** 지식도우미 답변에 업로드 문서를 최우선 출처로 끼워 넣는다 — '내 문서 기반 답변' 연출 */
export function withUploadedCitation(msg: ChatMessage, docName: string): ChatMessage {
  return {
    ...msg,
    sources: [
      { doc: docName, snippet: "업로드 문서 일치 구절 3건 — 지식 인덱스 유사도 0.93" },
      ...(msg.sources ?? []),
    ],
    process: msg.process && {
      ...msg.process,
      sources: ["업로드 문서 (RAG)", ...msg.process.sources],
      trace: msg.process.trace && [
        { icon: "search", text: `업로드 문서 '${docName}'의 지식 인덱스에서 우선 검색`, result: "일치 3건" },
        ...msg.process.trace,
      ],
    },
  };
}

/** 질문 키워드 → 시나리오 응답 매핑 (데모 시나리오 라우팅) — 구체적인 패턴을 앞에 둔다 */
export const REPLY_ROUTES: { pattern: RegExp; index: number }[] = [
  { pattern: /작업표준|표준서|SOP|공구 교체/, index: 6 },
  { pattern: /불량품|처리 절차|FAQ/i, index: 7 },
  { pattern: /불량|품질/, index: 0 },
  { pattern: /재고|발주/, index: 3 },
  { pattern: /설비|고장|정비/, index: 4 },
  { pattern: /수주|한빛|납기|영업/, index: 5 },
];

/** 시작 화면 추천 질문 — demo: 지식도우미(작업표준·FAQ) 시연 포인트 표시 */
/**
 * 커넥터 추가 팝업(Manus형) 목록 — 브랜드 로고는 simple-icons 사용.
 * loginUrl: '+' 클릭 시 이동할 해당 앱 로그인 페이지 (Google Calendar는 데모 즉시 연결이라 없음).
 * url: 상세 팝업의 '웹사이트' 링크.
 */
export const CONNECTOR_LIB: {
  slug: string;
  name: string;
  desc: string;
  connected?: boolean;
  url: string;
  loginUrl?: string;
}[] = [
  { slug: "slack", name: "Slack", desc: "이상 감지·작업 지시 알림을 전송하고 스레드를 요약해요.", connected: true, url: "https://slack.com", loginUrl: "https://slack.com/signin" },
  { slug: "gmail", name: "Gmail", desc: "분석 결과 리포트를 작성·검색하고 메일을 요약해요.", connected: true, url: "https://mail.google.com", loginUrl: "https://accounts.google.com/ServiceLogin?service=mail" },
  { slug: "googledrive", name: "Google Drive", desc: "파일에 빠르게 접근하고 문서를 지능적으로 관리해요.", url: "https://drive.google.com", loginUrl: "https://accounts.google.com/ServiceLogin?service=wise" },
  { slug: "googlecalendar", name: "Google Calendar", desc: "정비 일정을 등록하고 일정을 최적화해요.", url: "https://calendar.google.com" },
  { slug: "notion", name: "Notion", desc: "이슈·조치 내역을 기록하고 워크플로를 자동화해요.", url: "https://www.notion.so", loginUrl: "https://www.notion.so/login" },
  { slug: "github", name: "GitHub", desc: "저장소를 관리하고 변경 사항을 추적해요.", url: "https://github.com", loginUrl: "https://github.com/login" },
  { slug: "googlesheets", name: "Google Sheets", desc: "수율·원가 데이터를 표로 정리하고 계산해요.", url: "https://docs.google.com/spreadsheets", loginUrl: "https://accounts.google.com/ServiceLogin?service=wise" },
  { slug: "jira", name: "Jira", desc: "개선 과제를 이슈로 만들고 진행을 추적해요.", url: "https://www.atlassian.com/software/jira", loginUrl: "https://id.atlassian.com/login" },
  { slug: "figma", name: "Figma", desc: "설계·라벨 시안을 불러와 검토해요.", url: "https://www.figma.com", loginUrl: "https://www.figma.com/login" },
  { slug: "dropbox", name: "Dropbox", desc: "외부 협력사 문서를 가져와요.", url: "https://www.dropbox.com", loginUrl: "https://www.dropbox.com/login" },
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
