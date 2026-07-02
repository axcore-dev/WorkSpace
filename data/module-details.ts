import type { DetailRecord, Member } from "./types";

/**
 * 테이블 행 클릭 시 뜨는 상세 팝업 데이터.
 * [모듈slug][탭id] = 해당 탭 table.rows 와 같은 순서의 상세 레코드 배열.
 * 실무에서 필수로 쓰는 항목만 담는다.
 */
export const ROW_DETAILS: Record<string, Record<string, DetailRecord[]>> = {
  management: {
    payroll: [
      {
        title: "2026년 7월 정기급여",
        subtitle: "지급 대상 128명 · 지급 예정일 2026-07-25",
        status: { label: "처리 대기", tone: "amber" },
        fields: [
          { label: "지급 총액", value: "421,800,000원" },
          { label: "공제 총액", value: "58,300,000원", tone: "red" },
          { label: "실지급액", value: "363,500,000원" },
          { label: "전표", value: "미생성" },
        ],
        tableTitle: "지급 항목",
        table: {
          columns: ["항목", "금액", "비고"],
          rows: [
            ["기본급", "352,400,000원", "128명"],
            ["연장수당", "41,200,000원", "생산직 중심"],
            ["직책·식대", "28,200,000원", "-"],
            ["국민연금·건강보험", "-31,900,000원", "공제"],
            ["소득세·지방세", "-26,400,000원", "공제"],
          ],
        },
      },
      {
        title: "2026년 6월 정기급여",
        subtitle: "지급 대상 125명 · 지급 완료 2026-06-25",
        status: { label: "지급 완료", tone: "green" },
        fields: [
          { label: "지급 총액", value: "413,500,000원" },
          { label: "공제 총액", value: "57,100,000원", tone: "red" },
          { label: "실지급액", value: "356,400,000원" },
          { label: "전표", value: "V-2606-001" },
        ],
      },
      {
        title: "2026년 상반기 성과급",
        subtitle: "지급 대상 119명 · 지급 완료 2026-06-28",
        status: { label: "지급 완료", tone: "green" },
        fields: [
          { label: "지급 총액", value: "186,000,000원" },
          { label: "공제 총액", value: "25,700,000원", tone: "red" },
          { label: "실지급액", value: "160,300,000원" },
          { label: "산정 기준", value: "상반기 KPI 등급" },
        ],
      },
      {
        title: "2026년 5월 정기급여",
        subtitle: "지급 대상 125명 · 지급 완료 2026-05-25",
        status: { label: "지급 완료", tone: "green" },
        fields: [
          { label: "지급 총액", value: "409,900,000원" },
          { label: "공제 총액", value: "56,600,000원", tone: "red" },
          { label: "실지급액", value: "353,300,000원" },
          { label: "전표", value: "V-2605-001" },
        ],
      },
    ],
  },
  sales: {
    orders: [
      {
        title: "SO-2607-05 · 한빛모터스",
        subtitle: "정밀 샤프트 Ø12 · 24,000 EA",
        status: { label: "생산중", tone: "blue" },
        fields: [
          { label: "수주 금액", value: "8.6억원" },
          { label: "단가", value: "3,580원 / EA" },
          { label: "납기", value: "2026-07-18" },
          { label: "결제 조건", value: "월말 마감 익월 30일" },
          { label: "생산 연계", value: "WO-2607-021 (진척 51%)" },
          { label: "담당", value: "강지훈 · 국내영업팀" },
        ],
      },
      {
        title: "SO-2607-04 · 세진전자",
        subtitle: "브래킷 어셈블리 · 18,000 EA",
        status: { label: "생산중", tone: "blue" },
        fields: [
          { label: "수주 금액", value: "4.2억원" },
          { label: "단가", value: "2,333원 / EA" },
          { label: "납기", value: "2026-07-15" },
          { label: "결제 조건", value: "현금 50% + 어음 50%" },
          { label: "생산 연계", value: "WO-2607-019 (진척 74%)" },
          { label: "담당", value: "강지훈 · 국내영업팀" },
        ],
      },
      {
        title: "SO-2607-03 · 대륙기계",
        subtitle: "감속 기어 · 6,000 EA",
        status: { label: "자재 준비", tone: "amber" },
        fields: [
          { label: "수주 금액", value: "3.8억원" },
          { label: "단가", value: "6,333원 / EA" },
          { label: "납기", value: "2026-07-25" },
          { label: "결제 조건", value: "월말 마감 익월 30일" },
          { label: "특이사항", value: "SCM420 소재 입고 대기" },
          { label: "담당", value: "문가영 · 해외영업팀" },
        ],
      },
      {
        title: "SO-2607-02 · 글로벌AT",
        subtitle: "하우징 케이스 · 12,000 EA",
        status: { label: "수주 확정", tone: "green" },
        fields: [
          { label: "수주 금액", value: "5.1억원" },
          { label: "단가", value: "4,250원 / EA" },
          { label: "납기", value: "2026-08-05" },
          { label: "결제 조건", value: "L/C 90 days" },
          { label: "담당", value: "문가영 · 해외영업팀" },
        ],
      },
      {
        title: "SO-2606-31 · 한빛모터스",
        subtitle: "플랜지 커플링 · 8,000 EA",
        status: { label: "납기 임박", tone: "red" },
        fields: [
          { label: "수주 금액", value: "2.4억원" },
          { label: "단가", value: "3,000원 / EA" },
          { label: "납기", value: "2026-07-06 (D-4)" },
          { label: "결제 조건", value: "월말 마감 익월 30일" },
          { label: "생산 연계", value: "WO-2607-018 (지연 · 42%)" },
          { label: "담당", value: "강지훈 · 국내영업팀" },
        ],
      },
    ],
  },
  support: {
    tickets: [
      {
        title: "CS-2607-06 · 한빛모터스",
        subtitle: "AS 요청 · 접수 2026-07-02",
        status: { label: "우선순위 높음", tone: "red" },
        fields: [
          { label: "제품", value: "샤프트 어셈블리 (로트 L-26058)" },
          { label: "증상", value: "조립 후 이음(소음) 발생" },
          { label: "요청 유형", value: "현장 점검 + 교체" },
          { label: "연락처", value: "고객 담당 김과장 010-2211-0058" },
          { label: "담당", value: "서준일 · 고객지원팀" },
          { label: "연계", value: "품질검사 불량 분석(RCA) 연계 요청" },
        ],
      },
      {
        title: "CS-2607-05 · 세진전자",
        subtitle: "문의 · 접수 2026-07-02",
        status: { label: "우선순위 보통", tone: "slate" },
        fields: [
          { label: "문의 내용", value: "브래킷 도금 사양 변경 가능 여부" },
          { label: "요청 유형", value: "기술 문의" },
          { label: "연락처", value: "구매팀 이대리 010-7788-1020" },
          { label: "담당", value: "서준일 · 고객지원팀" },
        ],
      },
      {
        title: "CS-2607-04 · 대륙기계",
        subtitle: "AS 요청 · 접수 2026-07-01",
        status: { label: "우선순위 보통", tone: "amber" },
        fields: [
          { label: "제품", value: "감속 기어 2 EA" },
          { label: "증상", value: "백래시 과다 (규격 초과)" },
          { label: "요청 유형", value: "교체" },
          { label: "연락처", value: "품질팀 010-3040-7788" },
          { label: "담당", value: "김하늘 · 고객지원팀" },
        ],
      },
      {
        title: "CS-2607-03 · 글로벌AT",
        subtitle: "불만 · 접수 2026-07-01",
        status: { label: "우선순위 높음", tone: "red" },
        fields: [
          { label: "내용", value: "납품 포장 파손 재발 (2회차)" },
          { label: "요청 유형", value: "재발 방지 대책 요청" },
          { label: "연락처", value: "입고팀 010-9090-0301" },
          { label: "담당", value: "서준일 · 고객지원팀" },
          { label: "연계", value: "재고·물류 포장 사양 개선 검토" },
        ],
      },
    ],
    tracking: [
      {
        title: "CS-2607-06 처리 이력",
        subtitle: "샤프트 어셈블리 소음 · 담당 서준일",
        status: { label: "진행 · 원인 분석", tone: "blue" },
        fields: [
          { label: "현재 단계", value: "원인 분석 (0.5일 경과)" },
          { label: "다음 액션", value: "로트 추적 → 품질검사 연계" },
          { label: "고객 안내", value: "현장 점검 일정 협의 중" },
        ],
        tableTitle: "처리 타임라인",
        table: {
          columns: ["단계", "일시", "담당"],
          rows: [
            ["접수", "07-02 09:10", "자동"],
            ["할당", "07-02 09:25", "서준일"],
            ["원인 분석", "07-02 13:40", "서준일"],
          ],
        },
      },
      {
        title: "CS-2607-04 처리 이력",
        subtitle: "감속 기어 백래시 · 담당 김하늘",
        status: { label: "진행 · 교체품 발송", tone: "blue" },
        fields: [
          { label: "현재 단계", value: "교체품 발송 (1.2일 경과)" },
          { label: "다음 액션", value: "출고 완료 안내" },
          { label: "고객 안내", value: "택배 송장 공유 예정" },
        ],
      },
      {
        title: "CS-2607-03 처리 이력",
        subtitle: "포장 파손 재발 · 담당 서준일",
        status: { label: "진행 · 개선안 회신", tone: "amber" },
        fields: [
          { label: "현재 단계", value: "개선안 회신 (1.4일 경과)" },
          { label: "다음 액션", value: "포장 사양 변경 확정" },
          { label: "고객 안내", value: "완충재 사양 개선안 송부" },
        ],
      },
      {
        title: "CS-2606-28 처리 이력",
        subtitle: "완료 건 · 담당 김하늘",
        status: { label: "완료", tone: "green" },
        fields: [
          { label: "처리 결과", value: "교체 완료 · 고객 확인" },
          { label: "총 소요", value: "2.1일" },
          { label: "후속", value: "만족도 설문 발송됨" },
        ],
      },
    ],
  },
};

/** 조직도 팀 클릭 시 뜨는 구성원 (팀명 기준) */
export const HR_MEMBERS: Record<string, Member[]> = {
  "생산1팀 (CNC 가공)": [
    { name: "김재현", rank: "팀장", phone: "010-1000-0001", email: "jhkim@democompany.co.kr", joined: "2016-03-02" },
    { name: "이도현", rank: "선임", phone: "010-1000-0002", email: "dhlee@democompany.co.kr", joined: "2019-07-15" },
    { name: "박서준", rank: "사원", phone: "010-1000-0003", email: "sjpark@democompany.co.kr", joined: "2023-01-09" },
  ],
  "생산2팀 (프레스)": [
    { name: "박성우", rank: "팀장", phone: "010-1000-0011", email: "swpark@democompany.co.kr", joined: "2015-05-11" },
    { name: "정하늘", rank: "주임", phone: "010-1000-0012", email: "hjung@democompany.co.kr", joined: "2021-04-01" },
  ],
  품질관리팀: [
    { name: "이수진", rank: "팀장", phone: "010-1000-0021", email: "sjlee@democompany.co.kr", joined: "2017-02-20" },
    { name: "김태리", rank: "선임", phone: "010-1000-0022", email: "trkim@democompany.co.kr", joined: "2020-09-14" },
    { name: "박찬영", rank: "사원", phone: "010-1000-0023", email: "cypark@democompany.co.kr", joined: "2022-11-02" },
  ],
  설비보전팀: [
    { name: "정민호", rank: "팀장", phone: "010-1000-0031", email: "mhjung@democompany.co.kr", joined: "2014-08-04" },
    { name: "이강토", rank: "주임", phone: "010-1000-0032", email: "gtlee@democompany.co.kr", joined: "2019-12-01" },
  ],
  인사총무팀: [
    { name: "최은영", rank: "팀장", phone: "010-1000-0041", email: "eychoi@democompany.co.kr", joined: "2016-06-13" },
    { name: "박데모", rank: "부장", phone: "010-1234-5678", email: "demo@democompany.co.kr", joined: "2013-03-02" },
  ],
  재무회계팀: [
    { name: "한동훈", rank: "팀장", phone: "010-1000-0051", email: "dhhan@democompany.co.kr", joined: "2015-01-05" },
    { name: "오지현", rank: "선임", phone: "010-1000-0052", email: "jhoh@democompany.co.kr", joined: "2020-03-16" },
  ],
  구매자재팀: [
    { name: "오세라", rank: "팀장", phone: "010-1000-0061", email: "sroh@democompany.co.kr", joined: "2017-10-23" },
    { name: "김하람", rank: "사원", phone: "010-1000-0062", email: "hrkim@democompany.co.kr", joined: "2024-01-08" },
  ],
  국내영업팀: [
    { name: "강지훈", rank: "팀장", phone: "010-1000-0071", email: "jhkang@democompany.co.kr", joined: "2016-04-11" },
    { name: "서다은", rank: "선임", phone: "010-1000-0072", email: "deseo@democompany.co.kr", joined: "2021-08-30" },
  ],
  해외영업팀: [
    { name: "문가영", rank: "팀장", phone: "010-1000-0081", email: "gymoon@democompany.co.kr", joined: "2018-02-05" },
  ],
  고객지원팀: [
    { name: "서준일", rank: "팀장", phone: "010-1000-0091", email: "jiseo@democompany.co.kr", joined: "2018-09-17" },
    { name: "김하늘", rank: "사원", phone: "010-1000-0092", email: "hnkim@democompany.co.kr", joined: "2023-05-22" },
  ],
};
