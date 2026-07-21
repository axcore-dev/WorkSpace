import { CHART } from "@/lib/palette";
import type { ModulePageData } from "./types";

/**
 * 8대 모듈 상세 페이지 더미 데이터.
 * 실제 DB/API 연동 시 이 파일을 API 클라이언트로 교체한다.
 */
export const MODULE_PAGES: Record<string, ModulePageData> = {
  management: {
    // 실무자 관점 순서: 당장 처리할 승인 → 다가오는 지급 → 손익 → 인원
    stats: [
      {
        label: "미결 구매 요청",
        value: "14건",
        delta: "+5",
        deltaTone: "amber",
        sub: "승인 대기 포함",
        cta: { label: "승인하기", tabId: "purchasing" },
      },
      { label: "이번 달 급여 지급액", value: "4.2억원", sub: "지급 예정일 7/25", dday: "D-19" },
      { label: "월 손익 (6월)", value: "+1.8억원", delta: "+12%", deltaTone: "green", sub: "전월 대비" },
      { label: "재직 인원", value: "128명", delta: "+3", deltaTone: "green", sub: "이번 달 입사 3명" },
    ],
    tabs: [
      {
        id: "hr",
        label: "인사 관리",
        actions: ["export", "create"],
        description: "Tree 형태의 조직도로 조직별 인원을 확인하고 구성원 연락처를 공유합니다.",
        tree: [
          {
            name: "(주)데모컴퍼니",
            meta: "128명",
            children: [
              {
                name: "생산본부",
                meta: "74명",
                children: [
                  { name: "생산1팀 (CNC 가공)", meta: "28명 · 팀장 김재현", badge: { text: "주간 2교대", tone: "slate" } },
                  { name: "생산2팀 (프레스)", meta: "22명 · 팀장 박성우" },
                  { name: "품질관리팀", meta: "14명 · 팀장 이수진" },
                  { name: "설비보전팀", meta: "10명 · 팀장 정민호" },
                ],
              },
              {
                name: "경영지원본부",
                meta: "31명",
                children: [
                  { name: "인사총무팀", meta: "8명 · 팀장 최은영" },
                  { name: "재무회계팀", meta: "9명 · 팀장 한동훈" },
                  { name: "구매자재팀", meta: "14명 · 팀장 오세라" },
                ],
              },
              {
                name: "영업본부",
                meta: "23명",
                children: [
                  { name: "국내영업팀", meta: "12명 · 팀장 강지훈" },
                  { name: "해외영업팀", meta: "6명 · 팀장 문가영" },
                  { name: "고객지원팀", meta: "5명 · 팀장 서준일" },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "payroll",
        label: "급여 관리",
        actions: ["export"],
        description: "원클릭 급상여 처리와 전표 작성을 지원합니다.",
        table: {
          columns: ["처리 회차", "대상", "지급 총액", "공제 총액", "전표", "상태"],
          rows: [
            ["2026년 7월 정기급여", "128명", "421,800,000원", "58,300,000원", "미생성", { badge: "처리 대기", tone: "amber" }],
            ["2026년 6월 정기급여", "125명", "413,500,000원", "57,100,000원", "V-2606-001", { badge: "지급 완료", tone: "green" }],
            ["2026년 상반기 성과급", "119명", "186,000,000원", "25,700,000원", "V-2606-014", { badge: "지급 완료", tone: "green" }],
            ["2026년 5월 정기급여", "125명", "409,900,000원", "56,600,000원", "V-2605-001", { badge: "지급 완료", tone: "green" }],
          ],
        },
        note: "급여 전표는 회계 관리에 자동 연계됩니다.",
      },
      {
        id: "materials",
        label: "자재 관리",
        actions: ["filter", "create"],
        description: "자재 기준정보와 소요량(BOM 연계), 단가 이력을 관리합니다.",
        table: {
          columns: ["품목 코드", "품명", "규격", "단위", "공급처", "최근 단가", "단가 추이"],
          rows: [
            ["MAT-AL-6061", "알루미늄 합금 6061", "T6 · 20mm", "kg", "한국알루텍", "4,850원", { badge: "▲ 3.2%", tone: "red" }],
            ["MAT-SS-304", "스테인리스강 304", "2B · 1.5t", "kg", "포스틸상사", "5,120원", { badge: "▼ 1.1%", tone: "green" }],
            ["MAT-BR-C36", "황동봉 C3604", "Ø12", "kg", "대신금속", "9,340원", { badge: "— 보합", tone: "slate" }],
            ["PRT-BRG-608", "베어링 608ZZ", "8×22×7", "EA", "NSK코리아", "1,150원", { badge: "▼ 0.8%", tone: "green" }],
            ["PRT-SCR-M4", "육각볼트 M4×12", "SUS304", "EA", "동양볼트", "38원", { badge: "— 보합", tone: "slate" }],
          ],
        },
      },
      {
        id: "accounting",
        label: "회계 관리",
        actions: ["filter", "export"],
        description: "매입/매출 전표와 계정과목, 월별 손익 요약을 조회합니다.",
        chart: {
          type: "bar",
          title: "월별 손익 요약",
          valueUnit: "억",
          labels: ["1월", "2월", "3월", "4월", "5월", "6월"],
          series: [
            { name: "매출", color: CHART.primary, values: [18.2, 17.5, 19.8, 21.3, 20.6, 22.4] },
            { name: "매입·비용", color: CHART.neutral, values: [15.9, 15.8, 17.2, 18.4, 18.1, 20.6] },
          ],
        },
        table: {
          columns: ["전표번호", "일자", "구분", "적요", "금액", "상태"],
          rows: [
            ["V-2607-003", "2026-07-01", "매입", "알루미늄 합금 6061 (한국알루텍)", "24,250,000원", { badge: "승인", tone: "green" }],
            ["V-2607-002", "2026-07-01", "매출", "정밀 샤프트 납품 (한빛모터스)", "86,400,000원", { badge: "승인", tone: "green" }],
            ["V-2607-001", "2026-07-01", "매입", "베어링 608ZZ 5,000EA (NSK코리아)", "5,750,000원", { badge: "검토중", tone: "amber" }],
            ["V-2606-089", "2026-06-30", "매출", "브래킷 어셈블리 (세진전자)", "42,120,000원", { badge: "승인", tone: "green" }],
          ],
        },
      },
      {
        id: "purchasing",
        label: "구매 관리",
        actions: ["filter", "create"],
        description: "공급업체·구매 요청·견적을 관리합니다. AI대화의 발주서 OCR 반영 제안을 수신합니다.",
        table: {
          columns: ["요청번호", "품목", "수량", "공급처", "요청자", "납기", "상태"],
          rows: [
            ["PR-2607-012", "알루미늄 합금 6061", "2,000kg", "한국알루텍", "오세라", "2026-07-10", { badge: "승인 대기", tone: "amber" }],
            ["PR-2607-011", "베어링 608ZZ", "5,000EA", "NSK코리아", "구매자재팀", "2026-07-08", { badge: "AI 제안 반영", tone: "violet" }],
            ["PR-2607-009", "절삭유 20L", "30통", "케미칼원", "설비보전팀", "2026-07-07", { badge: "발주 완료", tone: "green" }],
            ["PR-2606-087", "스테인리스강 304", "1,500kg", "포스틸상사", "오세라", "2026-07-04", { badge: "입고 완료", tone: "green" }],
            ["PR-2606-086", "황동봉 C3604", "800kg", "대신금속", "생산2팀", "2026-07-03", { badge: "입고 완료", tone: "green" }],
          ],
        },
      },
    ],
  },

  design: {
    stats: [
      { label: "등록 도면", value: "1,842건", delta: "+26", deltaTone: "green", sub: "이번 달 신규" },
      { label: "진행 중 설계 변경(ECO)", value: "7건", sub: "승인 대기 2건" },
      { label: "활성 BOM", value: "214개", sub: "제품군 12개" },
      { label: "도면 승인 리드타임", value: "2.4일", delta: "-0.6일", deltaTone: "green", sub: "전분기 대비" },
    ],
    tabs: [
      {
        id: "drawings",
        label: "도면 관리",
        actions: ["filter", "create"],
        description: "제품 도면의 업로드·버전 관리·검색·다운로드를 지원합니다.",
        table: {
          columns: ["도면번호", "도면명", "버전", "작성자", "수정일", "상태"],
          rows: [
            ["DWG-SH-1024", "정밀 샤프트 Ø12 조립도", "Rev.C", "윤성민", "2026-06-29", { badge: "승인", tone: "green" }],
            ["DWG-BR-0871", "브래킷 어셈블리 상세도", "Rev.B", "김다혜", "2026-06-27", { badge: "검토중", tone: "amber" }],
            ["DWG-HS-0552", "하우징 케이스 가공도", "Rev.E", "윤성민", "2026-06-25", { badge: "승인", tone: "green" }],
            ["DWG-GR-0334", "감속 기어 치형도", "Rev.A", "박준영", "2026-06-24", { badge: "작성중", tone: "slate" }],
            ["DWG-PL-0208", "플랜지 커플링 도면", "Rev.D", "김다혜", "2026-06-20", { badge: "승인", tone: "green" }],
          ],
        },
      },
      {
        id: "specs",
        label: "설계 관리",
        actions: ["create"],
        description: "설계 문서·시방서를 관리하고 도면·BOM·사양의 변경 이력을 추적합니다.",
        table: {
          columns: ["변경번호", "대상", "변경 내용", "요청자", "일자", "상태"],
          rows: [
            ["ECO-2607-02", "정밀 샤프트 Ø12", "열처리 사양 HRC50→HRC52 상향", "윤성민", "2026-07-01", { badge: "승인 대기", tone: "amber" }],
            ["ECO-2607-01", "브래킷 어셈블리", "체결부 볼트 M4→M5 변경", "김다혜", "2026-06-30", { badge: "검토중", tone: "amber" }],
            ["ECO-2606-11", "하우징 케이스", "방열 슬릿 4→6개 추가", "박준영", "2026-06-26", { badge: "반영 완료", tone: "green" }],
            ["ECO-2606-10", "감속 기어", "재질 SCM415→SCM420 변경", "윤성민", "2026-06-22", { badge: "반영 완료", tone: "green" }],
          ],
        },
        note: "이전 버전은 변경 이력에서 원클릭으로 복원할 수 있습니다.",
      },
      {
        id: "bom",
        label: "BOM 관리",
        actions: ["export"],
        description: "부품 목록의 계층 구조와 대체재를 관리합니다.",
        tree: [
          {
            name: "PRD-SH-1024 정밀 샤프트 어셈블리",
            meta: "Rev.C · 부품 4종",
            children: [
              { name: "MAT-AL-6061 알루미늄 합금 6061", meta: "0.84kg/EA", badge: { text: "대체재 1종", tone: "blue" } },
              { name: "PRT-BRG-608 베어링 608ZZ", meta: "2 EA" },
              { name: "PRT-SCR-M4 육각볼트 M4×12", meta: "6 EA", badge: { text: "대체재 2종", tone: "blue" } },
              {
                name: "SUB-CPL-031 커플링 서브어셈블리",
                meta: "1 SET",
                children: [
                  { name: "MAT-BR-C36 황동봉 C3604", meta: "0.22kg/EA" },
                  { name: "PRT-KEY-05 평행키 5×5×20", meta: "1 EA" },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  production: {
    stats: [
      { label: "금일 생산 실적", value: "12,480 EA", delta: "+4.2%", deltaTone: "green", sub: "계획 대비 96.8%" },
      { label: "가동 중 설비", value: "18 / 21대", sub: "정지 2 · 정비 1" },
      { label: "진행 중 작업지시", value: "9건", sub: "지연 1건 포함" },
      { label: "평균 사이클 타임", value: "42.5초", delta: "-1.8초", deltaTone: "green", sub: "전주 대비" },
    ],
    tabs: [
      {
        id: "monitoring",
        label: "모니터링",
        actions: ["export"],
        description: "설비 상태와 생산 실적을 실시간으로 모니터링하고 계획 대비 실적을 비교합니다.",
        chart: {
          type: "line",
          title: "시간대별 생산량 (계획 vs 실적)",
          labels: ["08시", "10시", "12시", "14시", "16시", "18시", "20시"],
          series: [
            { name: "계획", color: CHART.neutral, values: [1800, 1800, 1200, 1800, 1800, 1800, 1600] },
            { name: "실적", color: CHART.primary, values: [1740, 1815, 1180, 1752, 1691, 1788, 1514] },
          ],
        },
        table: {
          columns: ["라인", "품목", "계획", "실적", "달성률", "설비 상태"],
          rows: [
            ["CNC 1라인", "정밀 샤프트 Ø12", "4,200", "4,116", "98.0%", { badge: "가동", tone: "green" }],
            ["CNC 2라인", "하우징 케이스", "3,600", "3,371", "93.6%", { badge: "가동", tone: "green" }],
            ["프레스 1라인", "브래킷", "3,000", "3,048", "101.6%", { badge: "가동", tone: "green" }],
            ["프레스 2라인", "플랜지 커플링", "1,800", "1,527", "84.8%", { badge: "일시 정지", tone: "amber" }],
            ["조립 라인", "샤프트 어셈블리", "1,400", "418", "29.9%", { badge: "정비 중", tone: "red" }],
          ],
        },
      },
      {
        id: "workorders",
        label: "작업지시",
        actions: ["filter", "create"],
        description: "작업 지시의 생성·배분·추적·완료 처리와 단기 생산 계획을 관리합니다.",
        table: {
          columns: ["지시번호", "품목", "수량", "라인", "납기", "진척", "상태"],
          rows: [
            ["WO-2607-021", "정밀 샤프트 Ø12", "8,000", "CNC 1라인", "2026-07-04", "51%", { badge: "진행중", tone: "blue" }],
            ["WO-2607-020", "하우징 케이스", "6,500", "CNC 2라인", "2026-07-05", "38%", { badge: "진행중", tone: "blue" }],
            ["WO-2607-019", "브래킷", "12,000", "프레스 1라인", "2026-07-03", "74%", { badge: "진행중", tone: "blue" }],
            ["WO-2607-018", "플랜지 커플링", "4,000", "프레스 2라인", "2026-07-03", "42%", { badge: "지연", tone: "red" }],
            ["WO-2607-015", "감속 기어", "2,400", "CNC 3라인", "2026-07-02", "100%", { badge: "완료", tone: "green" }],
          ],
        },
        note: "AI진단의 스케줄링 최적화안 승인 시 이 목록에 자동 반영됩니다.",
      },
      {
        id: "bottleneck",
        label: "공정병목 분석",
        actions: ["export"],
        description: "공정별 처리량·대기시간을 분석해 병목 구간과 개선 우선순위를 제시합니다.",
        chart: {
          type: "bar",
          title: "공정별 평균 대기시간 (분)",
          valueUnit: "분",
          labels: ["원자재 투입", "CNC 가공", "열처리", "연마", "검사", "포장"],
          series: [
            { name: "평균 대기시간", color: CHART.primary, values: [4, 12, 38, 9, 21, 6] },
          ],
        },
        table: {
          columns: ["병목 구간", "원인 분석", "영향", "개선 우선순위"],
          rows: [
            ["열처리 공정", "외주 열처리 배치 대기 (일 2회 수거)", "리드타임 +0.8일", { badge: "1순위", tone: "red" }],
            ["검사 공정", "치수 검사 수작업 비중 65%", "처리량 -18%", { badge: "2순위", tone: "amber" }],
            ["CNC 가공", "야간 무인 가동률 71%", "가동률 손실 6%", { badge: "3순위", tone: "slate" }],
          ],
        },
      },
      {
        id: "reporting",
        label: "보고 자동화",
        ai: true,
        custom: "report-automation",
        description: "현장 입력이 실시간으로 자동 집계되고, AI가 일일 생산·품질 보고서를 작성합니다.",
      },
    ],
  },

  equipment: {
    stats: [
      { label: "관리 대상 설비", value: "21대", sub: "센서 연동 18대" },
      { label: "고장 위험 경고", value: "2건", delta: "+1", deltaTone: "red", sub: "24시간 내 예측" },
      { label: "평균 가동률 (OEE)", value: "84.6%", delta: "+1.9%p", deltaTone: "green", sub: "전월 대비" },
      { label: "이번 주 정비 일정", value: "4건", sub: "예방 정비 3 · 교정 1" },
    ],
    tabs: [
      {
        id: "predict",
        label: "정비 예측",
        ai: true,
        actions: ["export"],
        description: "센서 데이터(온도·진동·전력) 기반으로 고장 위험을 예측하고 정비 시점을 권고합니다. AI진단 허브와 예측 엔진을 공유합니다.",
        table: {
          columns: ["설비", "예측 유형", "고장 확률", "예측 근거", "권고 조치", "위험도"],
          rows: [
            ["CNC-07 머시닝센터", "스핀들 베어링 마모", "87%", "진동 RMS 14일 연속 상승", "72시간 내 베어링 교체", { badge: "높음", tone: "red" }],
            ["PRS-02 프레스", "유압 펌프 열화", "64%", "유온 상승 + 압력 편차 확대", "유압유·필터 점검", { badge: "중간", tone: "amber" }],
            ["CMP-01 컴프레서", "흡기 필터 막힘", "41%", "전력 소비 8% 증가 추세", "필터 청소/교체", { badge: "낮음", tone: "slate" }],
            ["CNC-03 머시닝센터", "냉각수 순환 저하", "12%", "정상 범위", "정기 점검 유지", { badge: "정상", tone: "green" }],
          ],
        },
        chart: {
          type: "line",
          title: "CNC-07 스핀들 진동 추이 (RMS, mm/s)",
          labels: ["6/18", "6/21", "6/24", "6/27", "6/30", "7/2"],
          series: [
            { name: "진동 RMS", color: CHART.red, values: [2.1, 2.4, 2.9, 3.6, 4.4, 5.1] },
            { name: "경고 임계치", color: CHART.amber, values: [4.5, 4.5, 4.5, 4.5, 4.5, 4.5] },
          ],
        },
      },
      {
        id: "maintenance",
        label: "정비 관리",
        actions: ["filter", "create"],
        description: "설비별 가동 기록·유지보수 이력·부품 교체를 통합 관리하고 정기 정비 일정을 추적합니다.",
        table: {
          columns: ["정비번호", "설비", "유형", "내용", "담당", "일정", "상태"],
          rows: [
            ["MT-2607-04", "CNC-07 머시닝센터", "예지 정비", "스핀들 베어링 교체 (AI 권고)", "정민호", "2026-07-04", { badge: "일정 확정", tone: "violet" }],
            ["MT-2607-03", "조립 라인 컨베이어", "돌발 정비", "구동 모터 교체", "설비보전팀", "2026-07-02", { badge: "진행중", tone: "blue" }],
            ["MT-2607-02", "PRS-01 프레스", "예방 정비", "슬라이드 급유·볼트 토크 점검", "이강토", "2026-07-03", { badge: "예정", tone: "slate" }],
            ["MT-2606-18", "CNC-01~04", "정기 정비", "월간 정도 검사·레벨 교정", "정민호", "2026-06-28", { badge: "완료", tone: "green" }],
          ],
        },
      },
    ],
  },

  quality: {
    stats: [
      { label: "금일 불량률", value: "0.82%", delta: "-0.11%p", deltaTone: "green", sub: "목표 1.0% 이하" },
      { label: "진행 중 시정조치(CAPA)", value: "3건", sub: "기한 임박 1건" },
      { label: "검사 완료율", value: "97.4%", sub: "금일 로트 기준" },
      { label: "공정능력지수 (Cpk)", value: "1.42", delta: "+0.05", deltaTone: "green", sub: "주요 치수 평균" },
    ],
    tabs: [
      {
        id: "defects",
        label: "불량 분석",
        actions: ["export"],
        description: "불량 데이터를 유형·공정·원인별로 분석하고 시정 조치를 추적합니다.",
        chart: {
          type: "donut",
          title: "불량 유형 분포 (최근 30일)",
          segments: [
            { name: "치수 불량", value: 38, color: CHART.primary },
            { name: "표면 흠집", value: 27, color: CHART.primary400 },
            { name: "가공 누락", value: 17, color: CHART.primary300 },
            { name: "조립 불량", value: 11, color: CHART.primary200 },
            { name: "기타", value: 7, color: CHART.muted },
          ],
        },
        table: {
          columns: ["분석번호", "품목", "불량 유형", "추정 원인 (RCA)", "시정 조치", "상태"],
          rows: [
            ["QA-2607-02", "정밀 샤프트 Ø12", "치수 불량 (외경 +0.02)", "CNC-07 스핀들 진동 증가", "장비관리 정비 예측 연계", { badge: "조치중", tone: "amber" }],
            ["QA-2607-01", "브래킷", "표면 흠집", "프레스 금형 이물", "금형 세척 주기 단축", { badge: "조치중", tone: "amber" }],
            ["QA-2606-14", "하우징 케이스", "가공 누락 (탭 미가공)", "작업지시 도면 버전 불일치", "도면 배포 프로세스 개선", { badge: "완료", tone: "green" }],
          ],
        },
      },
      {
        id: "control",
        label: "품질 관리",
        actions: ["filter", "create"],
        description: "제품·공정별 검사 항목을 정의하고 검사 수행·결과를 기록합니다.",
        table: {
          columns: ["검사 로트", "품목", "검사 항목", "표본", "결과", "검사원"],
          rows: [
            ["LOT-260702-A", "정밀 샤프트 Ø12", "외경·진원도·표면조도", "50/8,000", { badge: "양호", tone: "green" }, "이수진"],
            ["LOT-260702-B", "브래킷", "치수·외관", "80/12,000", { badge: "양호", tone: "green" }, "김태리"],
            ["LOT-260701-C", "플랜지 커플링", "동심도·경도", "30/4,000", { badge: "부적합 2건", tone: "red" }, "이수진"],
            ["LOT-260701-A", "하우징 케이스", "치수·나사 게이지", "60/6,500", { badge: "양호", tone: "green" }, "박찬영"],
          ],
        },
      },
    ],
  },

  inventory: {
    stats: [
      { label: "총 재고 자산", value: "18.6억원", sub: "원자재 7.2 · 재공 4.1 · 완제품 7.3" },
      { label: "안전 재고 미달", value: "3품목", delta: "+1", deltaTone: "red", sub: "발주 권고 발행됨" },
      { label: "금일 입고 검수", value: "12건", sub: "합격 11 · 보류 1" },
      { label: "재고 회전율", value: "6.8회", delta: "+0.4", deltaTone: "green", sub: "연 환산" },
    ],
    tabs: [
      {
        id: "stock",
        label: "현재 재고",
        actions: ["filter", "export"],
        description: "품목·창고별 실시간 재고 현황과 재고 예측을 제공합니다.",
        table: {
          columns: ["품목", "창고", "현재고", "가용 재고", "30일 예측 소요", "상태"],
          rows: [
            ["알루미늄 합금 6061", "원자재 1창고", "3,420kg", "2,890kg", "4,100kg", { badge: "발주 필요", tone: "red" }],
            ["스테인리스강 304", "원자재 1창고", "5,180kg", "4,760kg", "3,300kg", { badge: "정상", tone: "green" }],
            ["베어링 608ZZ", "부품 창고", "8,240EA", "6,140EA", "9,800EA", { badge: "발주 진행중", tone: "amber" }],
            ["정밀 샤프트 Ø12 (완제품)", "완제품 창고", "14,800EA", "6,800EA", "—", { badge: "정상", tone: "green" }],
            ["황동봉 C3604", "원자재 2창고", "1,120kg", "980kg", "760kg", { badge: "정상", tone: "green" }],
          ],
        },
      },
      {
        id: "safety",
        label: "안전 재고",
        actions: ["export"],
        description: "품목별 안전 재고 기준과 미달 알림, 최적 주문량을 산출합니다.",
        table: {
          columns: ["품목", "안전 재고 기준", "현재고", "충족률", "최적 주문량 (EOQ)", "상태"],
          rows: [
            ["알루미늄 합금 6061", "4,000kg", "3,420kg", "85.5%", "2,000kg", { badge: "기준 미달", tone: "red" }],
            ["베어링 608ZZ", "10,000EA", "8,240EA", "82.4%", "5,000EA", { badge: "기준 미달", tone: "red" }],
            ["절삭유", "40통", "36통", "90.0%", "30통", { badge: "기준 미달", tone: "amber" }],
            ["스테인리스강 304", "3,500kg", "5,180kg", "148.0%", "—", { badge: "충족", tone: "green" }],
          ],
        },
        note: "기준 미달 품목은 경영지원 > 구매 관리로 발주 권고가 자동 연계됩니다.",
      },
      {
        id: "receiving",
        label: "입출고 검수",
        actions: ["filter", "create"],
        description: "입고 검수와 자재 출고, 로트 추적, 입출고 기록을 관리합니다.",
        table: {
          columns: ["전표", "구분", "품목", "수량", "로트", "검수 결과", "일시"],
          rows: [
            ["GR-2607-012", "입고", "스테인리스강 304", "1,500kg", "L-PS-26070", { badge: "합격", tone: "green" }, "07-02 09:40"],
            ["GI-2607-031", "출고", "알루미늄 합금 6061", "680kg", "L-AL-26066", { badge: "정상 출고", tone: "slate" }, "07-02 08:15"],
            ["GR-2607-011", "입고", "베어링 608ZZ", "5,000EA", "L-BR-26071", { badge: "수량 확인중", tone: "amber" }, "07-02 08:02"],
            ["GR-2607-010", "입고", "절삭유 20L", "30통", "L-CO-26069", { badge: "합격", tone: "green" }, "07-01 16:30"],
          ],
        },
      },
    ],
  },

  sales: {
    stats: [
      { label: "이번 달 수주액", value: "22.4억원", delta: "+8.7%", deltaTone: "green", sub: "전월 대비" },
      { label: "진행 중 수주", value: "17건", sub: "납기 임박 3건" },
      { label: "견적 전환율", value: "34.2%", delta: "+2.1%p", deltaTone: "green", sub: "최근 90일" },
      { label: "8월 수요 예측", value: "31,800 EA", sub: "AI 예측 · 신뢰도 88%" },
    ],
    tabs: [
      {
        id: "orders",
        label: "수주 관리",
        actions: ["filter", "create"],
        description: "고객사 계약 조건과 수주 정보를 관리하고 생산 계획으로 연계합니다.",
        table: {
          columns: ["수주번호", "고객사", "품목", "수량", "금액", "납기", "상태"],
          rows: [
            ["SO-2607-05", "한빛모터스", "정밀 샤프트 Ø12", "24,000EA", "8.6억원", "2026-07-18", { badge: "생산중", tone: "blue" }],
            ["SO-2607-04", "세진전자", "브래킷 어셈블리", "18,000EA", "4.2억원", "2026-07-15", { badge: "생산중", tone: "blue" }],
            ["SO-2607-03", "대륙기계", "감속 기어", "6,000EA", "3.8억원", "2026-07-25", { badge: "자재 준비", tone: "amber" }],
            ["SO-2607-02", "글로벌AT", "하우징 케이스", "12,000EA", "5.1억원", "2026-08-05", { badge: "수주 확정", tone: "green" }],
            ["SO-2606-31", "한빛모터스", "플랜지 커플링", "8,000EA", "2.4억원", "2026-07-06", { badge: "납기 임박", tone: "red" }],
          ],
        },
      },
      {
        id: "forecast",
        label: "수요 예측",
        ai: true,
        actions: ["export"],
        description: "과거 수주·판매 데이터와 계절성을 분석해 품목별 수요를 예측합니다.",
        chart: {
          type: "line",
          title: "월별 수요 실적 및 예측 (천 EA)",
          compact: true,
          valueUnit: "천 EA",
          labels: ["3월", "4월", "5월", "6월", "7월", "8월", "9월"],
          series: [
            { name: "실적", color: CHART.primary, values: [26.4, 27.8, 28.9, 29.6, 0, 0, 0] },
            { name: "AI 예측", color: CHART.amber, values: [26.1, 27.2, 29.3, 29.9, 30.7, 31.8, 30.2] },
          ],
        },
        note: "예측 결과는 생산관리 단기 계획과 재고·물류 안전 재고 산정에 활용됩니다.",
      },
      {
        id: "quotes",
        label: "단가 견적",
        actions: ["filter", "create"],
        description: "자재비·공정 원가 기반으로 제품 단가를 산출하고 견적서를 관리합니다.",
        table: {
          columns: ["견적번호", "고객사", "품목", "산출 단가", "제출 단가", "마진", "상태"],
          rows: [
            ["QT-2607-08", "미래로보틱스", "정밀 샤프트 Ø12 변형", "2,840원", "3,400원", "16.5%", { badge: "발송", tone: "blue" }],
            ["QT-2607-07", "세진전자", "브래킷 신규 사양", "1,920원", "2,300원", "16.5%", { badge: "협의중", tone: "amber" }],
            ["QT-2607-05", "대륙기계", "감속 기어 대량", "5,610원", "6,500원", "13.7%", { badge: "수주 전환", tone: "green" }],
            ["QT-2606-22", "글로벌AT", "하우징 케이스", "3,780원", "4,250원", "11.1%", { badge: "미전환", tone: "slate" }],
          ],
        },
      },
    ],
  },

  support: {
    stats: [
      { label: "미처리 AS 티켓", value: "6건", delta: "-4", deltaTone: "green", sub: "평균 처리 1.8일" },
      { label: "이번 달 접수", value: "31건", sub: "AS 19 · 문의 9 · 불만 3" },
      { label: "고객 만족도", value: "4.5 / 5.0", delta: "+0.2", deltaTone: "green", sub: "최근 90일 설문" },
      { label: "재발 불량 비율", value: "6.5%", delta: "-1.2%p", deltaTone: "green", sub: "VOC 기준" },
    ],
    tabs: [
      {
        id: "tickets",
        label: "AS 접수",
        actions: ["filter", "create"],
        description: "고객의 AS 요청·문의·불만을 접수하고 티켓으로 생성합니다.",
        table: {
          columns: ["티켓번호", "고객사", "유형", "내용", "접수일", "우선순위"],
          rows: [
            ["CS-2607-06", "한빛모터스", "AS 요청", "샤프트 어셈블리 소음 발생 (로트 L-26058)", "2026-07-02", { badge: "높음", tone: "red" }],
            ["CS-2607-05", "세진전자", "문의", "브래킷 도금 사양 변경 가능 여부", "2026-07-02", { badge: "보통", tone: "slate" }],
            ["CS-2607-04", "대륙기계", "AS 요청", "감속 기어 백래시 과다 2EA", "2026-07-01", { badge: "보통", tone: "amber" }],
            ["CS-2607-03", "글로벌AT", "불만", "납품 포장 파손 재발", "2026-07-01", { badge: "높음", tone: "red" }],
          ],
        },
      },
      {
        id: "tracking",
        label: "AS 트래킹",
        actions: ["filter"],
        description: "접수→할당→진행→완료 처리 과정을 추적하고 고객에게 상태를 안내합니다.",
        table: {
          columns: ["티켓번호", "담당", "현재 단계", "경과", "다음 액션", "상태"],
          rows: [
            ["CS-2607-06", "서준일", "원인 분석", "0.5일", "로트 추적 → 품질검사 연계", { badge: "진행", tone: "blue" }],
            ["CS-2607-04", "김하늘", "교체품 발송", "1.2일", "출고 완료 안내", { badge: "진행", tone: "blue" }],
            ["CS-2607-03", "서준일", "개선안 회신", "1.4일", "포장 사양 변경 확정", { badge: "진행", tone: "amber" }],
            ["CS-2606-28", "김하늘", "완료", "2.1일", "만족도 설문 발송됨", { badge: "완료", tone: "green" }],
          ],
        },
      },
      {
        id: "voc",
        label: "VOC 분석",
        actions: ["export"],
        description: "고객 요청·불만·만족도 데이터를 유형별로 분석해 개선 인사이트를 도출합니다.",
        chart: {
          type: "donut",
          title: "VOC 유형 분포 (최근 90일)",
          segments: [
            { name: "품질 (소음·치수)", value: 34, color: CHART.primary },
            { name: "납기·물류", value: 26, color: CHART.primary400 },
            { name: "포장 상태", value: 18, color: CHART.primary300 },
            { name: "문서·사양 문의", value: 14, color: CHART.primary200 },
            { name: "기타", value: 8, color: CHART.muted },
          ],
        },
        note: "포장 상태 VOC가 90일 연속 증가 추세입니다. 완충재 사양 개선안이 검토 중입니다.",
      },
    ],
  },
};
