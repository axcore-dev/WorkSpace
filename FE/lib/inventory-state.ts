import type {
  DocRules,
  Item,
  ItemStandard,
  Judgement,
  Movement,
  PurchaseOrder,
  SafetyStandard,
  Vendor,
} from "../data/inventory";
import type { PurchaseOrderRow } from "../data/purchasing";
import { daysBetween } from "./management-state.ts";

/**
 * 재고·물류 공유 상태의 모양과 순수 파생 함수 · 리듀서.
 * React 없이 두는 이유: `lib/inventory-state.test.ts` 가 node --test 로 검증한다.
 *
 * 서버가 있으면 동작은 서버가 처리하고 다시 받는다. 리듀서는 BE 가 없는 dev 폴백에서만 돈다
 * (`components/inventory/inventory-provider.tsx`).
 */

export interface InventoryData {
  orders: PurchaseOrder[];
  movements: Movement[];
  items: Item[];
  vendors: Vendor[];
  standards: ItemStandard[];
  standard: SafetyStandard;
  docRules: DocRules;
}

export interface InventoryState extends InventoryData {
  /** YYYY-MM-DD. 폴백 모드에서는 데모의 고정 「오늘」 */
  today: string;
}

/** 서버에 보내는 동작. 누가(actor) · 언제(at)는 서버가 토큰과 시계로 정한다 — 폴백 리듀서만 밖에서 받는다 */
export type InventoryAction =
  | {
      type: "receive";
      poNo: string;
      lines: { no: string; received: number; judgement: Judgement; note?: string }[];
      /** 잔량이 남아도 마감한다 */
      complete: boolean;
    }
  | { type: "adjust"; itemCode: string; qty: number; note: string }
  | { type: "setBaseline"; itemCode: string; baseline: number; asOf: string; safety: number | null }
  /** 발주서 위저드가 발주처별로 나눈 발주들. 번호는 서버가 정한다(폴백에서는 위저드 값 그대로) */
  | { type: "createOrders"; orders: PurchaseOrder[] }
  | { type: "upsertItem"; item: Item }
  | { type: "discontinueItem"; itemCode: string; discontinued: boolean }
  | { type: "upsertVendor"; vendor: Vendor }
  | { type: "createVendorInline"; name: string }
  | { type: "setStandard"; standard: SafetyStandard }
  | { type: "setDocRules"; rules: DocRules };

/* ───────────── 발주 ───────────── */

export const lineRemaining = (l: { ordered: number; received: number }) => Math.max(0, l.ordered - l.received);
export const orderOrdered = (o: PurchaseOrder) => o.lines.reduce((s, l) => s + l.ordered, 0);
export const orderReceived = (o: PurchaseOrder) => o.lines.reduce((s, l) => s + l.received, 0);
export const orderRemaining = (o: PurchaseOrder) => o.lines.reduce((s, l) => s + lineRemaining(l), 0);

/**
 * 상태 네 가지. 「도착」은 시스템이 모른다 — 발주일 · 수량 · 입고 등록만 안다.
 * - overdue: 잔량 > 0 이고 `today − orderedOn > vendor.leadTimeDays`. 리드타임이 없으면 판단하지 않는다
 * - waiting: 입고 등록이 한 건도 없음(경과일 N)
 * - partial: 일부 입고, 잔량 N
 * - done: 잔량 0 또는 마감됨
 */
export type OrderStatus =
  | { kind: "overdue"; days: number }
  | { kind: "waiting"; days: number }
  | { kind: "partial"; remaining: number }
  | { kind: "done" };

export function orderStatus(order: PurchaseOrder, vendors: Vendor[], today: string): OrderStatus {
  const remaining = orderRemaining(order);
  if (remaining === 0 || order.closedOn) return { kind: "done" };
  const days = daysBetween(order.orderedOn, today);
  const lead = vendors.find((v) => v.id === order.vendorId)?.leadTimeDays ?? null;
  if (lead !== null && days > lead) return { kind: "overdue", days };
  if (orderReceived(order) === 0) return { kind: "waiting", days };
  return { kind: "partial", remaining };
}

const STATUS_RANK: Record<OrderStatus["kind"], number> = { overdue: 0, waiting: 1, partial: 2, done: 3 };

/** 할 일 순 — 기한 넘김(경과일 큰 순) → 등록 전(경과일 큰 순) → 부분 입고(잔량 큰 순) → 완료(최근 발주 먼저) */
export function orderSort(orders: PurchaseOrder[], vendors: Vendor[], today: string): PurchaseOrder[] {
  const key = (o: PurchaseOrder): [number, number, string] => {
    const s = orderStatus(o, vendors, today);
    const inner = s.kind === "overdue" || s.kind === "waiting" ? -s.days : s.kind === "partial" ? -s.remaining : 0;
    return [STATUS_RANK[s.kind], inner, o.orderedOn];
  };
  return [...orders].sort((a, b) => {
    const [ra, ia, da] = key(a);
    const [rb, ib, db] = key(b);
    if (ra !== rb) return ra - rb;
    if (ia !== ib) return ia - ib;
    if (da !== db) return db.localeCompare(da);
    return b.poNo.localeCompare(a.poNo);
  });
}

/** 발주 rev ≠ 도면 현재 rev — 개정 경고 한 줄의 조건 */
export function revMismatch(order: PurchaseOrder, drawings: { code: string; rev: string }[]): boolean {
  const d = drawings.find((x) => x.code === order.drawing);
  return !!d && d.rev !== order.rev;
}

export const pendingCount = (state: Pick<InventoryState, "orders" | "vendors" | "today">) =>
  state.orders.filter((o) => orderStatus(o, state.vendors, state.today).kind !== "done").length;

/**
 * 발주서 위저드(도면·BOM 기반, Phase 5 까지 유지)가 만든 발주 → 새 모델.
 * 발주처는 이름으로, 품목은 사양+규격 → 이름 순으로 맞춘다. 못 맞추면 빈 코드 — 발주서는 나가지만 재고에는 잡히지 않는다.
 */
export function fromWizardRows(rows: PurchaseOrderRow[], vendors: Vendor[], items: Item[]): PurchaseOrder[] {
  return rows.map((row) => ({
    poNo: row.poNo,
    orderedOn: row.orderedOn,
    vendorId: vendors.find((v) => v.name === row.supplier)?.id ?? "",
    projectCode: row.projectCode,
    drawing: row.drawing,
    rev: row.rev,
    requester: row.requester,
    lines: row.lines.map((l, i) => {
      const item = items.find((it) => it.spec === l.spec && it.size === l.size) ?? items.find((it) => it.name === l.itemName);
      return {
        no: String(i + 1).padStart(2, "0"),
        itemCode: item?.code ?? "",
        nameAtOrder: l.itemName,
        specAtOrder: l.spec,
        sizeAtOrder: l.size,
        ordered: l.qty,
        received: 0,
        judgement: null,
        note: "",
      };
    }),
  }));
}

/* ───────────── 재고 ───────────── */

export interface StockBreakdown {
  baseline: number;
  in: number;
  out: number;
  adjust: number;
  stock: number;
}

/**
 * 재고 = 기초(asOf) + Σ 이력(asOf 이후). 저장된 값이 없다.
 * - 불합격 입고(`judgement: "fail"`)는 기록만 남고 합산하지 않는다
 * - `baseline` 종류는 기초 변경의 흔적이라 합산하지 않는다
 * - 기준(`ItemStandard`)이 없는 품목은 기초 0 · 전 기간 이력
 */
export function stockBreakdown(itemCode: string, movements: Movement[], standards: ItemStandard[]): StockBreakdown {
  const std = standards.find((s) => s.itemCode === itemCode);
  const asOf = std?.asOf ?? "";
  const b: StockBreakdown = { baseline: std?.baseline ?? 0, in: 0, out: 0, adjust: 0, stock: 0 };
  for (const m of movements) {
    if (m.itemCode !== itemCode || m.kind === "baseline" || m.at < asOf || m.judgement === "fail") continue;
    if (m.kind === "in") b.in += m.qty;
    else if (m.kind === "out") b.out += -m.qty;
    else b.adjust += m.qty;
  }
  b.stock = b.baseline + b.in - b.out + b.adjust;
  return b;
}

export const stockOf = (itemCode: string, movements: Movement[], standards: ItemStandard[]) =>
  stockBreakdown(itemCode, movements, standards).stock;

/**
 * 품목의 안전 기준. null 이면 미달을 판단하지 않는다(「미설정」).
 * - manual: 담당자가 적은 값 그대로
 * - leadTimeAvg: 기본 거래처 리드타임 × 최근 N일 일평균 출고. 리드타임이 없으면 null. 출고가 0건이면 0(항상 충족)
 */
export function safetyOf(
  item: Item,
  state: Pick<InventoryState, "standards" | "standard" | "vendors" | "movements" | "today">,
): number | null {
  const std = state.standards.find((s) => s.itemCode === item.code);
  if (state.standard.method === "manual") return std?.safety ?? null;
  const lead = state.vendors.find((v) => v.id === item.vendorIds[0])?.leadTimeDays ?? null;
  if (lead === null) return null;
  const window = state.standard.avgWindowDays;
  const out = state.movements
    .filter((m) => m.itemCode === item.code && m.kind === "out" && daysBetween(m.at.slice(0, 10), state.today) < window)
    .reduce((s, m) => s + -m.qty, 0);
  return Math.ceil((out / window) * lead);
}

/** 모자란 수량. 기준이 없으면 null, 기준 0 은 항상 충족(0) */
export function shortage(stock: number, safety: number | null): number | null {
  if (safety === null) return null;
  return Math.max(0, safety - stock);
}

/**
 * 이력 행마다 「그 시점의 잔량」 — 상세 보기의 잔량 열. 품목별로 오래된 것부터 누적한다.
 * 기준일 이전 행 · 불합격 · baseline 행은 잔량을 바꾸지 않는다(`stockBreakdown` 과 같은 규칙).
 */
export function runningStock(movements: Movement[], standards: ItemStandard[]): Record<string, number> {
  const out: Record<string, number> = {};
  const bal: Record<string, number> = {};
  const asc = [...movements].sort((a, b) => a.at.localeCompare(b.at));
  for (const m of asc) {
    const std = standards.find((s) => s.itemCode === m.itemCode);
    if (!(m.itemCode in bal)) bal[m.itemCode] = std?.baseline ?? 0;
    const counts = m.kind !== "baseline" && m.judgement !== "fail" && m.at >= (std?.asOf ?? "");
    if (counts) bal[m.itemCode] += m.qty;
    out[m.id] = bal[m.itemCode];
  }
  return out;
}

/* ───────────── 문서 규칙 ───────────── */

const SEGMENT_SAMPLE: Record<DocRules["codeSegments"][number], string> = {
  year: "26",
  vendorInitial: "PT",
  model: "MSX",
  team: "S03",
  seq: "20",
};

/** 관리번호 미리보기 — 데모 값으로 조각 순서 · 구분자를 보여 준다. 예) `26MSX-S03 OP20` */
export function previewCode(rules: DocRules): string {
  let s = "";
  for (const seg of rules.codeSegments) {
    if (seg === "team") s += rules.separators.beforeTeam + SEGMENT_SAMPLE.team;
    else if (seg === "seq") s += rules.separators.beforeOp + "OP" + SEGMENT_SAMPLE.seq;
    else s += SEGMENT_SAMPLE[seg];
  }
  return s;
}

/* ───────────── 리듀서 (dev 폴백 전용) ───────────── */

const nextId = (prefix: string, existing: { id: string }[]) => {
  const max = existing.reduce((m, x) => {
    const n = Number(x.id.slice(x.id.lastIndexOf("-") + 1));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
};

/**
 * 동작을 로컬에 적용한다. 서버가 있을 때는 쓰지 않는다 — 발주번호 · 이력 id 를 서버가 정한다.
 * `at`(ISO 분 단위) · `actor` 는 호출한 쪽의 지금 · 로그인 사용자. 순수 함수로 두기 위해 밖에서 받는다.
 */
export function reduce(state: InventoryState, action: InventoryAction, at: string, actor: string): InventoryState {
  switch (action.type) {
    case "receive": {
      const order = state.orders.find((o) => o.poNo === action.poNo);
      if (!order) return state;
      const movements = [...state.movements];
      const lines = order.lines.map((l) => {
        const r = action.lines.find((x) => x.no === l.no);
        if (!r || r.received <= 0) return l;
        // 초과 입고는 막지 않는다 — 잔량은 0 이 되고 초과분은 이력 메모에 남는다
        const over = r.judgement === "pass" ? Math.max(0, r.received - lineRemaining(l)) : 0;
        const note = [r.note ?? "", over > 0 ? `초과 +${over}` : ""].filter(Boolean).join(" · ");
        movements.unshift({
          id: nextId("m", movements),
          at,
          itemCode: l.itemCode,
          kind: "in",
          qty: r.received,
          actor,
          ref: order.projectCode,
          note,
          poNo: order.poNo,
          judgement: r.judgement,
        });
        // 불합격은 잔량에 세지 않는다 — 다시 받을 수 있게
        const received = r.judgement === "pass" ? l.received + r.received : l.received;
        return { ...l, received, judgement: r.judgement, note: r.note ?? l.note };
      });
      const next: PurchaseOrder = { ...order, lines, ...(action.complete ? { closedOn: at.slice(0, 10) } : {}) };
      return { ...state, movements, orders: state.orders.map((o) => (o.poNo === order.poNo ? next : o)) };
    }
    case "adjust":
      return {
        ...state,
        movements: [
          { id: nextId("m", state.movements), at, itemCode: action.itemCode, kind: "adjust", qty: action.qty, actor, ref: action.note, note: "" },
          ...state.movements,
        ],
      };
    case "setBaseline": {
      const std: ItemStandard = { itemCode: action.itemCode, baseline: action.baseline, asOf: action.asOf, safety: action.safety };
      const has = state.standards.some((s) => s.itemCode === action.itemCode);
      return {
        ...state,
        standards: has ? state.standards.map((s) => (s.itemCode === action.itemCode ? std : s)) : [...state.standards, std],
        movements: [
          { id: nextId("m", state.movements), at, itemCode: action.itemCode, kind: "baseline", qty: action.baseline, actor, ref: `기준일 ${action.asOf}`, note: "" },
          ...state.movements,
        ],
      };
    }
    case "createOrders":
      return { ...state, orders: [...action.orders, ...state.orders] };
    case "upsertItem": {
      const has = state.items.some((i) => i.code === action.item.code);
      return { ...state, items: has ? state.items.map((i) => (i.code === action.item.code ? action.item : i)) : [action.item, ...state.items] };
    }
    case "discontinueItem":
      return { ...state, items: state.items.map((i) => (i.code === action.itemCode ? { ...i, discontinued: action.discontinued } : i)) };
    case "upsertVendor": {
      const has = state.vendors.some((v) => v.id === action.vendor.id);
      return { ...state, vendors: has ? state.vendors.map((v) => (v.id === action.vendor.id ? action.vendor : v)) : [...state.vendors, action.vendor] };
    }
    case "createVendorInline":
      // 「만들기」로 생긴 거래처 — 리드타임이 비어 거래처 탭에서 채우게 한다
      return {
        ...state,
        vendors: [...state.vendors, { id: nextId("v", state.vendors), name: action.name.trim(), kind: "parts", initial: "", leadTimeDays: null, owner: "", active: true }],
      };
    case "setStandard":
      return { ...state, standard: action.standard };
    case "setDocRules":
      return { ...state, docRules: action.rules };
  }
}
