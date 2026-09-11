"use client";

import { useState } from "react";
import { ConfirmModal } from "@/components/management/workbench";
import { Modal } from "@/components/modal";
import { Button, FIELD, FIELD_ERROR, Segmented } from "@/components/ui";
import { VENDOR_KIND_LABEL, type Vendor, type VendorKind } from "@/data/inventory";
import { useAccountMe } from "@/lib/account-me";
import { defaultVendorItems, validateVendor } from "@/lib/inventory-state";
import { useInventory } from "./inventory-provider";

const LABEL = "mb-1.5 block text-sm font-medium text-slate-700";
const ERR = "mt-1.5 text-xs text-red-600";
const KINDS = Object.keys(VENDOR_KIND_LABEL) as VendorKind[];
const STATUS_OPTIONS = [
  { value: "active", label: "거래 중" },
  { value: "inactive", label: "거래 중지" },
] as const;

interface Draft {
  name: string;
  kind: VendorKind;
  initial: string;
  lead: string;
  owner: string;
  active: boolean;
}
const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];
const toDraft = (v: Vendor | null): Draft =>
  v
    ? { name: v.name, kind: v.kind, initial: v.initial, lead: v.leadTimeDays === null ? "" : String(v.leadTimeDays), owner: v.owner, active: v.active }
    : { name: "", kind: "parts", initial: "", lead: "", owner: "", active: true };

type Confirm = null | { kind: "discard" } | { kind: "deactivate"; count: number; then: () => void };

/**
 * 거래처 등록 · 수정 팝업. 자체 제작(inhouse)은 하나만, 중지 불가, 이니셜 · 리드타임 없음.
 * 이니셜이 겹치면 저장은 되지만 알려 준다(관리번호가 겹칠 수 있어서). 거래 중지는 기본 거래처로 쓰는 품목이 있으면 한 번 묻는다.
 */
export function VendorModal({ vendor, onClose }: { vendor: Vendor | null; onClose: () => void }) {
  const { state, dispatch, notify } = useInventory();
  const { me: account } = useAccountMe();
  const isNew = vendor === null;
  const [draft, setDraft] = useState<Draft>(toDraft(vendor));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<Confirm>(null);
  // 마운트 시점 스냅샷 — 더티 판정용. 열 때마다 key 로 새로 마운트하므로 한 번만 잡는다
  const [initial] = useState(() => JSON.stringify(toDraft(vendor)));
  const dirty = JSON.stringify(draft) !== initial;

  const inhouseTaken = state.vendors.some((v) => v.kind === "inhouse" && v.id !== vendor?.id);
  const inhouse = draft.kind === "inhouse";
  const owners = uniq([...state.vendors.map((v) => v.owner), account?.name ?? "", draft.owner]);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  /** 저장할 모양. 새 거래처의 id 는 저장하는 순간(이벤트 안)에만 만든다 — 렌더는 순수하게 */
  function build(id: string): Vendor {
    const lead = draft.lead.trim() === "" ? null : Number(draft.lead);
    return {
      id,
      name: draft.name.trim(),
      kind: draft.kind,
      initial: inhouse ? "" : draft.initial.trim().toUpperCase(),
      leadTimeDays: inhouse ? null : lead,
      owner: draft.owner.trim(),
      active: inhouse ? true : draft.active,
    };
  }
  const { warnings } = validateVendor(build(vendor?.id ?? ""), state, isNew);

  function close() {
    if (dirty) setConfirm({ kind: "discard" });
    else onClose();
  }

  function save() {
    const next = build(vendor?.id ?? `v-${Date.now().toString(36)}`);
    const { errors: e } = validateVendor(next, state, isNew);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    const commit = async () => {
      const ok = await dispatch({ type: "upsertVendor", vendor: next });
      if (!ok) return;
      notify("저장했어요");
      onClose();
    };
    const affected = vendor && vendor.active && !next.active ? defaultVendorItems(vendor.id, state.items).length : 0;
    if (affected > 0) setConfirm({ kind: "deactivate", count: affected, then: () => void commit() });
    else void commit();
  }

  return (
    <>
      <Modal
        open
        onClose={close}
        size="md"
        title={isNew ? "거래처 등록" : "거래처 수정"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              닫기
            </Button>
            {/* 바꾼 게 없으면 누를 수 없다 — 수정됐는지 아닌지가 버튼 상태로 보인다 */}
            <Button onClick={save} disabled={!dirty}>
              저장
            </Button>
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
            <label htmlFor="vendor-name" className={LABEL}>
              거래처명
            </label>
            <input id="vendor-name" value={draft.name} aria-invalid={!!errors.name} onChange={(e) => set({ name: e.target.value })} className={errors.name ? FIELD_ERROR : FIELD} />
            {errors.name && <p className={ERR}>{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="vendor-kind" className={LABEL}>
              구분
            </label>
            <select id="vendor-kind" value={draft.kind} aria-invalid={!!errors.kind} onChange={(e) => set({ kind: e.target.value as VendorKind })} className={errors.kind ? FIELD_ERROR : FIELD}>
              {KINDS.map((k) => (
                <option key={k} value={k} disabled={k === "inhouse" && inhouseTaken}>
                  {VENDOR_KIND_LABEL[k]}
                  {k === "inhouse" && inhouseTaken ? " (이미 있음)" : ""}
                </option>
              ))}
            </select>
            {errors.kind && <p className={ERR}>{errors.kind}</p>}
          </div>
          <div>
            <label htmlFor="vendor-initial" className={LABEL}>
              이니셜
            </label>
            <input
              id="vendor-initial"
              value={inhouse ? "" : draft.initial}
              disabled={inhouse}
              placeholder={inhouse ? "—" : ""}
              onChange={(e) => set({ initial: e.target.value.toUpperCase() })}
              className={`${FIELD} uppercase disabled:bg-slate-50 disabled:text-slate-500`}
            />
            {warnings.initial && !inhouse && <p className="mt-1.5 text-xs text-amber-700">{warnings.initial}</p>}
          </div>
          <div>
            <label htmlFor="vendor-lead" className={LABEL}>
              리드타임
            </label>
            <div className="relative">
            <input
              id="vendor-lead"
              type="number"
              inputMode="numeric"
              min={0}
              value={inhouse ? "" : draft.lead}
              disabled={inhouse}
              placeholder={inhouse ? "—" : ""}
              aria-invalid={!!errors.leadTimeDays}
              onChange={(e) => set({ lead: e.target.value })}
              className={`${errors.leadTimeDays ? FIELD_ERROR : FIELD} pr-10 disabled:bg-slate-50 disabled:text-slate-500`}
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-500">일</span>
            </div>
            {errors.leadTimeDays && <p className={ERR}>{errors.leadTimeDays}</p>}
          </div>
          <div>
            <label htmlFor="vendor-owner" className={LABEL}>
              담당자
            </label>
            <select id="vendor-owner" value={draft.owner} onChange={(e) => set({ owner: e.target.value })} className={FIELD}>
              <option value="">—</option>
              {owners.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className={LABEL}>상태</span>
            <Segmented
              options={[...STATUS_OPTIONS]}
              value={draft.active || inhouse ? "active" : "inactive"}
              onChange={(v) => set({ active: v === "active" })}
              label="거래 상태"
              disabled={inhouse}
            />
            {errors.active && <p className={ERR}>{errors.active}</p>}
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
        open={confirm?.kind === "deactivate"}
        title={confirm?.kind === "deactivate" ? `품목 ${confirm.count}개의 기본 거래처입니다. 거래를 중지하시겠습니까?` : ""}
        message="중지하면 그 품목은 다음 거래처가 기본이 됩니다. 진행 중 발주는 그대로 유지됩니다."
        cancel="유지"
        cta="거래 중지"
        variant="danger"
        icon="warn"
        onConfirm={() => {
          const then = confirm?.kind === "deactivate" ? confirm.then : null;
          setConfirm(null);
          then?.();
        }}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}
