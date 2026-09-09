import { CHART } from "../../lib/palette.ts";
import type { ChartSpec, Member, ModulePageData, Tone } from "../types";

/**
 * 경영지원 화면 데이터 — 인사·급여·회계 작업대의 초기값.
 *
 * BE seam: 실연동 시 이 파일의 상수를 `GET /api/management/org` · `/payroll` · `/vouchers`
 * 응답으로 바꾸고, 상태 변경 액션(전표 만들기·지급 완료·재산출·승인·반려)은
 * `components/management/management-provider.tsx`에서 POST로 바꾼다. 화면 컴포넌트는 손대지 않는다.
 *
 * `@/` 별칭을 쓰지 않는 이유: `data/management.test.ts`가 node --test로 이 파일을 import한다.
 */

/** 데모의 '오늘' — D-day·경과일 계산 기준 */
export const DEMO_TODAY = "2026-07-06";

export interface Team {
  name: string;
  head: string;
  size: number;
  badge?: { text: string; tone: Tone };
}
export interface Division {
  name: string;
  teams: Team[];
}

export const ORG: { company: string; divisions: Division[] } = {
  company: "(주)데모컴퍼니",
  divisions: [
    {
      name: "생산본부",
      teams: [
        { name: "생산1팀 (CNC 가공)", head: "김재현", size: 28, badge: { text: "주간 2교대", tone: "slate" } },
        { name: "생산2팀 (프레스)", head: "박성우", size: 22 },
        { name: "품질관리팀", head: "이수진", size: 14 },
        { name: "설비보전팀", head: "정민호", size: 10 },
      ],
    },
    {
      name: "경영지원본부",
      teams: [
        { name: "인사총무팀", head: "최은영", size: 8 },
        { name: "재무회계팀", head: "한동훈", size: 9 },
        { name: "구매자재팀", head: "오세라", size: 14 },
      ],
    },
    {
      name: "영업본부",
      teams: [
        { name: "국내영업팀", head: "강지훈", size: 12 },
        { name: "해외영업팀", head: "문가영", size: 6 },
        { name: "고객지원팀", head: "서준일", size: 5 },
      ],
    },
  ],
};

export type PayrollStatus = "처리 대기" | "전표 생성" | "전표 반려" | "지급 완료";

export interface PayrollItem {
  label: string;
  /** 공제는 음수 */
  amount: number;
  note: string;
}

export interface PayrollRun {
  id: string;
  name: string;
  headcount: number;
  /** 지급 예정일 YYYY-MM-DD */
  payDate: string;
  gross: number;
  deduction: number;
  net: number;
  /** 양수 합 = gross, 음수 합 = −deduction */
  items: PayrollItem[];
  status: PayrollStatus;
  voucherNo?: string;
  paidAt?: string;
}

export const PAYROLL_RUNS: PayrollRun[] = [
  {
    id: "2026-07",
    name: "2026년 7월 정기급여",
    headcount: 128,
    payDate: "2026-07-24",
    gross: 421_800_000,
    deduction: 58_300_000,
    net: 363_500_000,
    status: "처리 대기",
    items: [
      { label: "기본급", amount: 352_400_000, note: "128명 · 입사자 3명 일할 계산" },
      { label: "연장수당", amount: 41_200_000, note: "생산직 중심" },
      { label: "직책·식대", amount: 28_200_000, note: "—" },
      { label: "국민연금·건강보험", amount: -31_900_000, note: "공제" },
      { label: "소득세·지방세", amount: -26_400_000, note: "공제" },
    ],
  },
  {
    id: "2026-06",
    name: "2026년 6월 정기급여",
    headcount: 125,
    payDate: "2026-06-25",
    gross: 413_500_000,
    deduction: 57_100_000,
    net: 356_400_000,
    status: "지급 완료",
    voucherNo: "V-2606-001",
    paidAt: "2026-06-25",
    items: [
      { label: "기본급", amount: 345_600_000, note: "125명" },
      { label: "연장수당", amount: 40_100_000, note: "생산직 중심" },
      { label: "직책·식대", amount: 27_800_000, note: "—" },
      { label: "국민연금·건강보험", amount: -31_400_000, note: "공제" },
      { label: "소득세·지방세", amount: -25_700_000, note: "공제" },
    ],
  },
  {
    id: "2026-h1-bonus",
    name: "2026년 상반기 성과급",
    headcount: 119,
    payDate: "2026-06-26",
    gross: 186_000_000,
    deduction: 25_700_000,
    net: 160_300_000,
    status: "지급 완료",
    voucherNo: "V-2606-014",
    paidAt: "2026-06-26",
    items: [
      { label: "성과급", amount: 186_000_000, note: "상반기 KPI 등급" },
      { label: "국민연금·건강보험", amount: -14_100_000, note: "공제" },
      { label: "소득세·지방세", amount: -11_600_000, note: "공제" },
    ],
  },
  {
    id: "2026-05",
    name: "2026년 5월 정기급여",
    headcount: 125,
    payDate: "2026-05-25",
    gross: 409_900_000,
    deduction: 56_600_000,
    net: 353_300_000,
    status: "지급 완료",
    voucherNo: "V-2605-001",
    paidAt: "2026-05-25",
    items: [
      { label: "기본급", amount: 342_700_000, note: "125명" },
      { label: "연장수당", amount: 39_600_000, note: "생산직 중심" },
      { label: "직책·식대", amount: 27_600_000, note: "—" },
      { label: "국민연금·건강보험", amount: -31_100_000, note: "공제" },
      { label: "소득세·지방세", amount: -25_500_000, note: "공제" },
    ],
  },
];

export type VoucherStatus = "검토중" | "승인" | "반려";

export interface VoucherLine {
  account: string;
  debit?: number;
  credit?: number;
  memo: string;
}

export interface Voucher {
  no: string;
  date: string;
  kind: "매입" | "매출" | "급여";
  counterparty: string;
  summary: string;
  amount: number;
  vat?: number;
  account: string;
  owner: string;
  status: VoucherStatus;
  /** 차변 합 = 대변 합 */
  lines: VoucherLine[];
  purchase?: { item: string; code: string; qty: number; unit: string; unitPrice: number };
  /** 급여 전표면 원 회차 */
  runId?: string;
  rejectReason?: string;
}

export const VOUCHERS: Voucher[] = [
  {
    no: "V-2607-001",
    date: "2026-07-01",
    kind: "매입",
    counterparty: "NSK코리아",
    summary: "베어링 608ZZ 5,000EA",
    amount: 5_750_000,
    vat: 575_000,
    account: "원재료",
    owner: "오세라 (구매자재팀)",
    status: "검토중",
    lines: [
      { account: "원재료", debit: 5_750_000, memo: "베어링 608ZZ 5,000EA" },
      { account: "부가세대급금", debit: 575_000, memo: "매입세액" },
      { account: "외상매입금", credit: 6_325_000, memo: "NSK코리아" },
    ],
    purchase: { item: "베어링 608ZZ", code: "PRT-BRG-608", qty: 5000, unit: "EA", unitPrice: 1150 },
  },
  {
    no: "V-2607-003",
    date: "2026-07-01",
    kind: "매입",
    counterparty: "한국알루텍",
    summary: "알루미늄 합금 6061 5,000kg",
    amount: 24_250_000,
    vat: 2_425_000,
    account: "원재료",
    owner: "오세라 (구매자재팀)",
    status: "승인",
    lines: [
      { account: "원재료", debit: 24_250_000, memo: "알루미늄 합금 6061 5,000kg" },
      { account: "부가세대급금", debit: 2_425_000, memo: "매입세액" },
      { account: "외상매입금", credit: 26_675_000, memo: "한국알루텍" },
    ],
    purchase: { item: "알루미늄 합금 6061", code: "MAT-AL-6061", qty: 5000, unit: "kg", unitPrice: 4850 },
  },
  {
    no: "V-2607-002",
    date: "2026-07-01",
    kind: "매출",
    counterparty: "한빛모터스",
    summary: "정밀 샤프트 납품",
    amount: 86_400_000,
    vat: 8_640_000,
    account: "제품매출",
    owner: "강지훈 (국내영업팀)",
    status: "승인",
    lines: [
      { account: "외상매출금", debit: 95_040_000, memo: "한빛모터스" },
      { account: "제품매출", credit: 86_400_000, memo: "정밀 샤프트 납품" },
      { account: "부가세예수금", credit: 8_640_000, memo: "매출세액" },
    ],
  },
  {
    no: "V-2606-089",
    date: "2026-06-30",
    kind: "매출",
    counterparty: "세진전자",
    summary: "브래킷 어셈블리",
    amount: 42_120_000,
    vat: 4_212_000,
    account: "제품매출",
    owner: "서다은 (국내영업팀)",
    status: "승인",
    lines: [
      { account: "외상매출금", debit: 46_332_000, memo: "세진전자" },
      { account: "제품매출", credit: 42_120_000, memo: "브래킷 어셈블리" },
      { account: "부가세예수금", credit: 4_212_000, memo: "매출세액" },
    ],
  },
  {
    no: "V-2606-001",
    date: "2026-06-24",
    kind: "급여",
    counterparty: "임직원",
    summary: "2026년 6월 정기급여 (125명)",
    amount: 413_500_000,
    account: "급여",
    owner: "최은영 (인사총무팀)",
    status: "승인",
    runId: "2026-06",
    lines: [
      { account: "급여", debit: 413_500_000, memo: "125명" },
      { account: "예수금", credit: 57_100_000, memo: "4대보험 · 소득세" },
      { account: "보통예금", credit: 356_400_000, memo: "실지급" },
    ],
  },
];

/** 월별 손익 요약 — 회계 작업대 요약 뷰 (기존 값 표시·호버 유지, compact) */
export const MONTHLY_PL: ChartSpec = {
  type: "bar",
  title: "월별 손익 요약",
  valueUnit: "억",
  compact: true,
  labels: ["1월", "2월", "3월", "4월", "5월", "6월"],
  series: [
    { name: "매출", color: CHART.primary, values: [18.2, 17.5, 19.8, 21.3, 20.6, 22.4] },
    { name: "매입·비용", color: CHART.neutral, values: [15.9, 15.8, 17.2, 18.4, 18.1, 20.6] },
  ],
};

/** 화면 구성 — 세 탭 전부 전용 작업대. KPI 행 없음, 기본 탭은 마감이 가까운 급여 */
export const PAGE: ModulePageData = {
  stats: [],
  defaultTabId: "payroll",
  tabs: [
    { id: "hr", label: "인사 관리", custom: "hr-workbench" },
    { id: "payroll", label: "급여 관리", custom: "payroll-workbench" },
    { id: "accounting", label: "회계 관리", custom: "accounting-workbench" },
  ],
};

/** 조직도 팀 클릭 시 뜨는 구성원 (팀명 기준) — 대표 인물은 수기, 나머지는 아래 생성기 */
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
 * 조직도(ORG)의 팀별 인원수와 명단 수를 일치시킨다.
 * 대표 인물은 위에 수기로 두고, 나머지는 결정적(비랜덤)으로 생성해
 * SSR/CSR 하이드레이션이 어긋나지 않게 한다. 총 128명.
 */
const TEAM_SIZES: Record<string, number> = Object.fromEntries(
  ORG.divisions.flatMap((d) => d.teams.map((t) => [t.name, t.size])),
);

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
