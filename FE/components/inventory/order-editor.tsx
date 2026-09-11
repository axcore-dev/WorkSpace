"use client";

import { useState } from "react";
import { IconAlertTriangle, IconDownload, IconPlus, IconX } from "@/components/icons";
import { ConfirmModal } from "@/components/management/workbench";
import { Modal } from "@/components/modal";
import { MultiPicker, type PickerOption } from "@/components/multi-picker";
import { Button, FIELD_SM, FIELD_SM_ERROR, Segmented } from "@/components/ui";
import { VENDOR_KIND_LABEL } from "@/data/inventory";
import { withJosa } from "@/data/ko";
import { PO_BOM, PO_DRAWINGS } from "@/data/purchasing";
import { useAccountMe } from "@/lib/account-me";
import { downloadCsv } from "@/lib/download";
import {
  blankLine,
  buildOrders,
  draftFromBom,
  findItemFor,
  groupDraft,
  orderDocuments,
  validateDraft,
  type DocFormat,
  type DraftLine,
  type OrderDraft,
} from "@/lib/inventory-state";
import { useInventory } from "./inventory-provider";

/** 문서 규칙 탭의 이름과 같게 — 「자재 / 부품」만 쓰면 무엇의 자재·부품인지 읽히지 않는다 */
const FORMAT_OPTIONS: { value: DocFormat; label: string }[] = [
  { value: "material", label: "자재 발주서" },
  { value: "parts", label: "부품 발주서" },
];
/** 라인의 열 → 문서 서식의 열 이름(없으면 문서와 무관한 화면 전용 열) */
const LINE_COLUMNS: { label: string; doc?: string; align?: "right" }[] = [
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
/** 라인 안 작은 라벨 — xl 이상에서는 머리글 행이 대신한다 */
const CELL_LABEL = "mb-1 block text-[11px] text-slate-500 xl:hidden";
/**
 * 라인 격자 — 폭에 따라 세 모양. xl(1280) 이상 한 줄 9열(마지막이 빼기), md 두 줄 6열, 그 아래 두 열.
 * 표에 `min-w-[1080px]` 를 걸면 팝업 폭보다 넓어 라인 0개에도 가로 스크롤이 생겼다 — 격자는 폭에 맞춰 줄을 바꾼다.
 * xl 아래에서 빼기 열을 두지 않는 이유: 자동 배치가 빈 32px 열에 수량 칸을 밀어 넣는다. 거기서는 빼기가 품명 칸 옆에 붙는다.
 */
const LINE_GRID =
  "grid gap-x-3 gap-y-2 grid-cols-2 md:grid-cols-6 xl:grid-cols-[minmax(0,2.2fr)_88px_104px_84px_72px_minmax(0,1.6fr)_minmax(0,1.6fr)_minmax(0,1.3fr)_32px] xl:items-center";
const REMOVE_BTN = "cursor-pointer rounded p-1.5 text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900";
/** 수량 칸 — 스피너를 감춘다. 표 안에서 스피너가 숫자를 가리고 손가락 타깃과 겹친다 */
const NUM = "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

/**
 * 발주서 작성 — 전폭 시트(`Modal size="screen"`) 한 화면 편집기(260827 피드백 3건: 모든 칸 편집 · 발주처 클릭 선택 · 서식 2종 + 가공 요청 태그 · 전체 1장 + 발주처별 출력).
 *
 * 도면(BOM)을 고르면 소요 − 재고로 라인이 채워지고, 도면 없이도 라인을 더해 쓸 수 있다. 품명(또는 호칭+규격)을 적고 칸을 나가면
 * 품목 마스터에서 찾아 단위 · 기본 거래처를 채운다. 수량 0 라인은 화면에 내림으로 남고 문서 · 등록에서 빠진다.
 * 서식에 없는 열은 「문서에 안 찍히는 열」 한 줄로 말한다(머리글 취소선은 뜻이 안 읽혔다).
 * 자체 제작 발주처 라인은 문서 없이 제작 지시(발주 목록 「제작 중」)가 된다. 초안은 로컬 상태 — 바꾼 채 닫으면 한 번 묻는다.
 * 닫기는 헤더의 × 하나다 — 푸터에도 [닫기] 를 두면 확인 다이얼로그까지 「닫기」가 넷이 된다.
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
  const excluded = LINE_COLUMNS.filter((c) => c.doc && !docCols.includes(c.doc)).map((c) => c.label);
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
  /** 품명 · 호칭 · 규격 칸을 나갈 때 — 품목 마스터에 있으면 단위와 기본 거래처를 채운다(사람이 이미 고른 값은 두고) */
  function autofill(id: string) {
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((l) => {
        if (l.id !== id || (!l.itemName.trim() && !(l.spec.trim() && l.size.trim()))) return l;
        const item = findItemFor(state.items, l);
        if (!item) return l;
        const vendor = l.vendorId || item.vendorIds.find((v) => vendorOf(v)?.active) || "";
        return l.vendorId === vendor && l.unit === item.unit ? l : { ...l, vendorId: vendor, unit: item.unit };
      }),
    }));
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

  const addButton = (
    <Button size="sm" variant="secondary" onClick={addLine}>
      <IconPlus size={14} />
      라인 추가
    </Button>
  );

  return (
    <>
      <Modal
        open
        onClose={close}
        size="screen"
        title="발주서 작성"
        desc={drawing ? `${drawing.code} ${drawing.rev} · ${drawing.name} · ${drawing.vehicle}` : undefined}
        footer={
          <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-end gap-2 lg:px-3">
            <Button variant="secondary" disabled={activeCount === 0} onClick={print}>
              <IconDownload size={14} />
              출력 · {docs.length}장
            </Button>
            <Button disabled={activeCount === 0} onClick={register}>
              발주 등록
            </Button>
          </div>
        }
      >
        {/* 폭 상한은 이 블록이 직접 진다 — 2560 화면에서 입력 칸이 끝없이 늘어나지 않게 */}
        <div className="mx-auto w-full max-w-[1400px] space-y-5 px-5 py-5 lg:px-8">
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

          {/* 라인 머리 — 왼쪽 개수, 오른쪽 문서 서식과 그 서식에 안 찍히는 열 */}
          <div className="flex flex-wrap items-start justify-between gap-3 border-t border-slate-200 pt-4">
            <p className="text-sm text-slate-600">
              라인 <span className="font-semibold text-slate-900">{draft.lines.length}</span>
              {activeCount !== draft.lines.length && <span className="text-slate-500"> · 수량 있는 라인 {activeCount}</span>}
            </p>
            <div className="text-right">
              <div className="flex items-center justify-end gap-2">
                <span className="text-xs text-slate-500">문서 서식</span>
                <Segmented options={FORMAT_OPTIONS} value={draft.format} onChange={(v) => set({ format: v })} label="문서 서식" />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                {excluded.length > 0 ? `${withJosa(excluded.join(" · "), "은/는")} 이 서식의 문서에 안 찍혀요.` : "라인의 모든 열이 문서에 찍혀요."}
                {" "}발주처 · 가공 요청은 화면 전용이에요.
              </p>
            </div>
          </div>

          {draft.lines.length === 0 ? (
            /* 빈 상태 — 다음 행동 둘을 그대로 말한다. 도면 선택은 위 칸, 직접 추가는 여기 버튼 */
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <p className="text-sm text-slate-600">위에서 도면(BOM)을 고르면 소요량에서 라인이 채워져요.</p>
              <p className="text-xs text-slate-500">도면 없이 직접 라인을 추가해도 돼요 — 품명이나 호칭 · 규격을 적으면 품목 마스터에서 단위와 기본 거래처를 채워요.</p>
              {addButton}
            </div>
          ) : (
            <div className="space-y-2">
              {/* 머리글 행 — xl 이상에서만. 그 아래에서는 칸마다 작은 라벨 */}
              <div className={`${LINE_GRID} hidden border-b border-slate-200 pb-2 text-xs font-medium text-slate-500 xl:grid`} aria-hidden>
                {LINE_COLUMNS.map((c) => (
                  <span key={c.label} className={c.align === "right" ? "text-right" : ""}>
                    {c.label}
                  </span>
                ))}
                <span />
              </div>

              <ul className="divide-y divide-slate-100">
                {draft.lines.map((l) => {
                  const off = l.qty <= 0;
                  const who = l.itemName || "라인";
                  return (
                    <li key={l.id} className={`${LINE_GRID} py-2.5 xl:py-1.5 ${off ? "opacity-60" : ""}`}>
                      <div className="col-span-2 xl:col-span-1">
                        <label htmlFor={`${l.id}-name`} className={CELL_LABEL}>
                          품명
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input id={`${l.id}-name`} aria-label={`${who} 품명`} value={l.itemName} onChange={(e) => setLine(l.id, { itemName: e.target.value })} onBlur={() => autofill(l.id)} className={FIELD_SM} />
                          {/* 좁은 폭의 빼기 — 품명 칸 옆. xl 에서는 마지막 열의 버튼이 대신한다 */}
                          <button type="button" aria-label={`${who} 빼기`} onClick={() => removeLine(l.id)} className={`${REMOVE_BTN} shrink-0 xl:hidden`}>
                            <IconX size={14} />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label htmlFor={`${l.id}-spec`} className={CELL_LABEL}>
                          호칭
                        </label>
                        <input id={`${l.id}-spec`} aria-label={`${who} 호칭`} value={l.spec} onChange={(e) => setLine(l.id, { spec: e.target.value })} onBlur={() => autofill(l.id)} className={FIELD_SM} />
                      </div>
                      <div>
                        <label htmlFor={`${l.id}-size`} className={CELL_LABEL}>
                          규격
                        </label>
                        <input id={`${l.id}-size`} aria-label={`${who} 규격`} value={l.size} onChange={(e) => setLine(l.id, { size: e.target.value })} onBlur={() => autofill(l.id)} className={FIELD_SM} />
                      </div>
                      <div>
                        <label htmlFor={`${l.id}-qty`} className={CELL_LABEL}>
                          수량
                        </label>
                        <input
                          id={`${l.id}-qty`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          aria-label={`${who} 수량`}
                          value={l.qty}
                          onChange={(e) => setLine(l.id, { qty: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })}
                          className={`${FIELD_SM} ${NUM} text-right`}
                        />
                      </div>
                      <div>
                        <label htmlFor={`${l.id}-unit`} className={CELL_LABEL}>
                          단위
                        </label>
                        <input id={`${l.id}-unit`} aria-label={`${who} 단위`} value={l.unit} onChange={(e) => setLine(l.id, { unit: e.target.value })} className={FIELD_SM} />
                      </div>
                      <div className="col-span-2 xl:col-span-1">
                        <span className={CELL_LABEL}>발주처</span>
                        <MultiPicker
                          label={`${who} 발주처`}
                          options={vendorOptions}
                          value={l.vendorId ? [l.vendorId] : []}
                          onChange={(ids) => setLine(l.id, { vendorId: ids[0] ?? "" })}
                          single
                          placeholder="발주처"
                          invalid={!!errors.vendor && l.qty > 0 && !l.vendorId}
                        />
                      </div>
                      <div className="col-span-2 xl:col-span-1">
                        <span className={CELL_LABEL}>가공 요청</span>
                        <MultiPicker label={`${who} 가공 요청`} options={tagOptions} value={l.tags} onChange={(tags) => setLine(l.id, { tags })} firstTag={null} placeholder="태그" />
                      </div>
                      <div className="col-span-2 xl:col-span-1">
                        <label htmlFor={`${l.id}-note`} className={CELL_LABEL}>
                          비고
                        </label>
                        <input id={`${l.id}-note`} aria-label={`${who} 비고`} value={l.note} onChange={(e) => setLine(l.id, { note: e.target.value })} className={FIELD_SM} />
                      </div>
                      {/* 빼기 — xl 의 마지막 열 */}
                      <div className="hidden xl:block">
                        <button type="button" aria-label={`${who} 빼기`} onClick={() => removeLine(l.id)} className={REMOVE_BTN}>
                          <IconX size={14} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {addButton}
                {(errors.lines || errors.vendor) && (
                  <p className="text-xs text-red-600" role="alert">
                    {[errors.lines, errors.vendor].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 문서 — 무엇이 몇 장 나가는지. 수량 있는 라인이 있을 때만 뜻이 있다 */}
          {activeCount > 0 && (
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
          )}
        </div>
      </Modal>

      <ConfirmModal
        open={confirmDiscard}
        title="작성을 취소하시겠습니까?"
        message="저장하지 않은 라인과 수량은 사라집니다."
        cancel="계속 작성"
        cta="작성 취소"
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
