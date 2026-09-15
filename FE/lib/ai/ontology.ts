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
   * `filters` 는 도구가 받은 조건 그대로다 — 외부 개념은 동등 조건을 서버로 넘겨 거기서 거른다(`externalPath`).
   * 넘기든 말든 `applyFilters` 가 결과에 한 번 더 걸리므로 여기서 다 거르지 않아도 된다.
   */
  load: (get: Get, filters?: Filter[]) => Promise<Record<string, unknown>[]>;
}

const INV = "/api/workspace/inventory";
const DESIGN = "/api/workspace/design";
const MGMT = "/api/workspace/management";

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

export const BUILTIN: Concept[] = [
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
];

/* ─────────────────────────── 외부 시스템 개념 (회사 · 시스템별 행) ───────────────────────────
 * BE `com.axcore.workspace.external` 이 테넌트 표 `external_system_concepts` 로 관리한다. 운영 콘솔이 넣고, AI 서버는 턴마다
 * `GET /api/workspace/external/ontology` 로 받아 `fromExternal` 로 Concept 을 조립해 내장 개념 뒤에 붙인다. SQL 은 오지 않는다.
 * 동등 조건은 `externalPath` 가 쿼리 파라미터로 넘겨 BE 가 허용 컬럼인지 보고 바인딩으로 WHERE 를 건다.
 */

const EXTERNAL = "/api/workspace/external";

/** BE `ExternalController.ConceptResponse` */
export interface ExternalConceptDto {
  systemId: number;
  systemName: string;
  systemKind: string;
  conceptId: string;
  name: string;
  synonyms: string[];
  tab: string;
  description: string;
  attrs: Record<string, string>;
  relations: { attr: string; to: string }[];
  formula: string | null;
  filterColumns: string[];
}

/**
 * 외부 개념의 BE 경로. 동등 조건(`eq`)만, 그것도 BE 가 허용한 컬럼만 쿼리 파라미터로 넘긴다. 다른 연산(contains · gt …)은
 * 넘기지 않고 결과에 `applyFilters` 가 건다. 값은 문자열로 보낸다(BE 가 text 비교).
 */
export function externalPath(systemId: number, conceptId: string, filterColumns: string[], filters: Filter[] | undefined): string {
  const q = new URLSearchParams();
  for (const f of filters ?? []) {
    if (f.op === "eq" && f.value !== undefined && filterColumns.includes(f.attr)) q.set(f.attr, String(f.value));
  }
  const s = q.toString();
  return `${EXTERNAL}/${systemId}/${encodeURIComponent(conceptId)}${s ? `?${s}` : ""}`;
}

/** 행 → Concept. 출처 문구는 시스템 이름으로 — 답과 추론 행에 「외부 MES · 1공장 MES」 처럼 보인다 */
export function fromExternal(list: ExternalConceptDto[]): Concept[] {
  return list.map((d) => ({
    id: d.conceptId,
    name: d.name,
    synonyms: d.synonyms,
    tab: d.tab,
    description: d.description,
    attrs: d.attrs,
    relations: d.relations,
    formula: d.formula ?? undefined,
    source: `외부 ${d.systemKind} · ${d.systemName}`,
    load: async (get, filters) => rows<Record<string, unknown>>(await get(externalPath(d.systemId, d.conceptId, d.filterColumns, filters))),
  }));
}

/** 이 사람이 조회할 수 있는 개념만. 권한 밖 개념은 모델이 이름조차 보지 못한다. `concepts` 는 내장 + 외부를 합친 목록 */
export function conceptsFor(tabs: string[], concepts: Concept[] = BUILTIN): Concept[] {
  return concepts.filter((c) => tabs.includes(c.tab));
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
export function expandSynonyms(question: string, concepts: Concept[] = BUILTIN): string {
  const extra = new Set<string>();
  for (const c of concepts) {
    const words = [c.name, ...c.synonyms];
    if (!words.some((w) => question.includes(w))) continue;
    for (const w of words) if (!question.includes(w)) extra.add(w);
  }
  return extra.size ? `${question} ${[...extra].join(" ")}` : question;
}
