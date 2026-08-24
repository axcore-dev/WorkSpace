import { CHART } from "@/lib/palette";
import type { DetailRecord, Member, ModulePageData } from "../types";

/** 경영지원 모듈 화면 데이터 — 상세 페이지 구성 + 행 클릭 상세 */
export const PAGE: ModulePageData = {
    // 실무자 관점 순서: 당장 처리할 승인 → 다가오는 지급 → 손익 → 인원
    stats: [
      {
        label: "등록 자재 품목",
        value: "1,284품목",
        delta: "+26",
        deltaTone: "green",
        sub: "이번 달 신규",
        cta: { label: "자재 보기", tabId: "materials" },
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
        table: {
          columns: ["처리 회차", "대상", "지급 총액", "공제 총액", "전표", "상태"],
          rows: [
            ["2026년 7월 정기급여", "128명", "421,800,000원", "58,300,000원", "미생성", { badge: "처리 대기", tone: "amber" }],
            ["2026년 6월 정기급여", "125명", "413,500,000원", "57,100,000원", "V-2606-001", { badge: "지급 완료", tone: "green" }],
            ["2026년 상반기 성과급", "119명", "186,000,000원", "25,700,000원", "V-2606-014", { badge: "지급 완료", tone: "green" }],
            ["2026년 5월 정기급여", "125명", "409,900,000원", "56,600,000원", "V-2605-001", { badge: "지급 완료", tone: "green" }],
          ],
        },
      },
      {
        id: "materials",
        label: "자재 관리",
        actions: ["filter", "create"],
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
    ],
  };

export const DETAILS: Record<string, DetailRecord[]> = {
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

/**
 * 조직도(module-pages)의 팀별 인원수와 상세보기 명단 수를 일치시킨다.
 * 대표 인물은 위에 수기로 두고, 나머지는 결정적(비랜덤)으로 생성해
 * SSR/CSR 하이드레이션이 어긋나지 않게 한다. 총 128명.
 */
const TEAM_SIZES: Record<string, number> = {
  "생산1팀 (CNC 가공)": 28,
  "생산2팀 (프레스)": 22,
  품질관리팀: 14,
  설비보전팀: 10,
  인사총무팀: 8,
  재무회계팀: 9,
  구매자재팀: 14,
  국내영업팀: 12,
  해외영업팀: 6,
  고객지원팀: 5,
};

const FAMILY_NAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "전", "홍"];
const GIVEN_NAMES = ["민준", "서연", "도윤", "지우", "하준", "서현", "은우", "지민", "수아", "예준", "시우", "하은", "지호", "유진", "준서", "채원"];

Object.entries(TEAM_SIZES).forEach(([teamName, size], teamIdx) => {
  const list = HR_MEMBERS[teamName];
  if (!list) return;
  for (let i = list.length; i < size; i++) {
    const seed = teamIdx * 31 + i;
    const ratio = i / size;
    list.push({
      name: FAMILY_NAMES[(seed * 3) % FAMILY_NAMES.length] + GIVEN_NAMES[(seed * 5) % GIVEN_NAMES.length],
      rank: ratio < 0.25 ? "책임" : ratio < 0.5 ? "선임" : ratio < 0.75 ? "주임" : "사원",
      phone: `010-${String(2100 + teamIdx).padStart(4, "0")}-${String(1000 + i)}`,
      email: `member${teamIdx}${String(i).padStart(2, "0")}@democompany.co.kr`,
      joined: `${2014 + (seed % 11)}-${String((seed % 12) + 1).padStart(2, "0")}-${String((seed % 27) + 1).padStart(2, "0")}`,
    });
  }
});
