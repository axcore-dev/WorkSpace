import { apiGet, apiPostAuthed, apiPut } from "@/lib/api";
import type { DocRules, Item, Movement, PurchaseOrder, SafetyStandard, ItemStandard, Vendor } from "@/data/inventory";
import type { InventoryAction, InventoryData } from "@/lib/inventory-state";

/**
 * 재고·물류 API. 회사를 고른 토큰이어야 하고, 탭 권한이 없거나 회사가 탭을 끄면 403 이 온다.
 *
 * **BE 가 아직 없다.** 경로는 경영지원(`/api/workspace/management/*`)과 같은 자리에 둔다.
 * 개발 중 첫 GET 이 404 · 네트워크 오류면 `components/inventory/inventory-provider.tsx` 가 데모로 폴백한다.
 */
const BASE = "/api/workspace/inventory";
const must = <T,>(v: T | null) => v as T;
const seg = encodeURIComponent;

interface SettingsDto {
  standards: ItemStandard[];
  standard: SafetyStandard;
  docRules: DocRules;
}

export async function getAll(): Promise<InventoryData> {
  const [orders, movements, items, vendors, settings] = await Promise.all([
    apiGet<PurchaseOrder[]>(`${BASE}/orders`),
    apiGet<Movement[]>(`${BASE}/movements`),
    apiGet<Item[]>(`${BASE}/items`),
    apiGet<Vendor[]>(`${BASE}/vendors`),
    apiGet<SettingsDto>(`${BASE}/settings`),
  ]);
  const s = must(settings);
  return { orders: orders ?? [], movements: movements ?? [], items: items ?? [], vendors: vendors ?? [], standards: s.standards, standard: s.standard, docRules: s.docRules };
}

/** 동작 하나를 서버에 보낸다. 성공 뒤 호출한 쪽이 `getAll` 로 다시 받는다 — 낙관적 갱신 없음 */
export async function send(action: InventoryAction): Promise<void> {
  switch (action.type) {
    case "receive":
      // 이번 입고를 증분으로 보낸다 — 두 사람이 같은 발주를 등록해도 최종값이 덮어쓰지 않게
      await apiPostAuthed(`${BASE}/orders/${seg(action.poNo)}/receipts`, { lines: action.lines, complete: action.complete });
      return;
    case "adjust":
      await apiPostAuthed(`${BASE}/adjustments`, { itemCode: action.itemCode, qty: action.qty, note: action.note });
      return;
    case "setBaseline":
      await apiPut(`${BASE}/items/${seg(action.itemCode)}/standard`, { baseline: action.baseline, asOf: action.asOf, safety: action.safety });
      return;
    case "upsertItem":
      await apiPut(`${BASE}/items/${seg(action.item.code)}`, action.item);
      return;
    case "discontinueItem":
      await apiPut(`${BASE}/items/${seg(action.itemCode)}/discontinued`, { discontinued: action.discontinued });
      return;
    case "upsertVendor":
      await apiPut(`${BASE}/vendors/${seg(action.vendor.id)}`, action.vendor);
      return;
    case "createVendorInline":
      await apiPostAuthed(`${BASE}/vendors`, { name: action.name });
      return;
    case "setStandard":
      await apiPut(`${BASE}/settings/standard`, action.standard);
      return;
    case "setDocRules":
      await apiPut(`${BASE}/settings/doc-rules`, action.rules);
      return;
  }
}
