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
import type { PoDrawing, PoNeed } from "../data/purchasing";
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
  /** 발주 · 재고 · 이력이 하나도 없을 때만 (화면이 버튼을 안 그린다) */
  | { type: "deleteItem"; itemCode: string }
  /** 엑셀 업로드 — 갱신 · 신규를 한 번에. 오류 행은 화면이 이미 뺐다 */
  | { type: "importItems"; items: Item[] }
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
  /** 자체 제작 거래처 — 문서가 없는 제작 지시. 입고 등록이 시작되면 부분 입고로 */
  | { kind: "making"; days: number }
  | { kind: "partial"; remaining: number }
  | { kind: "done" };

export function orderStatus(order: PurchaseOrder, vendors: Vendor[], today: string): OrderStatus {
  const remaining = orderRemaining(order);
  if (remaining === 0 || order.closedOn) return { kind: "done" };
  const days = daysBetween(order.orderedOn, today);
  const vendor = vendors.find((v) => v.id === order.vendorId);
  if (vendor?.kind === "inhouse" && orderReceived(order) === 0) return { kind: "making", days };
  const lead = vendor?.leadTimeDays ?? null;
  if (lead !== null && days > lead) return { kind: "overdue", days };
  if (orderReceived(order) === 0) return { kind: "waiting", days };
  return { kind: "partial", remaining };
}

const STATUS_RANK: Record<OrderStatus["kind"], number> = { overdue: 0, waiting: 1, making: 2, partial: 3, done: 4 };

/** 할 일 순 — 기한 넘김(경과일 큰 순) → 등록 전(경과일 큰 순) → 제작 중 → 부분 입고(잔량 큰 순) → 완료(최근 발주 먼저) */
export function orderSort(orders: PurchaseOrder[], vendors: Vendor[], today: string): PurchaseOrder[] {
  const key = (o: PurchaseOrder): [number, number, string] => {
    const s = orderStatus(o, vendors, today);
    const inner = s.kind === "overdue" || s.kind === "waiting" || s.kind === "making" ? -s.days : s.kind === "partial" ? -s.remaining : 0;
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

/* ───────────── 발주서 작성 (한 화면 편집기) ───────────── */

export type DocFormat = "material" | "parts";

/** 편집기의 라인 — 모든 칸을 사람이 고칠 수 있다. 수량 0 은 화면에 남되 문서 · 등록에서 빠진다 */
export interface DraftLine {
  id: string;
  itemName: string;
  spec: string;
  size: string;
  unit: string;
  qty: number;
  vendorId: string;
  /** 가공 요청 태그 — 문서 규칙의 태그 마스터에서 고른다 */
  tags: string[];
  note: string;
}

export interface OrderDraft {
  drawing: string;
  rev: string;
  projectCode: string;
  requester: string;
  orderedOn: string;
  format: DocFormat;
  lines: DraftLine[];
}

/** 품목 마스터에서 라인에 맞는 품목 — 사양+규격 → 이름 순. 없으면 undefined(발주서는 나가지만 재고에 안 잡힌다) */
export const findItemFor = (items: Item[], l: { itemName: string; spec: string; size: string }) =>
  items.find((it) => it.spec === l.spec && it.size === l.size) ?? items.find((it) => it.name === l.itemName);

export const blankLine = (id: string): DraftLine => ({ id, itemName: "", spec: "", size: "", unit: "EA", qty: 0, vendorId: "", tags: [], note: "" });

/** 도면(BOM)에서 초안 — 수량은 소요 − 재고, 발주처는 BOM 의 공급처(거래 중이면) → 품목 기본 거래처 순 */
export function draftFromBom(
  drawing: PoDrawing | null,
  bom: PoNeed[],
  vendors: Vendor[],
  items: Item[],
  base: { requester: string; orderedOn: string; format?: DocFormat },
): OrderDraft {
  const lines: DraftLine[] = bom.map((n, i) => {
    const item = findItemFor(items, n);
    const supplier = vendors.find((v) => v.name === n.supplier && v.active);
    return {
      id: `bom-${i + 1}`,
      itemName: n.itemName,
      spec: n.spec,
      size: n.size,
      unit: item?.unit ?? "EA",
      qty: Math.max(0, n.need - n.stock),
      vendorId: supplier?.id ?? item?.vendorIds[0] ?? "",
      tags: [],
      note: "",
    };
  });
  return {
    drawing: drawing?.code ?? "",
    rev: drawing?.rev ?? "",
    projectCode: drawing?.projectCode ?? "",
    requester: base.requester,
    orderedOn: base.orderedOn,
    format: base.format ?? "parts",
    lines,
  };
}

/** 수량 > 0 라인을 발주처별로(첫 등장 순). 발주처가 빈 라인은 빈 문자열 그룹 */
export function groupDraft(draft: OrderDraft): { vendorId: string; lines: DraftLine[] }[] {
  const groups: { vendorId: string; lines: DraftLine[] }[] = [];
  for (const l of draft.lines) {
    if (l.qty <= 0) continue;
    const g = groups.find((x) => x.vendorId === l.vendorId);
    if (g) g.lines.push(l);
    else groups.push({ vendorId: l.vendorId, lines: [l] });
  }
  return groups;
}

/** 등록 전 검증 — 수량 있는 라인 · 품명 · 발주처 · 관리번호 · 미매핑 BOM */
export function validateDraft(draft: OrderDraft, drawings: PoDrawing[]): Record<string, string> {
  const e: Record<string, string> = {};
  const active = draft.lines.filter((l) => l.qty > 0);
  if (active.length === 0) e.lines = "수량이 있는 라인이 없어요";
  else {
    if (active.some((l) => !l.itemName.trim())) e.lines = "품명이 빈 라인이 있어요";
    if (active.some((l) => !l.vendorId)) e.vendor = "발주처가 빈 라인이 있어요";
  }
  if (!draft.projectCode.trim()) e.projectCode = "관리번호를 적어 주세요";
  const d = drawings.find((x) => x.code === draft.drawing);
  if (d && d.unmapped > 0) e.unmapped = `제품설계 > BOM 관리에서 매핑을 마쳐 주세요 — 품목 마스터에 없는 BOM 항목이 ${d.unmapped}건 있어요`;
  return e;
}

/** 발주처별 발주 — 번호는 서버가 정하기 전까지의 데모 규칙 `PO-YYMM-NNNN`. 태그는 라인 조치사항 앞에 남는다 */
export function buildOrders(draft: OrderDraft, items: Item[], seqStart: number): PurchaseOrder[] {
  const yymm = `${draft.orderedOn.slice(2, 4)}${draft.orderedOn.slice(5, 7)}`;
  return groupDraft(draft).map((g, i) => ({
    poNo: `PO-${yymm}-${String(seqStart + i + 1).padStart(4, "0")}`,
    orderedOn: draft.orderedOn,
    vendorId: g.vendorId,
    projectCode: draft.projectCode.trim(),
    drawing: draft.drawing,
    rev: draft.rev,
    requester: draft.requester,
    lines: g.lines.map((l, k) => ({
      no: String(k + 1).padStart(2, "0"),
      itemCode: findItemFor(items, l)?.code ?? "",
      nameAtOrder: l.itemName.trim(),
      specAtOrder: l.spec.trim(),
      sizeAtOrder: l.size.trim(),
      ordered: l.qty,
      received: 0,
      judgement: null,
      note: [l.tags.join(" · "), l.note.trim()].filter(Boolean).join(" — "),
    })),
  }));
}

/** 문서 열 이름 → 라인 값. 서식에 없는 열은 문서에 안 찍힌다 */
const DOC_FIELD: Record<string, (l: DraftLine, d: OrderDraft) => string> = {
  품명: (l) => l.itemName,
  호칭: (l) => l.spec,
  규격: (l) => l.size,
  수량: (l) => String(l.qty),
  단위: (l) => l.unit,
  비고: (l) => l.note,
  도면번호: (_, d) => d.drawing,
  납기: () => "",
};

export interface OrderDocument {
  /** 파일 이름 조각 — 전체 / 발주처명 */
  label: string;
  vendorId: string | null;
  rows: string[][];
}

/**
 * 출력물 — 전체 1장(항상, 자체 제작 포함 · 발주처 열 있음) + 거래처별 N장(자체 제작은 문서가 없다 · 제작 지시).
 * 열은 문서 규칙의 서식(자재/부품)을 따르고, 가공 요청 태그가 하나라도 있으면 「가공 요청」 열이 붙는다.
 */
export function orderDocuments(draft: OrderDraft, vendors: Vendor[], rules: DocRules): OrderDocument[] {
  const groups = groupDraft(draft);
  const cols = rules.formats[draft.format];
  const tagged = groups.some((g) => g.lines.some((l) => l.tags.length > 0));
  const name = (id: string) => vendors.find((v) => v.id === id)?.name ?? "—";
  const head = (title: string, vendor?: string) => [
    [title],
    ["관리번호", draft.projectCode, "", "근거 도면", `${draft.drawing} ${draft.rev}`.trim()],
    ["발주일", draft.orderedOn, "", vendor === undefined ? "요청자" : "발주처", vendor === undefined ? draft.requester : vendor],
    [],
  ];
  const line = (l: DraftLine, i: number, extra: string[] = []) => [
    String(i + 1),
    ...cols.map((c) => DOC_FIELD[c]?.(l, draft) ?? ""),
    ...(tagged ? [l.tags.join(" · ")] : []),
    ...extra,
  ];
  const total = (ls: DraftLine[]) => String(ls.reduce((s, l) => s + l.qty, 0));
  const header = (extra: string[] = []) => ["No.", ...cols, ...(tagged ? ["가공 요청"] : []), ...extra];
  const sumRow = (ls: DraftLine[], extra = 0) => ["합계", ...cols.map((c) => (c === "수량" ? total(ls) : "")), ...(tagged ? [""] : []), ...Array<string>(extra).fill("")];

  const all = groups.flatMap((g) => g.lines);
  const docs: OrderDocument[] = [
    { label: "전체", vendorId: null, rows: [...head("발주서 · 전체"), header(["발주처"]), ...all.map((l, i) => line(l, i, [name(l.vendorId)])), [], sumRow(all, 1)] },
  ];
  for (const g of groups) {
    const v = vendors.find((x) => x.id === g.vendorId);
    if (!v || v.kind === "inhouse") continue;
    docs.push({ label: v.name, vendorId: v.id, rows: [...head(`발주서 · ${v.name}`, v.name), header(), ...g.lines.map((l, i) => line(l, i)), [], sumRow(g.lines)] });
  }
  return docs;
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

/* ───────────── 설정 검증 (팝업 · 엑셀 · 규칙) ───────────── */

/** 이름 비교용 — 공백 · 대소문자를 무시한다 */
export const normalizeName = (s: string) => s.toLowerCase().replace(/\s+/g, "");

export interface ItemUsage {
  /** 진행 중(완료 아닌) 발주 중 이 품목 라인이 있는 건수 */
  openOrders: number;
  stock: number;
  movements: number;
}

export function itemUsage(itemCode: string, state: Pick<InventoryState, "orders" | "movements" | "standards" | "vendors" | "today">): ItemUsage {
  return {
    openOrders: state.orders.filter((o) => orderStatus(o, state.vendors, state.today).kind !== "done" && o.lines.some((l) => l.itemCode === itemCode)).length,
    stock: stockOf(itemCode, state.movements, state.standards),
    movements: state.movements.filter((m) => m.itemCode === itemCode).length,
  };
}

/** 발주 · 재고 · 이력 중 하나라도 있으면 삭제할 수 없고 코드 · 단위를 바꿀 수 없다 */
export const itemInUse = (u: ItemUsage) => u.openOrders > 0 || u.stock !== 0 || u.movements > 0;

/** 품목 저장 검증 — 필드별 에러 문구(다음 행동이 제목). 비면 통과 */
export function validateItem(draft: Item, state: InventoryState, isNew: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  const code = draft.code.trim();
  if (!code) e.code = "품목 코드를 적어 주세요";
  else if (isNew && state.items.some((i) => i.code === code)) e.code = "이미 있는 코드예요";
  if (!draft.name.trim()) e.name = "품목명을 적어 주세요";
  if (!draft.unit.trim()) e.unit = "단위를 골라 주세요";
  else if (!isNew) {
    const before = state.items.find((i) => i.code === draft.code);
    if (before && before.unit !== draft.unit) {
      const u = itemUsage(draft.code, state);
      if (u.stock !== 0 || u.movements > 0) e.unit = "단위를 바꾸려면 새 품목으로 등록하고 이 품목은 단종해 주세요";
    }
  }
  if (draft.vendorIds.length === 0) e.vendorIds = "거래처를 한 곳 이상 골라 주세요";
  else {
    const first = state.vendors.find((v) => v.id === draft.vendorIds[0]);
    if (draft.vendorIds.some((id) => !state.vendors.some((v) => v.id === id))) e.vendorIds = "거래처를 만들지 못했어요 — 다시 골라 주세요";
    else if (first && !first.active) e.vendorIds = "기본 거래처가 거래 중지 상태예요 — 다른 거래처를 앞으로 옮겨 주세요";
  }
  return e;
}

/** 이 거래처를 기본(첫 칩)으로 쓰는 품목 — 거래 중지 confirm 의 N */
export const defaultVendorItems = (vendorId: string, items: Item[]) => items.filter((i) => !i.discontinued && i.vendorIds[0] === vendorId);

/** 거래처 저장 검증. `warnings` 는 저장은 되지만 알려 주는 것(이니셜 겹침) */
export function validateVendor(draft: Vendor, state: Pick<InventoryState, "vendors">, isNew: boolean): { errors: Record<string, string>; warnings: Record<string, string> } {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};
  const others = state.vendors.filter((v) => (isNew ? true : v.id !== draft.id));
  const name = draft.name.trim();
  if (!name) errors.name = "거래처명을 적어 주세요";
  else if (others.some((v) => normalizeName(v.name) === normalizeName(name))) errors.name = "이미 있는 거래처예요";
  if (draft.kind === "inhouse") {
    if (others.some((v) => v.kind === "inhouse")) errors.kind = "자체 제작 거래처는 하나만 둘 수 있어요";
    if (!draft.active) errors.active = "자체 제작은 거래 중지할 수 없어요";
  } else if (draft.leadTimeDays === null || !Number.isInteger(draft.leadTimeDays) || draft.leadTimeDays < 0) {
    errors.leadTimeDays = "리드타임을 0 이상의 정수로 적어 주세요";
  }
  const initial = draft.initial.trim();
  if (initial && others.some((v) => v.initial.trim().toUpperCase() === initial.toUpperCase())) warnings.initial = "이니셜이 겹쳐요 — 관리번호가 겹칠 수 있어요";
  return { errors, warnings };
}

/** 문서 규칙 검증 — 순번 조각은 필수, 서식은 품명 · 수량 필수 */
export function validateDocRules(rules: DocRules): Record<string, string> {
  const e: Record<string, string> = {};
  if (rules.codeSegments.length === 0) e.codeSegments = "조각을 하나 이상 두어 주세요";
  else if (!rules.codeSegments.includes("seq")) e.codeSegments = "순번 조각은 꼭 있어야 해요";
  for (const key of ["material", "parts"] as const) {
    const cols = rules.formats[key];
    if (!cols.includes("품명") || !cols.includes("수량")) e[key] = "품명 · 수량 열은 꼭 있어야 해요";
  }
  return e;
}

/* ───────────── 엑셀 업로드 (품목) ───────────── */

export const ITEM_SHEET_COLUMNS = ["품목 코드", "품목명", "사양", "규격", "단위", "분류", "거래처", "보관 위치", "상태"];

export type ImportStatus = "update" | "create" | "error";
export interface ImportRow {
  /** 파일의 행 번호(머리글 1) */
  row: number;
  status: ImportStatus;
  item?: Item;
  reason?: string;
}

/**
 * 엑셀 행 → 갱신 / 신규 / 오류. 첫 행은 머리글(열 이름으로 맞춘다, 순서 무관).
 * 코드 기준 매칭. 갱신에서 빈 칸은 기존 값을 둔다. 거래처는 이름으로 맞추고(공백 · 대소문자 무시, `·` `,` `/` `;` 로 여러 곳)
 * 없으면 오류 — 자동으로 만들지 않는다(엑셀 오타로 거래처가 늘어나는 걸 막는다). 단위는 재고 · 이력이 있으면 바꿀 수 없다.
 */
export function parseItemRows(rows: string[][], state: InventoryState): ImportRow[] {
  const [header = [], ...body] = rows;
  const col = (name: string) => header.findIndex((h) => normalizeName(h) === normalizeName(name));
  const at = (r: string[], name: string) => {
    const k = col(name);
    return k >= 0 ? (r[k] ?? "").trim() : "";
  };
  if (col("품목 코드") < 0 || col("품목명") < 0) {
    return [{ row: 1, status: "error", reason: "머리글에 「품목 코드」 · 「품목명」 열이 있어야 해요" }];
  }
  const seen = new Set<string>();
  const out: ImportRow[] = [];
  body.forEach((r, i) => {
    const row = i + 2;
    if (r.every((c) => !c || !String(c).trim())) return;
    const code = at(r, "품목 코드");
    const name = at(r, "품목명");
    if (!code || !name) return void out.push({ row, status: "error", reason: "품목 코드 · 품목명이 비어 있어요" });
    if (seen.has(code)) return void out.push({ row, status: "error", reason: "파일 안에 같은 코드가 두 번 있어요" });
    seen.add(code);

    const before = state.items.find((it) => it.code === code);
    const vendorNames = at(r, "거래처").split(/[·,/;]/).map((s) => s.trim()).filter(Boolean);
    const vendorIds: string[] = [];
    for (const vn of vendorNames) {
      const v = state.vendors.find((x) => normalizeName(x.name) === normalizeName(vn));
      if (!v) return void out.push({ row, status: "error", reason: `미등록 거래처: ${vn}` });
      vendorIds.push(v.id);
    }
    if (!before && vendorIds.length === 0) return void out.push({ row, status: "error", reason: "거래처가 비어 있어요" });

    const unit = at(r, "단위") || before?.unit || "";
    if (!unit) return void out.push({ row, status: "error", reason: "단위가 비어 있어요" });
    if (before && before.unit !== unit) {
      const u = itemUsage(code, state);
      if (u.stock !== 0 || u.movements > 0) return void out.push({ row, status: "error", reason: "단위를 바꿀 수 없어요 — 재고 · 이력이 있어요" });
    }
    const statusText = at(r, "상태");
    const item: Item = {
      code,
      name,
      spec: at(r, "사양") || before?.spec || "",
      size: at(r, "규격") || before?.size || "",
      unit,
      category: at(r, "분류") || before?.category || "",
      vendorIds: vendorIds.length > 0 ? vendorIds : before?.vendorIds ?? [],
      location: at(r, "보관 위치") || before?.location || "",
      discontinued: statusText ? statusText === "단종" : before?.discontinued ?? false,
    };
    out.push({ row, status: before ? "update" : "create", item });
  });
  return out;
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
    case "deleteItem":
      return {
        ...state,
        items: state.items.filter((i) => i.code !== action.itemCode),
        standards: state.standards.filter((s) => s.itemCode !== action.itemCode),
      };
    case "importItems": {
      const byCode = new Map(action.items.map((i) => [i.code, i]));
      const updated = state.items.map((i) => byCode.get(i.code) ?? i);
      const created = action.items.filter((i) => !state.items.some((x) => x.code === i.code));
      return { ...state, items: [...created, ...updated] };
    }
    case "upsertVendor": {
      const prev = state.vendors.find((v) => v.id === action.vendor.id);
      const vendors = prev ? state.vendors.map((v) => (v.id === action.vendor.id ? action.vendor : v)) : [...state.vendors, action.vendor];
      // 거래 중지 — 이 거래처를 기본으로 쓰던 품목은 다음 거래처가 기본이 된다(거래처가 하나뿐이면 그대로 남는다)
      const deactivated = prev?.active && !action.vendor.active;
      const items = deactivated
        ? state.items.map((i) => (i.vendorIds[0] === action.vendor.id && i.vendorIds.length > 1 ? { ...i, vendorIds: [...i.vendorIds.slice(1), action.vendor.id] } : i))
        : state.items;
      return { ...state, vendors, items };
    }
    case "createVendorInline":
      // 「만들기」로 생긴 거래처 — 리드타임이 비어 거래처 탭에서 채우게 한다
      return {
        ...state,
        vendors: [...state.vendors, { id: nextId("v", state.vendors), name: action.name.trim(), kind: "parts", initial: "", leadTimeDays: null, owner: "", active: true }],
      };
    case "setStandard": {
      // 자동 → 수동으로 바꾸면 지금 보이던 자동값을 담당자 값으로 굳혀 둔다 — 안전 기준이 한꺼번에 「미설정」이 되지 않게
      if (state.standard.method === "leadTimeAvg" && action.standard.method === "manual") {
        const standards = [...state.standards];
        for (const item of state.items) {
          const auto = safetyOf(item, state);
          if (auto === null) continue;
          const k = standards.findIndex((s) => s.itemCode === item.code);
          if (k >= 0) standards[k] = { ...standards[k], safety: auto };
          else standards.push({ itemCode: item.code, baseline: 0, asOf: "", safety: auto });
        }
        return { ...state, standard: action.standard, standards };
      }
      return { ...state, standard: action.standard };
    }
    case "setDocRules":
      return { ...state, docRules: action.rules };
  }
}
