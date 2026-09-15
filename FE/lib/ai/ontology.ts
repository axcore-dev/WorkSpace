/**
 * 업무 온톨로지 — AI 가 조회할 수 있는 개념과, 그 개념이 시스템 어디에 있는지를 적은 표.
 *
 * 개념마다 사람이 쓰는 말(동의어) · 속성 · 다른 개념과의 관계 · 파생값이면 그 계산 · 값을 가져오는 방법(`load`)이
 * 있다. `workspace_data` 도구(`server/data-tools.ts`)가 이 표로 도구 설명을 짓고 조회를 실행하며, 문서 검색
 * (`server/retrieval.ts`)이 동의어로 검색어를 넓힌다. 예전 `data-catalog.ts` 가 이 안으로 흡수됐다.
 *
 * <b>왜 개념 단위인가.</b> 사용자는 "제품" 이라 하고 시스템은 품목 · 도면 · BOM 항목으로 나뉜다. "미매핑" 은 BOM 항목
 * → 품목 관계가 비어 있다는 뜻이고 어느 API 도 그 낱말을 모른다. 이 번역표가 없으면 모델은 업로드 문서에서
 * "미매핑 제품 리스트" 라는 문자열을 찾는다(2026-09-14 재고 질문이 그렇게 실패했다).
 *
 * <b>파생값은 여기서 센다.</b> 현재 재고(기초 + Σ 이력)는 화면이 `stockOf` 로 계산하고 BE 는 원본만 준다
 * (`InventoryReadService` 주석 — 같은 계산을 두 곳에 두지 않는다). AI 서버는 FE 안에 있으므로 <b>같은 함수</b>를
 * 부른다. 계산이 세 번째 자리로 늘지 않는다.
 *
 * <b>권한은 두 겹이다.</b> 개념마다 소속 탭이 있어 그 탭을 가진 사람에게만 보이고(`conceptsFor`), 실제 호출은 BE 의
 * 같은 API 를 사용자 토큰으로 부르므로 BE 가 다시 막는다. 목록에서 빼는 것은 안내이고 막는 것은 BE 다.
 *
 * 이 파일은 `node --test` 가 그대로 돌 수 있게 `server-only` 와 `@/` 별칭을 쓰지 않는다.
 */
import type { Drawing } from "../../data/drawings";
import type { Item, ItemStandard, Movement } from "../../data/inventory";
import { liveLatest } from "../design-state.ts";
import { stockOf } from "../inventory-state.ts";

/** BE GET. 경로는 `/api/…` 그대로. 실행부(`data-tools.ts`)가 사용자 토큰을 붙여 부른다 */
export type Get = (path: string) => Promise<unknown>;

export interface Concept {
  /** 모델이 고르는 값 */
  id: string;
  /** 화면 이름 */
  name: string;
  /** 사용자가 쓰는 말. 검색어 확장과 도구 설명에 쓴다 */
  synonyms: string[];
  /** 이 개념을 여는 기능 탭 id (`FE/data/modules.ts` 의 subfunction id) */
  tab: string;
  /** 어떤 질문에 쓰는지 한 줄 */
  description: string;
  /** 행의 속성 → 뜻. 도구 설명과 filter 의 attr 후보다 */
  attrs: Record<string, string>;
  /** 다른 개념을 가리키는 속성. `whenNull` 은 비어 있을 때 부르는 이름("미매핑") */
  relations?: { attr: string; to: string; whenNull?: string }[];
  /** 파생값이면 사람이 읽는 계산식 */
  formula?: string;
  /** 우리 DB 가 아닌 외부 시스템에서 오는 개념이면 그 이름. 도구 설명과 결과에 실려 모델이 답에 출처로 밝힌다 */
  source?: string;
  /**
   * 행 목록을 만든다. 원본 개념은 GET 한 번, 파생 개념은 여러 GET 을 합쳐 센다.
   * `filters` 는 도구가 받은 조건 그대로다 — 외부 DB 개념은 동등 조건을 서버로 넘겨 거기서 거른다(`mesPath`).
   * 넘기든 말든 `applyFilters` 가 결과에 한 번 더 걸리므로 여기서 다 거르지 않아도 된다.
   */
  load: (get: Get, filters?: Filter[]) => Promise<Record<string, unknown>[]>;
}

const INV = "/api/workspace/inventory";
const DESIGN = "/api/workspace/design";
const MGMT = "/api/workspace/management";
/** MES 개념 7개의 출처 문구 — 도구 설명 · 결과 · 추론 과정 행에 그대로 보인다 */
export const MES_SOURCE = "외부 MES (고객사 MES DB 연동)";

const rows = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** 도면번호마다 지금 도면 하나(폐기 · 옛 리비전 제외)의 BOM 줄. 발주서 · BOM 관리가 보는 것과 같은 범위 */
export function bomLines(drawings: Drawing[]): Record<string, unknown>[] {
  return liveLatest(drawings).flatMap((d) =>
    d.bom.map((l) => ({
      drawing: d.code,
      rev: d.rev,
      drawingName: d.name,
      item: l.item,
      spec: l.spec,
      size: l.size,
      qty: l.qty,
      itemCode: l.itemCode ?? null,
      mapped: l.itemCode != null,
    })),
  );
}

/** 품목마다 현재 재고 한 줄. 계산은 화면과 같은 `stockOf` */
export function stockRows(items: Item[], movements: Movement[], standards: ItemStandard[]): Record<string, unknown>[] {
  return items
    .filter((i) => !i.discontinued)
    .map((i) => {
      const std = standards.find((s) => s.itemCode === i.code);
      return {
        itemCode: i.code,
        name: i.name,
        spec: i.spec,
        size: i.size,
        unit: i.unit,
        stock: stockOf(i.code, movements, standards),
        safety: std?.safety ?? null,
        asOf: std?.asOf || null,
      };
    });
}

export const ONTOLOGY: Concept[] = [
  {
    id: "item",
    name: "품목",
    synonyms: ["제품", "부품", "자재", "품번", "품목 마스터"],
    tab: "items",
    description: "품목 마스터. 품목이 무엇이 있는지, 코드 · 사양 · 규격 · 단위 · 거래처를 물을 때. 수량은 여기 없다(stock).",
    attrs: {
      code: "품목 코드",
      name: "품명",
      spec: "사양",
      size: "규격",
      unit: "단위",
      category: "분류",
      vendorIds: "거래처 id 목록(첫 번째가 기본 거래처)",
      location: "보관 위치",
      discontinued: "단종 여부",
    },
    relations: [{ attr: "vendorIds", to: "vendor" }],
    load: async (get) => rows<Item>(await get(`${INV}/items`)).map((i) => ({ ...i })),
  },
  {
    id: "stock",
    name: "현재 재고",
    synonyms: ["재고", "재고 수량", "보유량", "재고량"],
    tab: "stock",
    description: "품목별 현재 재고와 안전 재고. 얼마나 있는지, 안전 재고 미달인지를 물을 때.",
    attrs: {
      itemCode: "품목 코드",
      name: "품명",
      spec: "사양",
      size: "규격",
      unit: "단위",
      stock: "현재 수량",
      safety: "안전 재고(null = 미설정)",
      asOf: "기초 재고 기준일(null = 처음부터)",
    },
    relations: [{ attr: "itemCode", to: "item" }],
    formula: "기초 재고 + 입고 − 출고 ± 조정 (기준일 이후, 불합격 입고 제외). 단종 품목 제외",
    load: async (get) => {
      const [items, movements, settings] = await Promise.all([get(`${INV}/items`), get(`${INV}/movements`), get(`${INV}/settings`)]);
      const standards = rows<ItemStandard>((settings as { standards?: unknown } | null)?.standards);
      return stockRows(rows<Item>(items), rows<Movement>(movements), standards);
    },
  },
  {
    id: "movement",
    name: "입출고 이력",
    synonyms: ["입고", "출고", "이력", "입출고", "재고 조정"],
    tab: "movements",
    description: "품목별 입고 · 출고 · 조정 기록(최신순). 언제 누가 얼마나 넣고 뺐는지를 물을 때.",
    attrs: {
      id: "이력 id",
      at: "일시(분 단위)",
      itemCode: "품목 코드",
      kind: "종류(in 입고 · out 출고 · adjust 조정 · baseline 기초 변경)",
      qty: "부호 있는 수량",
      actor: "담당자",
      ref: "관리번호 · 발주번호 · 사유",
      note: "비고",
      poNo: "발주번호",
      judgement: "입고 판정(pass · fail)",
    },
    relations: [{ attr: "itemCode", to: "item" }, { attr: "poNo", to: "purchase_order" }],
    load: async (get) => rows<Movement>(await get(`${INV}/movements`)).map((m) => ({ ...m })),
  },
  {
    id: "purchase_order",
    name: "발주",
    synonyms: ["발주서", "PO", "주문", "구매"],
    tab: "purchasing",
    description: "발주서 목록과 줄별 발주 · 입고 수량. 무엇을 어디에 얼마나 발주했고 얼마나 들어왔는지를 물을 때.",
    attrs: {
      poNo: "발주번호",
      orderedOn: "발주일",
      vendorId: "거래처 id",
      projectCode: "프로젝트 코드",
      drawing: "근거 도면번호",
      rev: "근거 도면 리비전",
      requester: "요청자",
      lines: "줄 목록(itemCode · nameAtOrder · ordered · received · judgement)",
      closedOn: "마감일(null = 진행 중)",
    },
    relations: [{ attr: "vendorId", to: "vendor" }, { attr: "drawing", to: "drawing" }],
    load: async (get) => rows<Record<string, unknown>>(await get(`${INV}/orders`)),
  },
  {
    id: "vendor",
    name: "거래처",
    synonyms: ["공급사", "업체", "협력사", "납품처"],
    tab: "vendors",
    description: "거래처 목록. 어느 업체가 있고 리드타임이 며칠인지를 물을 때.",
    attrs: {
      id: "거래처 id",
      name: "이름",
      kind: "종류(parts · material · outsourcing · inhouse)",
      leadTimeDays: "리드타임(일)",
      ownerName: "담당자",
      active: "거래 중 여부",
    },
    load: async (get) => rows<Record<string, unknown>>(await get(`${INV}/vendors`)),
  },
  {
    id: "drawing",
    name: "도면",
    synonyms: ["도면번호", "설계", "리비전"],
    tab: "drawings",
    description: "도면 목록(리비전마다 한 줄). 어떤 도면이 있고 상태 · 리비전 · BOM 줄 수 · 미매핑 수가 어떤지를 물을 때.",
    attrs: {
      code: "도면번호",
      rev: "리비전",
      name: "도면 이름",
      status: "상태(승인 · 확인 필요 · 폐기)",
      parent: "파생이면 상위 도면번호",
      projectCode: "프로젝트 코드",
      updated: "갱신일",
      bomCount: "BOM 줄 수",
      unmappedCount: "그중 미매핑 줄 수",
    },
    load: async (get) =>
      rows<Drawing>(await get(`${DESIGN}/drawings`)).map((d) => ({
        code: d.code,
        rev: d.rev,
        name: d.name,
        status: d.status,
        parent: d.parent ?? null,
        projectCode: d.projectCode ?? null,
        updated: d.updated,
        bomCount: d.bom.length,
        unmappedCount: d.bom.filter((l) => l.itemCode == null).length,
      })),
  },
  {
    id: "bom_line",
    name: "BOM 항목",
    synonyms: ["BOM", "소요 자재", "구성품", "매핑", "미매핑"],
    tab: "bom",
    description:
      "지금 도면(도면번호마다 최신 리비전, 폐기 제외)의 BOM 줄. 도면에 무엇이 몇 개 들어가는지, 어느 줄이 품목에 매핑됐는지를 물을 때. " +
      "「미매핑」은 itemCode 가 비어 있는 줄이다 — filter: [{ attr: \"mapped\", op: \"eq\", value: false }].",
    attrs: {
      drawing: "도면번호",
      rev: "리비전",
      drawingName: "도면 이름",
      item: "품명(엑셀 표기)",
      spec: "사양",
      size: "규격",
      qty: "수량",
      itemCode: "매핑된 품목 코드",
      mapped: "매핑 여부",
    },
    relations: [{ attr: "itemCode", to: "item", whenNull: "미매핑" }, { attr: "drawing", to: "drawing" }],
    load: async (get) => bomLines(rows<Drawing>(await get(`${DESIGN}/drawings`))),
  },
  {
    id: "payroll_runs",
    name: "급여 회차",
    synonyms: ["급여", "월급", "지급"],
    tab: "payroll",
    description: "급여 회차 목록. 회차별 지급 대상 인원 · 지급 예정일 · 총액 · 공제 · 실지급액 · 처리 상태 · 전표 번호. 급여 금액 · 지급일 · 처리 현황을 물을 때.",
    attrs: {},
    load: async (get) => rows<Record<string, unknown>>(await get(`${MGMT}/payroll`)),
  },
  {
    id: "accounting_vouchers",
    name: "회계 전표",
    synonyms: ["전표", "매입", "매출", "손익", "회계"],
    tab: "accounting",
    description: "회계 전표 목록과 월별 손익. 전표마다 번호 · 일자 · 구분 · 거래처 · 적요 · 금액 · 부가세 · 상태 · 분개. 전표 · 매입 · 매출 · 손익을 물을 때.",
    attrs: {},
    load: async (get) => {
      const v = await get(`${MGMT}/accounting`);
      return Array.isArray(v) ? (v as Record<string, unknown>[]) : v && typeof v === "object" ? [v as Record<string, unknown>] : [];
    },
  },
  {
    id: "org_chart",
    name: "조직도",
    synonyms: ["부서", "인원", "구성원", "직원"],
    tab: "hr",
    description: "부서별 구성원의 이름 · 직급 · 이메일 · 합류일과 부서 인원 수. 누가 어느 부서인지를 물을 때. 급여 금액은 여기 없다.",
    attrs: {},
    load: async (get) => {
      const v = await get(`${MGMT}/org`);
      return Array.isArray(v) ? (v as Record<string, unknown>[]) : v && typeof v === "object" ? [v as Record<string, unknown>] : [];
    },
  },

  /* ─────────────────────────── 외부 MES (고객사 DB · BE 커넥터 경유) ───────────────────────────
   * BE `com.axcore.workspace.mes` 가 읽기 전용 계정으로 고객 MES DB 를 읽는다. 컬럼 이름은 BE `MesConcepts` 의
   * SELECT 와 같아야 한다. 동등 조건은 `mesPath` 가 쿼리 파라미터로 넘겨 BE 가 WHERE 로 건다(바인딩).
   * 데모 데이터는 `INFRA/seed/data/mes-supabase.sql` — 프레스 생산라인이고, 제품의 금형 도면 코드가 제품설계 도면번호다.
   */
  {
    id: "mes_work_order",
    source: MES_SOURCE,
    name: "작업지시",
    synonyms: ["생산 지시", "WO", "생산 계획", "진행률", "생산 실적"],
    tab: "workorders",
    description:
      "MES 작업지시와 진행률. 어떤 제품을 얼마나 찍기로 했고 지금 몇 개 나왔는지, 지연됐는지를 물을 때. " +
      "die_drawing_code 가 제품설계 도면번호라 「이 도면으로 찍는 작업지시」 를 이을 수 있다.",
    attrs: {
      wo_no: "작업지시 번호(WO-YYMM-NNN)",
      product_code: "제품 코드",
      product_name: "제품명(예: S03 OP20 (FO) LH)",
      die_drawing_code: "금형 도면번호",
      status: "상태(대기 · 진행 · 완료 · 보류)",
      priority: "우선순위(긴급 · 보통 · 낮음)",
      line: "라인(1라인 · 2라인)",
      planned_qty: "계획 수량",
      produced_qty: "생산 수량(마지막 공정 양품)",
      defect_qty: "불량 수량",
      progress_pct: "진행률 %",
      planned_start: "계획 시작일",
      planned_end: "계획 종료일",
      actual_start: "실제 시작",
      actual_end: "실제 종료",
      delayed: "계획보다 늦게 끝났는가",
    },
    relations: [{ attr: "die_drawing_code", to: "drawing" }],
    load: (get, filters) => mesRows(get, "work_order", filters),
  },
  {
    id: "mes_equipment",
    source: MES_SOURCE,
    name: "설비",
    synonyms: ["프레스", "호기", "기계", "장비", "비가동률", "가동률"],
    tab: "monitoring",
    description: "MES 설비 목록과 최근 30일 비가동 합계. 어떤 설비가 있고 상태가 어떤지, 비가동이 많은 설비가 무엇인지를 물을 때.",
    attrs: {
      code: "설비 코드(PR-03 = 3호기)",
      name: "설비 이름",
      kind: "종류(BL 블랭킹 · PR 프레스 · WD 용접 · INS 검사)",
      line: "라인",
      capacity_ton: "프레스 톤수",
      status: "상태(가동 · 정지 · 정비중)",
      installed_on: "설치일",
      maker: "제조사",
      downtime_events_30d: "최근 30일 비가동 건수",
      downtime_minutes_30d: "최근 30일 비가동 분",
      breakdown_minutes_30d: "그중 고장 분",
    },
    load: (get, filters) => mesRows(get, "equipment", filters),
  },
  {
    id: "mes_production_result",
    source: MES_SOURCE,
    name: "공정 실적",
    synonyms: ["실적", "양품", "생산량", "교대 실적", "작업자 실적"],
    tab: "workorders",
    description: "MES 공정 실적(교대마다 한 줄, 최신순). 어느 작업지시 · 공정 · 설비 · 작업자가 언제 몇 개 찍었고 불량이 몇 개였는지를 물을 때. 목록이 길다 — wo_no 나 equipment_code 로 거른다.",
    attrs: {
      id: "실적 id",
      wo_no: "작업지시 번호",
      op_seq: "공정 순번(10 블랭킹 · 20 성형 · 30 트리밍 · 40 피어싱 · 50 검사)",
      process: "공정 이름",
      equipment_code: "설비 코드",
      worker_id: "작업자 id",
      worker_name: "작업자 이름",
      shift: "교대(주간 · 야간)",
      recorded_at: "기록 시각",
      good_qty: "양품 수",
      defect_qty: "불량 수",
      run_minutes: "가동 분",
    },
    relations: [{ attr: "wo_no", to: "mes_work_order" }, { attr: "equipment_code", to: "mes_equipment" }],
    load: (get, filters) => mesRows(get, "production_result", filters),
  },
  {
    id: "mes_downtime",
    source: MES_SOURCE,
    name: "비가동",
    synonyms: ["정지", "고장", "다운타임", "금형 교체", "정비"],
    tab: "monitoring",
    description: "MES 설비 비가동 기록(최신순). 언제 어느 설비가 왜 얼마나 멈췄는지를 물을 때. equipment_code 나 reason_code 로 거른다.",
    attrs: {
      id: "기록 id",
      equipment_code: "설비 코드",
      started_at: "시작",
      ended_at: "끝",
      minutes: "정지 분",
      reason_code: "사유 코드(BRK 고장 · CHG 금형교체 · MAT 자재대기 · QC 검사대기 · PM 예방정비 · PWR 정전)",
      reason: "사유",
      wo_no: "그때 진행 중이던 작업지시",
      note: "비고",
    },
    relations: [{ attr: "equipment_code", to: "mes_equipment" }, { attr: "wo_no", to: "mes_work_order" }],
    load: (get, filters) => mesRows(get, "downtime", filters),
  },
  {
    id: "mes_sensor",
    source: MES_SOURCE,
    name: "설비 센서",
    synonyms: ["진동", "온도", "부하", "PLC", "스트로크"],
    tab: "monitoring",
    description: "MES 프레스 센서 시간별 기록(최근 14일, 최신순). 진동 · 온도 · 부하가 어떤 추세인지를 물을 때. equipment_code 로 거른다.",
    attrs: {
      equipment_code: "설비 코드",
      recorded_at: "기록 시각",
      load_pct: "부하율 %",
      slide_temp_c: "슬라이드 온도 ℃",
      vibration_mm_s: "진동 mm/s",
      strokes: "그 시간의 스트로크 수",
    },
    relations: [{ attr: "equipment_code", to: "mes_equipment" }],
    load: (get, filters) => mesRows(get, "sensor", filters),
  },
  {
    id: "mes_defect",
    source: MES_SOURCE,
    name: "불량 기록",
    synonyms: ["불량", "NG", "크랙", "주름", "버", "폐기", "재작업"],
    tab: "defects",
    description: "MES 불량 기록(최신순). 어느 작업지시 · 공정 · 설비에서 어떤 불량이 몇 개 났고 어떻게 처리했는지를 물을 때. wo_no 나 defect_type 으로 거른다.",
    attrs: {
      id: "기록 id",
      wo_no: "작업지시 번호",
      op_seq: "공정 순번",
      equipment_code: "설비 코드",
      recorded_at: "기록 시각",
      defect_type: "불량 유형(크랙 · 주름 · 버 · 스크래치 · 치수불량 · 소재불량 · 피어싱 누락)",
      qty: "수량",
      cause: "원인",
      disposition: "처리(폐기 · 재작업 · 특채)",
    },
    relations: [{ attr: "wo_no", to: "mes_work_order" }, { attr: "equipment_code", to: "mes_equipment" }],
    load: (get, filters) => mesRows(get, "defect", filters),
  },
  {
    id: "mes_defect_rate",
    source: MES_SOURCE,
    name: "불량률",
    synonyms: ["불량율", "수율", "공정 불량", "설비 불량"],
    tab: "defects",
    description: "MES 공정 · 설비별 최근 30일 불량률(높은 순). 어느 공정이나 설비의 불량률이 높은지를 물을 때.",
    attrs: {
      op_seq: "공정 순번",
      process: "공정 이름",
      equipment_code: "설비 코드",
      good_qty: "양품 합",
      defect_qty: "불량 합",
      defect_rate_pct: "불량률 %",
    },
    formula: "불량 ÷ (양품 + 불량) × 100, 최근 30일 실적",
    load: (get, filters) => mesRows(get, "defect_rate", filters),
  },
];

/* ─────────────────────────── 외부 MES 경로 ─────────────────────────── */

const MES = "/api/workspace/mes";

/**
 * MES 개념의 BE 경로. 동등 조건(`eq`)만 쿼리 파라미터로 넘긴다 — BE 가 허용 컬럼인지 보고 바인딩으로 WHERE 를 건다.
 * 다른 연산(contains · gt …)은 넘기지 않고 결과에 `applyFilters` 가 건다. 값은 문자열로 보낸다(BE 가 text 비교).
 */
export function mesPath(concept: string, filters: Filter[] | undefined): string {
  const q = new URLSearchParams();
  for (const f of filters ?? []) {
    if (f.op === "eq" && f.value !== undefined) q.set(f.attr, String(f.value));
  }
  const s = q.toString();
  return `${MES}/${concept}${s ? `?${s}` : ""}`;
}

const mesRows = async (get: Get, concept: string, filters: Filter[] | undefined) =>
  rows<Record<string, unknown>>(await get(mesPath(concept, filters)));

/** 이 사람이 조회할 수 있는 개념만. 권한 밖 개념은 모델이 이름조차 보지 못한다 */
export function conceptsFor(tabs: string[]): Concept[] {
  return ONTOLOGY.filter((c) => tabs.includes(c.tab));
}

/** 도구 설명에 들어가는 개념 목록. 동의어 · 속성 · 관계 · 계산식을 모델이 질문 시점에 본다 */
export function describeConcepts(list: Concept[]): string {
  return list
    .map((c) => {
      const names = [c.name, ...c.synonyms].join(" · ");
      const attrs = Object.entries(c.attrs).map(([k, v]) => `${k}=${v}`);
      const rel = (c.relations ?? []).map((r) => `${r.attr} → ${r.to}${r.whenNull ? ` (비면 「${r.whenNull}」)` : ""}`);
      const lines = [`- ${c.id} (${names}): ${c.description}`];
      if (attrs.length) lines.push(`    속성: ${attrs.join(", ")}`);
      if (rel.length) lines.push(`    관계: ${rel.join(", ")}`);
      if (c.formula) lines.push(`    계산: ${c.formula}`);
      if (c.source) lines.push(`    출처: ${c.source} — 우리 DB 가 아니라 외부 시스템에서 읽는다`);
      return lines.join("\n");
    })
    .join("\n");
}

/* ─────────────────────────── 필터 ─────────────────────────── */

export const FILTER_OPS = ["eq", "ne", "contains", "is_null", "not_null", "gt", "lt"] as const;
export type FilterOp = (typeof FILTER_OPS)[number];
export interface Filter {
  attr: string;
  op: FilterOp;
  value?: string | number | boolean;
}

function matches(v: unknown, f: Filter): boolean {
  switch (f.op) {
    case "is_null":
      return v == null || v === "";
    case "not_null":
      return !(v == null || v === "");
    case "eq":
      return v === f.value || String(v) === String(f.value);
    case "ne":
      return !(v === f.value || String(v) === String(f.value));
    case "contains":
      return v != null && String(v).toLowerCase().includes(String(f.value ?? "").toLowerCase());
    case "gt":
      return typeof v === "number" ? v > Number(f.value) : String(v) > String(f.value);
    case "lt":
      return typeof v === "number" ? v < Number(f.value) : String(v) < String(f.value);
  }
}

/** 모든 조건을 만족하는 행만(AND). 서버가 거른 뒤 돌려주므로 목록이 길어도 도구 출력 상한에 잘리지 않는다 */
export function applyFilters(list: Record<string, unknown>[], filters: Filter[] | undefined): Record<string, unknown>[] {
  if (!filters?.length) return list;
  return list.filter((row) => filters.every((f) => matches(row[f.attr], f)));
}

/* ─────────────────────────── 검색어 확장 ─────────────────────────── */

/**
 * 질문에 어떤 개념의 이름 · 동의어가 들어 있으면 그 개념의 다른 말들을 덧붙인다. "제품" 으로 물어도 "품목" 이
 * 든 문서 조각이 전문 검색에 걸리게. 임베딩이 아니라 <b>전문 검색 쪽 낱말</b>에만 쓴다 — 부분 일치(word_similarity)
 * 는 질의가 길어지면 오히려 묽어진다.
 */
export function expandSynonyms(question: string, concepts: Concept[] = ONTOLOGY): string {
  const extra = new Set<string>();
  for (const c of concepts) {
    const words = [c.name, ...c.synonyms];
    if (!words.some((w) => question.includes(w))) continue;
    for (const w of words) if (!question.includes(w)) extra.add(w);
  }
  return extra.size ? `${question} ${[...extra].join(" ")}` : question;
}
