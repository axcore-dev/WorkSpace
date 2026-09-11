"use client";

import { useState } from "react";
import { IconAlertTriangle, IconDownload, IconPlus, IconX } from "@/components/icons";
import { ConfirmModal } from "@/components/management/workbench";
import { Modal } from "@/components/modal";
import { MultiPicker, type PickerOption } from "@/components/multi-picker";
import { Button, FIELD_SM, FIELD_SM_ERROR, Segmented } from "@/components/ui";
import { VENDOR_KIND_LABEL } from "@/data/inventory";
import { PO_BOM, PO_DRAWINGS } from "@/data/purchasing";
import { useAccountMe } from "@/lib/account-me";
import { downloadCsv } from "@/lib/download";
import {
  blankLine,
  buildOrders,
  draftFromBom,
  groupDraft,
  orderDocuments,
  validateDraft,
  type DocFormat,
  type DraftLine,
  type OrderDraft,
} from "@/lib/inventory-state";
import { useInventory } from "./inventory-provider";

const FORMAT_OPTIONS: { value: DocFormat; label: string }[] = [
  { value: "material", label: "자재" },
  { value: "parts", label: "부품" },
];
/** 표의 열 → 문서 서식의 열 이름(없으면 문서와 무관한 화면 전용 열) */
const TABLE_COLUMNS: { label: string; doc?: string; align?: "right" }[] = [
  { label: "품명", doc: "품명" },
  { label: "호칭", doc: "호칭" },
  { label: "규격", doc: "규격" },
  { label: "수량", doc: "수량", align: "right" },
  { label: "단위", doc: "단위" },
  { label: "발주처" },
  { label: "가공 요청" },
  { label: "비고", doc: "비고" },
];
const LABEL = "mb-1 block text-xs font-medium text-slate-600";

/**
 * 발주서 작성 — 한 화면 편집기(260827 피드백 3건: 모든 칸 편집 · 발주처 클릭 선택 · 서식 2종 + 가공 요청 태그 · 전체 1장 + 발주처별 출력).
 *
 * 도면(BOM)을 고르면 소요 − 재고로 라인이 채워지고, 도면 없이도 라인을 더해 쓸 수 있다.
 * 수량 0 라인은 화면에 내림으로 남고 문서 · 등록에서 빠진다. 서식(자재/부품)에 없는 열은 머리글에 줄을 그어 「문서에 안 찍힘」을 보인다.
 * 자체 제작 발주처 라인은 문서 없이 제작 지시(발주 목록 「제작 중」)가 된다. 초안은 로컬 상태 — 바꾼 채 닫으면 한 번 묻는다.
 */
export function OrderEditor({ initialDrawing, onClose }: { initialDrawing?: string; onClose: () => void }) {
  const { state, dispatch, notify } = useInventory();
  const { me: account } = useAccountMe();

  const [draft, setDraft] = useState<OrderDraft>(() => {
    const d = PO_DRAWINGS.find((x) => x.code === initialDrawing) ?? null;
    return draftFromBom(d, d ? PO_BOM[d.code] ?? [] : [], state.vendors, state.items, { requester: account?.name ?? "", orderedOn: state.today });
  });
  const [initial] = useState(() => JSON.stringify(draft));
  const dirty = JSON.stringify(draft) !== initial;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [seq, setSeq] = useState(0);

  const drawing = PO_DRAWINGS.find((x) => x.code === draft.drawing);
  const docCols = state.docRules.formats[draft.format];
  const inDoc = (col?: string) => !col || docCols.includes(col);
  const vendorOptions: PickerOption[] = state.vendors.filter((v) => v.active).map((v) => ({ id: v.id, label: v.name, meta: VENDOR_KIND_LABEL[v.kind] }));
  const tagOptions: PickerOption[] = state.docRules.processTags.map((t) => ({ id: t, label: t }));
  const vendorOf = (id: string) => state.vendors.find((v) => v.id === id);

  const groups = groupDraft(draft);
  const docs = orderDocuments(draft, state.vendors, state.docRules);
  const inhouse = groups.filter((g) => vendorOf(g.vendorId)?.kind === "inhouse");
  const activeCount = draft.lines.filter((l) => l.qty > 0).length;

  const set = (patch: Partial<OrderDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const setLine = (id: string, patch: Partial<DraftLine>) => setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  const removeLine = (id: string) => setDraft((d) => ({ ...d, lines: d.lines.filter((l) => l.id !== id) }));
  function addLine() {
    const n = seq + 1;
    setSeq(n);
    setDraft((d) => ({ ...d, lines: [...d.lines, blankLine(`new-${n}`)] }));
  }
  function pickDrawing(code: string) {
    const d = PO_DRAWINGS.find((x) => x.code === code) ?? null;
    setDraft((cur) => draftFromBom(d, d ? PO_BOM[d.code] ?? [] : [], state.vendors, state.items, { requester: cur.requester, orderedOn: cur.orderedOn, format: cur.format }));
    setErrors({});
  }

  function close() {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }

  function print() {
    const code = draft.projectCode.trim().replace(/\s+/g, "") || "발주";
    for (const doc of docs) downloadCsv(`발주서_${code}_${doc.label}.csv`, doc.rows);
    notify(`문서 ${docs.length}장을 내보냈어요`);
  }

  function register() {
    const e = validateDraft(draft, PO_DRAWINGS);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    const orders = buildOrders(draft, state.items, state.orders.length);
    void dispatch({ type: "createOrders", orders }).then((ok) => {
      if (!ok) return;
      const docsCount = orders.length - inhouse.length;
      notify([docsCount > 0 ? `발주 ${docsCount}건을 등록했어요` : "", inhouse.length > 0 ? `제작 지시 ${inhouse.length}건` : ""].filter(Boolean).join(" · "));
      onClose();
    });
  }

  return (
    <>
      <Modal
        open
        onClose={close}
        size="xl"
        title="발주서 작성"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" onClick={close}>
              닫기
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={activeCount === 0} onClick={print}>
                <IconDownload size={14} />
                출력 · {docs.length}장
              </Button>
              <Button onClick={register}>발주 등록</Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 p-5">
          {/* 근거 · 메타 — 모든 칸 편집 */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <label htmlFor="oe-drawing" className={LABEL}>
                도면(BOM)
              </label>
              <select id="oe-drawing" value={draft.drawing} onChange={(e) => pickDrawing(e.target.value)} className={FIELD_SM}>
                <option value="">도면 없이 작성</option>
                {PO_DRAWINGS.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.code} {d.rev} · {d.name}
                    {d.unmapped > 0 ? ` · 미매핑 ${d.unmapped}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="oe-project" className={LABEL}>
                관리번호
              </label>
              <input id="oe-project" value={draft.projectCode} aria-invalid={!!errors.projectCode} onChange={(e) => set({ projectCode: e.target.value })} className={errors.projectCode ? FIELD_SM_ERROR : FIELD_SM} />
              {errors.projectCode && <p className="mt-1 text-xs text-red-600">{errors.projectCode}</p>}
            </div>
            <div>
              <label htmlFor="oe-date" className={LABEL}>
                발주일
              </label>
              <input id="oe-date" type="date" value={draft.orderedOn} onChange={(e) => set({ orderedOn: e.target.value })} className={FIELD_SM} />
            </div>
            <div>
              <label htmlFor="oe-requester" className={LABEL}>
                요청자
              </label>
              <input id="oe-requester" value={draft.requester} onChange={(e) => set({ requester: e.target.value })} className={FIELD_SM} />
            </div>
          </div>

          {errors.unmapped && (
            <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
              <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
              {errors.unmapped}
            </p>
          )}

          {/* 라인 — 서식에 없는 열은 머리글에 줄을 긋는다 */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {drawing ? `${drawing.name} · ${drawing.vehicle}` : "라인을 직접 채워요"}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">서식</span>
              <Segmented options={FORMAT_OPTIONS} value={draft.format} onChange={(v) => set({ format: v })} label="발주서 서식" />
            </div>
          </div>

          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  {TABLE_COLUMNS.map((c) => (
                    <th
                      key={c.label}
                      scope="col"
                      title={inDoc(c.doc) ? undefined : "이 서식의 문서에는 안 찍혀요"}
                      className={`px-2 py-2 ${c.align === "right" ? "text-right" : ""} ${inDoc(c.doc) ? "" : "line-through decoration-slate-300"}`}
                    >
                      {c.label}
                    </th>
                  ))}
                  <th scope="col" className="w-8 px-1 py-2">
                    <span className="sr-only">빼기</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {draft.lines.map((l) => {
                  const off = l.qty <= 0;
                  return (
                    <tr key={l.id} className={off ? "opacity-60" : ""}>
                      <td className="px-2 py-1.5">
                        <input aria-label="품명" value={l.itemName} onChange={(e) => setLine(l.id, { itemName: e.target.value })} className={`${FIELD_SM} min-w-[160px]`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input aria-label="호칭" value={l.spec} onChange={(e) => setLine(l.id, { spec: e.target.value })} className={`${FIELD_SM} w-24`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input aria-label="규격" value={l.size} onChange={(e) => setLine(l.id, { size: e.target.value })} className={`${FIELD_SM} w-28`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          aria-label={`${l.itemName || "라인"} 수량`}
                          value={l.qty}
                          onChange={(e) => setLine(l.id, { qty: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })}
                          className={`${FIELD_SM} w-20 text-right`}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input aria-label="단위" value={l.unit} onChange={(e) => setLine(l.id, { unit: e.target.value })} className={`${FIELD_SM} w-16`} />
                      </td>
                      <td className="min-w-[180px] px-2 py-1.5">
                        <MultiPicker
                          label={`${l.itemName || "라인"} 발주처`}
                          options={vendorOptions}
                          value={l.vendorId ? [l.vendorId] : []}
                          onChange={(ids) => setLine(l.id, { vendorId: ids[0] ?? "" })}
                          single
                          placeholder="발주처"
                          invalid={!!errors.vendor && l.qty > 0 && !l.vendorId}
                        />
                      </td>
                      <td className="min-w-[180px] px-2 py-1.5">
                        <MultiPicker label={`${l.itemName || "라인"} 가공 요청`} options={tagOptions} value={l.tags} onChange={(tags) => setLine(l.id, { tags })} firstTag={null} placeholder="태그" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input aria-label="비고" value={l.note} onChange={(e) => setLine(l.id, { note: e.target.value })} className={`${FIELD_SM} min-w-[140px]`} />
                      </td>
                      <td className="px-1 py-1.5">
                        <button
                          type="button"
                          aria-label={`${l.itemName || "라인"} 빼기`}
                          onClick={() => removeLine(l.id)}
                          className="cursor-pointer rounded p-1 text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900"
                        >
                          <IconX size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button size="sm" variant="secondary" onClick={addLine}>
              <IconPlus size={14} />
              라인 추가
            </Button>
            {(errors.lines || errors.vendor) && (
              <p className="text-xs text-red-600" role="alert">
                {[errors.lines, errors.vendor].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>

          {/* 문서 — 무엇이 몇 장 나가는지. 값이 곧 설명이다 */}
          <p className="border-t border-slate-200 pt-3 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">문서 {docs.length}장</span>
            <span className="text-slate-500"> · 전체 1장</span>
            {groups.map((g) => {
              const v = vendorOf(g.vendorId);
              const qty = g.lines.reduce((s, l) => s + l.qty, 0);
              const label = v?.name ?? "발주처 없음";
              return (
                <span key={g.vendorId || "none"}>
                  {" · "}
                  {v?.kind === "inhouse" ? (
                    <span className="text-slate-500">
                      {label} {g.lines.length}라인 — 제작 지시(문서 없음)
                    </span>
                  ) : (
                    <>
                      {label} {g.lines.length}라인 {qty} EA
                    </>
                  )}
                </span>
              );
            })}
          </p>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmDiscard}
        title="작성 중인 발주서를 버릴까요?"
        message="저장하지 않은 라인과 수량이 사라져요."
        cta="버리기"
        variant="danger"
        icon="warn"
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        onClose={() => setConfirmDiscard(false)}
      />
    </>
  );
}
