/**
 * ⚠️ AI-MOCK — BE 연동 시 삭제 대상 ⚠️
 *
 * BE(Spring, :8080)에 `/api/ai/*`가 없어서 화면을 눈으로 확인할 수 없다. 이 파일은
 * 그때까지만 쓰는 시나리오 대본이다. 커밋 `72709db`에서 화면 코드(`data/chat.ts`)에서
 * 걷어낸 데모 응답을 서버 쪽으로 옮겨 놓은 것이다 — 화면 코드에는 더미가 없다.
 *
 * ── BE가 준비되면 ──────────────────────────────────────────────
 * 1. `FE/app/api/ai/` 폴더를 통째로 지운다 (이 파일 + chat/sources 라우트)
 * 2. `FE/lib/chat-api.ts`의 `AI_BASE`를 지우고 `API_BASE`로 되돌린다
 * 그러면 FE에서 목업 흔적이 완전히 사라진다. `grep -r "AI-MOCK" FE/`로 확인.
 */
import type { ChatMessage } from "@/data/chat";

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
      {
        doc: "불량 분석 리포트 6월.docx",
        snippet: "6월 치수 불량은 전체의 38%로 최다 유형…",
      },
      {
        doc: "검사성적서_LOT-260701-C.pdf",
        snippet: "동심도 부적합 2건 — CNC-07 가공분",
      },
    ],
    process: {
      sources: ["품질검사 모듈 데이터", "장비관리 센서 데이터", "RAG 지식 2건"],
      steps: [
        "질문 의도 분석 (불량률 조회 + 원인 탐색)",
        "기간·라인 조건으로 품질 데이터 집계",
        "설비 이상 신호와 상관관계 분석",
        "RAG 문서에서 근거 인용",
      ],
      tools: ["데이터 조회", "상관 분석", "RAG 검색"],
      summary: "3개의 도구 사용됨, 품질 데이터 조회됨, 문서 검색됨",
      trace: [
        {
          icon: "data",
          text: "품질검사 > 불량 분석 방문 — 6월 CNC 1라인 불량률 집계",
          result: "결과 4건",
          input: "period=2026-06, line=CNC-1, group_by=defect_type",
          output: "총 0.91% · 치수 38% · 외관 27% · 조립 21% · 기타 14%",
        },
        {
          icon: "data",
          text: "장비관리 센서 데이터와 상관관계 분석",
          result: "상관 1건",
          input: "equipment=CNC-01..08, signal=spindle_vibration, window=30d",
          output: "CNC-07 진동 RMS 2.1→3.4mm/s (6/24~) · 치수 불량과 r=0.78",
        },
        {
          icon: "doc",
          text: "소스 문서에서 근거 검색 (불량 분석 리포트 6월)",
          result: "인용 2건",
          input: 'query="치수 불량 CNC-07", top_k=3',
          output:
            "불량 분석 리포트 6월.docx §2 · 검사성적서_LOT-260701-C.pdf p.2",
        },
        { icon: "model", text: "원인 가설 정리 및 답변 생성" },
      ],
    },
  },
  {
    role: "ai",
    text: "업로드하신 발주서를 OCR로 읽었습니다. 아래 내용으로 경영지원 > 구매 관리에 등록할까요? 승인하시면 즉시 반영됩니다.",
    reasoning: [
      "업로드한 문서를 읽고 있어요",
      "발주서 항목을 추출하고 있어요",
      "품목 코드를 매칭하고 있어요",
    ],
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
      steps: [
        "문서 유형 분류 (발주서)",
        "OCR 텍스트 추출 및 구조화",
        "품목 코드 매칭 (MAT-BR-C36)",
        "구매 관리 등록 제안 생성",
      ],
      tools: ["OCR", "엔터티 추출", "모듈 액션 제안"],
      summary: "3개의 도구 사용됨, 문서 판독됨, 구매 관리 확인됨",
      trace: [
        {
          icon: "doc",
          text: "업로드 문서 OCR 판독 (발주서_대신금속_26-0702.pdf)",
          result: "5개 필드",
        },
        {
          icon: "search",
          text: "품목 코드 매칭 — 황동봉 C3604 Ø12",
          result: "MAT-BR-C36",
        },
        {
          icon: "app",
          text: "경영지원 > 구매 관리 방문 — 기존 발주 이력 대조",
          result: "이력 1건",
        },
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
      steps: [
        "사용자 승인 확인",
        "구매 요청 레코드 생성",
        "승인 워크플로 라우팅",
      ],
      tools: ["모듈 액션 실행", "알림 전송"],
      summary: "2개의 도구 사용됨, 구매 요청 생성됨, 알림 전송됨",
      trace: [
        {
          icon: "app",
          text: "경영지원 > 구매 관리 방문 — 구매 요청 생성",
          result: "PR-2607-013",
        },
        {
          icon: "mail",
          brand: "gmail",
          text: "승인 요청 메일 발송 (구매자재팀 오세라 팀장)",
          result: "전송됨",
        },
        {
          icon: "app",
          brand: "slack",
          text: "Slack #구매요청 채널에 승인 요청 공유",
          result: "전송됨",
        },
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
    sources: [
      {
        doc: "공급업체 단가표 2026 상반기.xlsx",
        snippet: "한국알루텍 — AL6061 4,850원/kg (2,000kg 이상 4,720원)",
      },
    ],
    process: {
      sources: ["재고·물류 모듈", "영업관리 수요 예측(AI)", "RAG 지식 1건"],
      steps: [
        "안전 재고 기준 대비 현황 집계",
        "수요 예측 결과와 결합",
        "최적 주문량(EOQ) 산출",
      ],
      tools: ["데이터 조회", "수요 예측 모델", "RAG 검색"],
      summary: "3개의 도구 사용됨, 재고 데이터 조회됨, 예측 모델 사용됨",
      trace: [
        {
          icon: "app",
          text: "재고·물류 > 안전 재고 방문 — 기준 미달 품목 집계",
          result: "3품목",
          input: "filter=below_safety_stock, sort=fulfillment_rate asc",
          output: "AL6061 85.5% · 608ZZ 82.4% · 절삭유 90.0%",
        },
        { icon: "model", text: "8월 수요 예측 결과 결합 (신뢰도 88%)" },
        {
          icon: "doc",
          text: "공급업체 단가표에서 대량 단가 확인",
          result: "인용 1건",
        },
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
      steps: [
        "센서 이상 신호 집계 (진동·유온·전력)",
        "고장 확률 상위 설비 선별",
        "정비 가능 시간대 탐색 및 일정 등록",
      ],
      tools: ["데이터 조회", "예측 모델", "Google Calendar"],
      summary: "3개의 도구 사용됨, 센서 데이터 조회됨, Google Calendar 사용됨",
      trace: [
        {
          icon: "data",
          text: "장비관리 센서 이상 신호 집계 (진동·유온·전력)",
          result: "21대",
          input: "signals=[vibration, oil_temp, power], window=7d",
          output: "이상 신호 21대 중 임계 초과 4대",
        },
        {
          icon: "model",
          text: "고장 예측 모델로 상위 위험 설비 선별",
          result: "2대",
          input: "model=pdm-v3, threshold=0.6",
          output: "CNC-07 0.87 · PRS-02 0.64",
        },
        { icon: "app", text: "장비관리 > 정비 예측 방문 — 권고 조치 확인" },
        {
          icon: "calendar",
          brand: "googlecalendar",
          text: "Google Calendar 정비 일정 등록 (7/4 오전)",
          result: "등록됨",
        },
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
      steps: [
        "고객사 조건으로 수주 조회",
        "작업지시 진척률 결합",
        "납기 리스크 판정",
      ],
      tools: ["데이터 조회", "리스크 분석"],
      summary: "2개의 도구 사용됨, 수주 데이터 조회됨, 리스크 분석됨",
      trace: [
        {
          icon: "app",
          text: "영업관리 > 수주 관리 방문 — 한빛모터스 진행 건 조회",
          result: "2건",
        },
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
      {
        doc: "작업표준서_CNC 가공 SOP-114 Rev.D.pdf",
        snippet:
          "4.2 공구 교체 기준 — 초경 엔드밀 누적 절삭 2,400분 또는 이상 진동 발생 시…",
      },
      {
        doc: "현장 FAQ 모음_2026.docx",
        snippet:
          "Q. 공구 수명 전 이상 진동이 느껴지면? A. 즉시 교체 후 설비보전팀에 통보",
      },
    ],
    process: {
      sources: ["작업표준·FAQ 문서 2건", "장비관리 센서 데이터"],
      steps: [
        "질문 의도 분석 (작업표준 조회)",
        "작업표준·FAQ 문서 검색",
        "관련 조항 인용 및 현재 설비 상태 결합",
      ],
      tools: ["RAG 검색", "데이터 조회"],
      summary: "2개의 도구 사용됨, 작업표준 검색됨, 조항 인용됨",
      trace: [
        {
          icon: "search",
          text: "작업표준·FAQ 폴더에서 '공구 교체' 검색",
          result: "결과 3건",
        },
        {
          icon: "doc",
          text: "SOP-114 Rev.D 4.2절 조항 인용",
          result: "인용 2건",
        },
        {
          icon: "data",
          text: "장비관리 센서 데이터 확인 — CNC-07 진동 상승",
          result: "1건",
        },
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
      {
        doc: "현장 FAQ 모음_2026.docx",
        snippet:
          "Q. 불량품을 발견하면? A. 적색 태그 부착 → B-2 구역 격리 → 시스템 등록",
      },
      {
        doc: "품질경영 매뉴얼 v4.pdf",
        snippet: "8.7 부적합품 관리 — 처분 결정은 발견 후 24시간 이내",
      },
    ],
    process: {
      sources: ["작업표준·FAQ 문서 1건", "품질경영 매뉴얼"],
      steps: [
        "질문 의도 분석 (절차 조회)",
        "FAQ·규정 문서 검색",
        "절차 단계 정리",
      ],
      tools: ["RAG 검색"],
      summary: "1개의 도구 사용됨, FAQ·규정 검색됨, 절차 정리됨",
      trace: [
        {
          icon: "search",
          text: "작업표준·FAQ 폴더에서 '불량품 처리' 검색",
          result: "결과 2건",
        },
        {
          icon: "doc",
          text: "현장 FAQ 모음·품질경영 매뉴얼 8.7절 인용",
          result: "인용 2건",
        },
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
    steps: [
      "Google Calendar 일정 실시간 조회",
      "소스 문서 대조",
      "일정 요약 정리",
    ],
    tools: ["Google Calendar", "RAG 검색"],
    summary: "2개의 도구 사용됨, Google Calendar 조회됨, 소스 문서 참조됨",
    trace: [
      {
        icon: "calendar",
        brand: "googlecalendar",
        text: "Google Calendar에서 이번 주 일정을 실시간 조회함",
        result: "일정 4건",
      },
      {
        icon: "doc",
        text: "소스 문서 대조 — 공급업체 단가표 2026 상반기.xlsx, 품질경영 매뉴얼 v4.pdf",
        result: "참조 2건",
      },
      { icon: "model", text: "일정 요약 및 준비사항 정리" },
    ],
  },
};

/** 질문 키워드 → 시나리오 응답 매핑 (데모 시나리오 라우팅) — 구체적인 패턴을 앞에 둔다 */
export const REPLY_ROUTES: { pattern: RegExp; index: number }[] = [
  { pattern: /작업표준|표준서|SOP|공구 교체/, index: 6 },
  { pattern: /불량품|처리 절차|FAQ/i, index: 7 },
  { pattern: /불량|품질/, index: 0 },
  { pattern: /재고|발주/, index: 3 },
  { pattern: /설비|고장|정비/, index: 4 },
  { pattern: /수주|한빛|납기|영업/, index: 5 },
];
