/**
 * 업무 데이터 목록 — AI 가 조회할 수 있는 것들의 카탈로그.
 *
 * <b>도구를 조회마다 만들지 않는다.</b> 모듈 8개에 탭이 34개라 조회마다 도구를 두면 도구가 백 개를 넘고, 도구 설명이
 * 매 턴 프롬프트에 들어가므로 토큰이 그만큼 나가며 무엇보다 모델이 고르지 못한다. 창구 도구 하나를 두고 무엇을 조회할지
 * 이 목록에서 고르게 한다. 모듈이 늘어도 도구 수는 그대로고 이 배열만 길어진다.
 *
 * <b>항목마다 소속 탭이 있다.</b> 그 탭을 가진 사람에게만 목록에 보인다 — 권한 없는 항목은 모델에게 아예 보이지
 * 않으므로 부를 수도 없다. 그래도 실제 호출은 BE 의 같은 API 를 사용자 토큰으로 부르고, BE 가 직급의 탭 권한과
 * 회사의 기능 켜짐을 다시 본다. <b>목록에서 빼는 것은 안내이고 막는 것은 BE 다.</b>
 *
 * 나중에 온톨로지를 넣으면 이 배열이 그 자리로 옮겨 간다. 개념마다 소속 탭을 적는 칸만 있으면 지금 필터가 그대로 돈다.
 */
import "server-only";

export interface DataResource {
  /** 모델이 고르는 값 */
  id: string;
  /** 이 자료를 여는 기능 탭 id (`FE/data/modules.ts` 의 subfunction id) */
  tab: string;
  /** 모델이 읽는 한 줄 설명 — 무엇이 들어 있고 어떤 질문에 쓰는지 */
  description: string;
  /** BE 경로. 사용자 토큰으로 GET 한다 */
  path: string;
}

export const DATA_RESOURCES: DataResource[] = [
  {
    id: "payroll_runs",
    tab: "payroll",
    description:
      "급여 회차 목록. 회차마다 지급 대상 인원, 지급 예정일, 지급 총액·공제 총액·실지급액, 지급 항목 내역, 처리 상태(처리 대기 · 전표 생성 · 전표 반려 · 지급 완료), 연결된 전표 번호가 들어 있다. 급여 금액·지급일·처리 현황을 물을 때 부른다.",
    path: "/api/workspace/management/payroll",
  },
  {
    id: "accounting_vouchers",
    tab: "accounting",
    description:
      "회계 전표 목록과 월별 손익. 전표마다 번호, 일자, 구분(매입 · 매출 · 급여), 거래처, 적요, 금액, 부가세, 상태(검토중 · 승인 · 반려), 분개 내역이 들어 있다. 월별 손익은 달마다 매출과 매입·비용 합계다. 전표 · 매입 · 매출 · 손익을 물을 때 부른다.",
    path: "/api/workspace/management/accounting",
  },
  {
    id: "org_chart",
    tab: "hr",
    description:
      "조직도. 부서별 구성원의 이름 · 직급 · 이메일 · 합류일과 부서 인원 수가 들어 있다. 누가 어느 부서인지, 부서 인원이 몇 명인지를 물을 때 부른다. 급여 금액은 여기 없다.",
    path: "/api/workspace/management/org",
  },
];

/** 이 사람이 조회할 수 있는 것만. 권한 밖 항목은 모델이 이름조차 보지 못한다 */
export function resourcesFor(tabs: string[]): DataResource[] {
  return DATA_RESOURCES.filter((r) => tabs.includes(r.tab));
}
