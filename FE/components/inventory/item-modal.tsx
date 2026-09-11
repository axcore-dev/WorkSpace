"use client";

import { useState } from "react";
import { ConfirmModal } from "@/components/management/workbench";
import { Modal } from "@/components/modal";
import { MultiPicker, type PickerOption } from "@/components/multi-picker";
import { Button, FIELD, FIELD_ERROR, Segmented } from "@/components/ui";
import { VENDOR_KIND_LABEL, type Item } from "@/data/inventory";
import { itemInUse, itemUsage, validateItem } from "@/lib/inventory-state";
import { useInventory } from "./inventory-provider";

const UNIT_DEFAULTS = ["EA", "kg", "m", "SET", "L"];
const CATEGORY_DEFAULTS = ["금형 부품", "표준 부품", "소재", "소모품", "가공품"];
const EMPTY: Item = { code: "", name: "", spec: "", size: "", unit: "EA", category: "", vendorIds: [], location: "", discontinued: false };
const LABEL = "mb-1.5 block text-sm font-medium text-slate-700";
const ERR = "mt-1.5 text-xs text-red-600";
const STATUS_OPTIONS = [
  { value: "active", label: "사용" },
  { value: "discontinued", label: "단종" },
] as const;

type Confirm = null | { kind: "discard" } | { kind: "discontinue" | "rename"; count: number; then: () => void };

/** 「만들기」로 만든 거래처는 상태에 생기기 전까지 이름 표식으로 든다 */
const NEW = "new:";
const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];

/**
 * 품목 등록 · 수정 팝업. `item` 이 null 이면 등록(코드 편집 가능), 아니면 수정(코드 읽기 전용).
 * 저장이 되면 스스로 닫히고 토스트를 띄운다. 검증에 걸리면 열린 채 필드 에러. 바꾼 게 있는데 닫으면 한 번 묻는다.
 *
 * 열 때마다 `key` 를 바꿔 새로 마운트한다 — 초기값 · 더티 판정이 단순해진다.
 */
export function ItemModal({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const { state, dispatch, notify } = useInventory();
  const isNew = item === null;
  const [draft, setDraft] = useState<Item>(item ?? EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<Confirm>(null);
  // 마운트 시점 스냅샷 — 더티 판정용. 열 때마다 key 로 새로 마운트하므로 한 번만 잡는다
  const [initial] = useState(() => JSON.stringify(item ?? EMPTY));
  const dirty = JSON.stringify(draft) !== initial;

  const usage = item ? itemUsage(item.code, state) : null;
  const canDelete = !!item && usage !== null && !itemInUse(usage);

  // 표식 → 실제 id (상태에 생겼으면). 아직이면 표식 그대로 두고 「만드는 중」 으로 보인다
  const resolve = (key: string) => (key.startsWith(NEW) ? state.vendors.find((v) => v.name === key.slice(NEW.length))?.id ?? key : key);
  const vendorKeys = draft.vendorIds.map(resolve);
  const vendorOptions: PickerOption[] = [
    ...state.vendors.map((v) => ({
      id: v.id,
      label: v.name,
      meta: `${VENDOR_KIND_LABEL[v.kind]}${v.kind === "inhouse" ? "" : v.leadTimeDays === null ? " · 리드타임 없음" : ` · 리드타임 ${v.leadTimeDays}일`}`,
      disabled: !v.active,
    })),
    ...vendorKeys.filter((k) => k.startsWith(NEW)).map((k) => ({ id: k, label: k.slice(NEW.length), meta: "만드는 중" })),
  ];

  const units = uniq([...UNIT_DEFAULTS, ...state.items.map((i) => i.unit), draft.unit]);
  const categories = uniq([...CATEGORY_DEFAULTS, ...state.items.map((i) => i.category), draft.category]);

  const set = (patch: Partial<Item>) => setDraft((d) => ({ ...d, ...patch }));

  function createVendor(name: string) {
    void dispatch({ type: "createVendorInline", name });
    set({ vendorIds: [...vendorKeys, `${NEW}${name}`] });
  }

  function close() {
    if (dirty) setConfirm({ kind: "discard" });
    else onClose();
  }

  function save() {
    const cleaned: Item = {
      ...draft,
      code: draft.code.trim(),
      name: draft.name.trim(),
      spec: draft.spec.trim(),
      size: draft.size.trim(),
      category: draft.category.trim(),
      location: draft.location.trim(),
      vendorIds: vendorKeys,
    };
    const e = validateItem(cleaned, state, isNew);
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    const commit = async () => {
      const ok = await dispatch({ type: "upsertItem", item: cleaned });
      if (!ok) return;
      notify("저장했어요");
      onClose();
    };
    // 확인이 필요한 변경을 차례로 묻고 마지막에 저장한다
    const asks: ((next: () => void) => void)[] = [];
    if (item && usage && !item.discontinued && cleaned.discontinued && usage.stock > 0) {
      asks.push((next) => setConfirm({ kind: "discontinue", count: usage.stock, then: next }));
    }
    if (item && usage && usage.openOrders > 0 && (item.name !== cleaned.name || item.spec !== cleaned.spec || item.size !== cleaned.size)) {
      asks.push((next) => setConfirm({ kind: "rename", count: usage.openOrders, then: next }));
    }
    const run = (i: number) => {
      if (i < asks.length) asks[i](() => run(i + 1));
      else void commit();
    };
    run(0);
  }

  function remove() {
    if (!item) return;
    void dispatch({ type: "deleteItem", itemCode: item.code }).then((ok) => {
      if (!ok) return;
      notify("삭제했어요");
      onClose();
    });
  }

  return (
    <>
      <Modal
        open
        onClose={close}
        size="lg"
        title={isNew ? "품목 등록" : "품목 수정"}
        footer={
          <div className="flex items-center justify-between gap-3">
            <div>
              {canDelete && (
                <Button variant="danger" onClick={remove}>
                  삭제
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={close}>
                닫기
              </Button>
              {/* 바꾼 게 없으면 누를 수 없다 — 수정됐는지 아닌지가 버튼 상태로 보인다 */}
              <Button onClick={save} disabled={!dirty}>
                저장
              </Button>
            </div>
          </div>
        }
      >
        <form
          noValidate
          className="grid gap-4 p-5 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div>
            <label htmlFor="item-code" className={LABEL}>
              품목 코드
            </label>
            <input
              id="item-code"
              value={draft.code}
              readOnly={!isNew}
              aria-invalid={!!errors.code}
              onChange={(e) => set({ code: e.target.value })}
              className={`${errors.code ? FIELD_ERROR : FIELD} ${isNew ? "" : "bg-slate-50 text-slate-500"}`}
            />
            {errors.code && <p className={ERR}>{errors.code}</p>}
          </div>
          <div>
            <label htmlFor="item-name" className={LABEL}>
              품목명
            </label>
            <input id="item-name" value={draft.name} aria-invalid={!!errors.name} onChange={(e) => set({ name: e.target.value })} className={errors.name ? FIELD_ERROR : FIELD} />
            {errors.name && <p className={ERR}>{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="item-spec" className={LABEL}>
              사양
            </label>
            <input id="item-spec" value={draft.spec} onChange={(e) => set({ spec: e.target.value })} className={FIELD} />
          </div>
          <div>
            <label htmlFor="item-size" className={LABEL}>
              규격
            </label>
            <input id="item-size" value={draft.size} onChange={(e) => set({ size: e.target.value })} className={FIELD} />
          </div>
          <div>
            <label htmlFor="item-unit" className={LABEL}>
              단위
            </label>
            <select id="item-unit" value={draft.unit} aria-invalid={!!errors.unit} onChange={(e) => set({ unit: e.target.value })} className={errors.unit ? FIELD_ERROR : FIELD}>
              {units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            {errors.unit && <p className={ERR}>{errors.unit}</p>}
          </div>
          <div>
            <label htmlFor="item-category" className={LABEL}>
              분류
            </label>
            <select id="item-category" value={draft.category} onChange={(e) => set({ category: e.target.value })} className={FIELD}>
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="item-vendors" className={LABEL}>
              거래처
            </label>
            <MultiPicker
              id="item-vendors"
              label="거래처"
              options={vendorOptions}
              value={vendorKeys}
              onChange={(ids) => set({ vendorIds: ids })}
              onCreate={createVendor}
              placeholder="거래처 이름을 입력해 고르거나 만들어요"
              invalid={!!errors.vendorIds}
            />
            {errors.vendorIds && <p className={ERR}>{errors.vendorIds}</p>}
          </div>
          <div>
            <label htmlFor="item-location" className={LABEL}>
              보관 위치
            </label>
            <input id="item-location" value={draft.location} onChange={(e) => set({ location: e.target.value })} className={FIELD} />
          </div>
          <div>
            <span className={LABEL}>상태</span>
            <Segmented
              options={[...STATUS_OPTIONS]}
              value={draft.discontinued ? "discontinued" : "active"}
              onChange={(v) => set({ discontinued: v === "discontinued" })}
              label="품목 상태"
            />
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={confirm?.kind === "discard"}
        title="변경 사항을 저장하지 않고 닫으시겠습니까?"
        message="저장하지 않은 값은 사라집니다."
        cancel="계속 편집"
        cta="저장하지 않고 닫기"
        variant="danger"
        icon="warn"
        onConfirm={() => {
          setConfirm(null);
          onClose();
        }}
        onClose={() => setConfirm(null)}
      />
      <ConfirmModal
        open={confirm?.kind === "discontinue"}
        title={confirm?.kind === "discontinue" ? `재고 ${confirm.count} ${draft.unit}가 남아 있습니다. 단종하시겠습니까?` : ""}
        message="신규 발주에서 사라지고, 진행 중 발주 · 재고 · 이력은 그대로 남습니다."
        cancel="유지"
        cta="단종"
        variant="primary"
        icon="warn"
        onConfirm={() => {
          const then = confirm?.kind === "discontinue" ? confirm.then : null;
          setConfirm(null);
          then?.();
        }}
        onClose={() => setConfirm(null)}
      />
      <ConfirmModal
        open={confirm?.kind === "rename"}
        title={confirm?.kind === "rename" ? `진행 중 발주 ${confirm.count}건은 예전 표기로 남습니다. 저장하시겠습니까?` : ""}
        message="발주서와 발주 라인은 발주 시점 표기 그대로이고, 재고 · 이력은 새 표기로 보입니다."
        cancel="돌아가기"
        cta="저장"
        variant="primary"
        icon="check"
        onConfirm={() => {
          const then = confirm?.kind === "rename" ? confirm.then : null;
          setConfirm(null);
          then?.();
        }}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}
