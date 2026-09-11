"use client";

import { useState } from "react";
import { IconAlertTriangle, IconDownload } from "@/components/icons";
import { ConfirmModal } from "@/components/management/workbench";
import { PurchaseOrderWizard } from "@/components/purchase-order";
import { Button, Card, DataTable, FIELD_SM, FIELD_SM_ERROR, Segmented } from "@/components/ui";
import type { Judgement, PoLine, PurchaseOrder } from "@/data/inventory";
import { PO_BOM, PO_DRAWINGS, type PurchaseOrderRow } from "@/data/purchasing";
import type { Cell } from "@/data/types";
import { downloadCsv } from "@/lib/download";
import {
  lineRemaining,
  orderOrdered,
  orderReceived,
  orderSort,
  orderStatus,
  revMismatch,
  type OrderStatus,
} from "@/lib/inventory-state";
import { CardTools } from "./card-tools";
import { useInventory } from "./inventory-provider";

/** 상태 셀 — 지금 행동할 값(기한 넘김 · 잔량)만 색이 있다. 「도착」은 말하지 않는다 */
function statusCell(s: OrderStatus): Cell {
  switch (s.kind) {
    case "overdue":
      return { badge: `${s.days}일 경과`, tone: "red" };
    case "partial":
      return { badge: `잔량 ${s.remaining} EA`, tone: "amber" };
    case "waiting":
      return { badge: `등록 전 · ${s.days}일차`, tone: "slate" };
    case "done":
      return { badge: "입고 완료", tone: "slate" };
  }
}

const COLUMNS = ["발주번호", "발주일", "발주처", "관리번호", "품목", "입고", "상태"];
const LINE_COLUMNS = ["번호", "품명", "규격", "발주", "입고", "잔량", "판정", "조치사항"];
const LINE_ALIGN = ["left", "left", "left", "right", "right", "right", "left", "left"] as const;
const JUDGEMENT_OPTIONS: { value: Judgement; label: string }[] = [
  { value: "pass", label: "합격" },
  { value: "fail", label: "불합격" },
];

/** 편집 상태의 라인 하나 — 입력은 문자열로 들고 저장할 때 검증한다 */
interface Draft {
  qty: string;
  judgement: Judgement;
  note: string;
}
const emptyDraft = (lines: PoLine[]): Record<string, Draft> =>
  Object.fromEntries(lines.map((l) => [l.no, { qty: "", judgement: "pass", note: "" }]));
const qtyOf = (d: Draft) => Math.max(0, Math.floor(Number(d.qty) || 0));

type Confirm = null | { kind: "close"; remaining: number; then: () => Promise<void> } | { kind: "discard"; then: () => void };

/**
 * 발주·입고 — 발주 라인이 입고 · 판정을 직접 갖는 한 표. 할 일 순으로 정렬하고 끝난 행은 전부 내림.
 * 행을 누르면 아래로 펼쳐지고(모달 아님), 「입고 등록」은 같은 패널을 편집 상태로 바꾼다.
 *
 * 권한: `receiving` 이 없으면 입고 등록 · 판정을 그리지 않고, `purchasing` 이 없으면 발주서 만들기 · 다시 출력 · 「발주 전」 줄을 그리지 않는다.
 * 표와 펼침은 둘 다 본다.
 */
export function OrdersTab() {
  const { state, can, dispatch, notify } = useInventory();
  const canReceive = can("receiving");
  const canPurchase = can("purchasing");

  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<Confirm>(null);
  /** 위저드는 열 때마다 새로 마운트한다(key). 0 = 닫힘 */
  const [wizard, setWizard] = useState<{ seq: number; drawing?: string }>({ seq: 0 });

  const vendorName = (id: string) => state.vendors.find((v) => v.id === id)?.name ?? "—";
  const q = query.trim().toLowerCase();
  const orders = orderSort(state.orders, state.vendors, state.today).filter(
    (o) => !q || [o.poNo, vendorName(o.vendorId), o.projectCode].some((s) => s.toLowerCase().includes(q)),
  );
  const statuses = orders.map((o) => orderStatus(o, state.vendors, state.today));
  const expandedIndex = orders.findIndex((o) => o.poNo === expanded);

  const rows: Cell[][] = orders.map((o, i) => {
    const first = o.lines[0];
    return [
      o.poNo,
      o.orderedOn.slice(5).replace("-", "."),
      vendorName(o.vendorId),
      o.projectCode,
      o.lines.length > 1 ? `${first.nameAtOrder} 외 ${o.lines.length - 1}` : first.nameAtOrder,
      `${orderReceived(o)} / ${orderOrdered(o)} EA`,
      statusCell(statuses[i]),
    ];
  });

  const dirty = editing !== null && Object.values(draft).some((d) => qtyOf(d) > 0 || d.note.trim() !== "" || d.judgement === "fail");

  function toggleRow(i: number) {
    const poNo = orders[i].poNo;
    const go = () => {
      setEditing(null);
      setErrors({});
      setExpanded((cur) => (cur === poNo ? null : poNo));
    };
    if (dirty && editing !== poNo) setConfirm({ kind: "discard", then: go });
    else go();
  }

  function startEdit(order: PurchaseOrder) {
    setDraft(emptyDraft(order.lines));
    setErrors({});
    setEditing(order.poNo);
  }

  function cancelEdit() {
    const go = () => {
      setEditing(null);
      setErrors({});
    };
    if (dirty) setConfirm({ kind: "discard", then: go });
    else go();
  }

  function reprint(order: PurchaseOrder) {
    downloadCsv(`발주서_${order.poNo}.csv`, [
      ["발주서"],
      ["발주번호", order.poNo, "", "발주처", vendorName(order.vendorId)],
      ["관리번호", order.projectCode, "", "근거 도면", `${order.drawing} ${order.rev}`],
      [],
      ["No.", "품명", "호칭", "규격", "수량"],
      ...order.lines.map((l) => [l.no, l.nameAtOrder, l.specAtOrder, l.sizeAtOrder, String(l.ordered)]),
    ]);
    notify(`${order.poNo} 발주서를 내보냈어요`);
  }

  /** 저장 — 초과 · 불합격은 조치사항이 있어야 한다. 「검수 완료」는 잔량이 남으면 한 번 묻는다 */
  function save(order: PurchaseOrder, complete: boolean) {
    const entries = order.lines
      .map((l) => ({ line: l, d: draft[l.no], qty: qtyOf(draft[l.no]) }))
      .filter((e) => e.qty > 0);
    const next: Record<string, string> = {};
    for (const { line, d, qty } of entries) {
      const over = d.judgement === "pass" && qty > lineRemaining(line);
      if ((over || d.judgement === "fail") && !d.note.trim()) next[line.no] = "사유를 적어 주세요";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const commit = async () => {
      const ok = await dispatch({
        type: "receive",
        poNo: order.poNo,
        lines: entries.map(({ line, d, qty }) => ({ no: line.no, received: qty, judgement: d.judgement, note: d.note.trim() || undefined })),
        complete,
      });
      if (!ok) return;
      const pass = entries.filter((e) => e.d.judgement === "pass").reduce((s, e) => s + e.qty, 0);
      const fail = entries.filter((e) => e.d.judgement === "fail").reduce((s, e) => s + e.qty, 0);
      const parts = [pass > 0 ? `입고 ${pass} EA를 등록했어요` : "", fail > 0 ? `불합격 ${fail} EA를 기록했어요` : "", complete ? "검수를 완료했어요" : ""].filter(Boolean);
      notify(parts.join(" · "));
      setEditing(null);
      setErrors({});
    };

    if (complete) {
      const remaining = order.lines.reduce((s, l) => {
        const e = entries.find((x) => x.line.no === l.no);
        return s + Math.max(0, lineRemaining(l) - (e && e.d.judgement === "pass" ? e.qty : 0));
      }, 0);
      if (remaining > 0) {
        setConfirm({ kind: "close", remaining, then: commit });
        return;
      }
    }
    void commit();
  }

  /** 위저드가 만든 발주 → 새 모델. 발주처는 이름으로, 품목은 규격(사양+규격) 으로 맞춘다 */
  function registerOrders(created: PurchaseOrderRow[]) {
    const mapped: PurchaseOrder[] = created.map((row) => ({
      poNo: row.poNo,
      orderedOn: row.orderedOn,
      vendorId: state.vendors.find((v) => v.name === row.supplier)?.id ?? "",
      projectCode: row.projectCode,
      drawing: row.drawing,
      rev: row.rev,
      requester: row.requester,
      lines: row.lines.map((l, i) => {
        const item = state.items.find((it) => it.spec === l.spec && it.size === l.size) ?? state.items.find((it) => it.name === l.itemName);
        return { no: String(i + 1).padStart(2, "0"), itemCode: item?.code ?? "", nameAtOrder: l.itemName, specAtOrder: l.spec, sizeAtOrder: l.size, ordered: l.qty, received: 0, judgement: null, note: "" };
      }),
    }));
    void dispatch({ type: "createOrders", orders: mapped }).then((ok) => ok && notify(`발주 ${mapped.length}건을 등록했어요`));
  }

  // 소요가 확정됐는데 발주가 없는 작업 — 도면(BOM) 데모에서 읽는다(제품설계 연동 전)
  const pendingWorks = canPurchase
    ? PO_DRAWINGS.filter((d) => !state.orders.some((o) => o.projectCode === d.projectCode))
        .map((d) => {
          const lines = (PO_BOM[d.code] ?? []).filter((n) => n.need - n.stock > 0);
          return { d, count: lines.length, qty: lines.reduce((s, n) => s + (n.need - n.stock), 0) };
        })
        .filter((w) => w.count > 0)
    : [];

  function renderPanel(i: number) {
    const order = orders[i];
    const status = statuses[i];
    const mismatch = revMismatch(order, PO_DRAWINGS);
    const drawingRev = PO_DRAWINGS.find((d) => d.code === order.drawing)?.rev;
    const isEditing = editing === order.poNo;

    return (
      <div className="space-y-3">
        {mismatch && (
          <p className="flex items-center gap-1.5 text-sm text-amber-700">
            <IconAlertTriangle size={14} className="shrink-0" />
            발주는 {order.rev} · 도면은 지금 {drawingRev} — 라인 규격을 확인해 주세요
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            도면 {order.drawing} {order.rev} · 요청 {order.requester}
            {order.closedOn && <span className="text-slate-500"> · {order.closedOn.slice(5).replace("-", ".")} 마감</span>}
          </p>
          {!isEditing && (
            <div className="flex gap-2">
              {canPurchase && (
                <Button size="sm" variant="secondary" onClick={() => reprint(order)}>
                  <IconDownload size={14} />
                  발주서 다시 출력
                </Button>
              )}
              {canReceive && status.kind !== "done" && (
                <Button size="sm" onClick={() => startEdit(order)}>
                  입고 등록
                </Button>
              )}
            </div>
          )}
        </div>

        {isEditing ? (
          <>
            <div className="thin-scroll overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th scope="col" className="py-2 pr-3">번호</th>
                    <th scope="col" className="px-3 py-2">품명</th>
                    <th scope="col" className="px-3 py-2">규격</th>
                    <th scope="col" className="px-3 py-2 text-right">발주</th>
                    <th scope="col" className="px-3 py-2 text-right">입고</th>
                    <th scope="col" className="px-3 py-2 text-right">잔량</th>
                    <th scope="col" className="px-3 py-2">이번 입고</th>
                    <th scope="col" className="px-3 py-2">판정</th>
                    <th scope="col" className="py-2 pl-3">조치사항</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.lines.map((l) => {
                    const d = draft[l.no];
                    const rem = lineRemaining(l);
                    const err = errors[l.no];
                    const set = (patch: Partial<Draft>) => setDraft((prev) => ({ ...prev, [l.no]: { ...prev[l.no], ...patch } }));
                    return (
                      <tr key={l.no}>
                        <td className="py-2 pr-3 text-slate-600">{l.no}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">{l.nameAtOrder}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">{`${l.specAtOrder} ${l.sizeAtOrder}`}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{l.ordered}</td>
                        <td className={`px-3 py-2 text-right ${l.received === 0 ? "text-slate-500" : "text-slate-600"}`}>{l.received}</td>
                        <td className={`px-3 py-2 text-right ${rem > 0 ? "font-semibold text-slate-900" : "text-slate-500"}`}>{rem}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            aria-label={`${l.nameAtOrder} 이번 입고`}
                            value={d.qty}
                            onChange={(e) => set({ qty: e.target.value })}
                            className={`${FIELD_SM} w-20 text-right`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Segmented options={JUDGEMENT_OPTIONS} value={d.judgement} onChange={(v) => set({ judgement: v })} label={`${l.nameAtOrder} 판정`} />
                        </td>
                        <td className="py-2 pl-3">
                          <input
                            aria-label={`${l.nameAtOrder} 조치사항`}
                            aria-invalid={!!err}
                            value={d.note}
                            onChange={(e) => set({ note: e.target.value })}
                            className={`${err ? FIELD_SM_ERROR : FIELD_SM} min-w-[220px]`}
                          />
                          {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button size="sm" variant="secondary" onClick={cancelEdit}>
                닫기
              </Button>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={!dirty} onClick={() => save(order, false)}>
                  부분 입고로 저장
                </Button>
                <Button size="sm" onClick={() => save(order, true)}>
                  검수 완료
                </Button>
              </div>
            </div>
          </>
        ) : (
          <DataTable
            dense
            data={{
              columns: LINE_COLUMNS,
              rows: order.lines.map((l) => {
                const rem = lineRemaining(l);
                const judgement: Cell = l.judgement === "fail" ? { badge: "불합격", tone: "red" } : l.judgement === "pass" ? "합격" : "—";
                return [l.no, l.nameAtOrder, `${l.specAtOrder} ${l.sizeAtOrder}`, String(l.ordered), String(l.received), order.closedOn && rem > 0 ? `취소 ${rem}` : String(rem), judgement, l.note || "—"];
              }),
            }}
            colAlign={[...LINE_ALIGN]}
            // 합격 · 잔량 0 라인은 셀 전부 내림. 잔량이 남은 라인은 잔량만 강조
            rowEmphasis={(_, k) => (lineRemaining(order.lines[k]) === 0 && order.lines[k].judgement === "pass" ? "down" : undefined)}
            emphasisAt={(row, k, j) => {
              if (j === 5) return !order.closedOn && lineRemaining(order.lines[k]) > 0 ? "em" : "down";
              if (row[j] === "—" || row[j] === "합격" || row[j] === "0") return "down";
              return undefined;
            }}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-slate-900">발주 현황</h2>
          <CardTools search={{ value: query, onChange: setQuery, placeholder: "발주번호 · 발주처 · 관리번호로 찾기" }} />
        </div>
        <DataTable
          data={{ columns: COLUMNS, rows }}
          emphasis={[undefined, undefined, undefined, undefined, undefined, "em"]}
          rowEmphasis={(_, i) => (statuses[i].kind === "done" ? "down" : undefined)}
          onRowClick={toggleRow}
          expandedRow={expandedIndex >= 0 ? expandedIndex : null}
          renderExpanded={renderPanel}
        />

        {pendingWorks.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-200">
            {pendingWorks.map(({ d, count, qty }) => (
              <li key={d.code} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <p className="text-sm text-slate-600">
                  {d.projectCode} · {d.rev} · <span className="font-semibold text-slate-900">{count}품목 {qty} EA</span> · 발주 전
                </p>
                <Button size="sm" variant="secondary" onClick={() => setWizard((w) => ({ seq: w.seq + 1, drawing: d.code }))}>
                  발주서 만들기
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {wizard.seq > 0 && (
        <PurchaseOrderWizard
          key={wizard.seq}
          open
          onClose={() => setWizard({ seq: 0 })}
          orderCount={state.orders.length}
          today={state.today}
          initialDrawing={wizard.drawing}
          onRegistered={registerOrders}
        />
      )}

      <ConfirmModal
        open={confirm?.kind === "close"}
        title="잔량을 남긴 채 마감할까요?"
        message={confirm?.kind === "close" ? `잔량 ${confirm.remaining} EA는 취소로 남고, 이 발주는 입고 완료가 돼요.` : ""}
        cta="마감"
        variant="primary"
        icon="warn"
        onConfirm={() => {
          const then = confirm?.kind === "close" ? confirm.then : null;
          setConfirm(null);
          void then?.();
        }}
        onClose={() => setConfirm(null)}
      />
      <ConfirmModal
        open={confirm?.kind === "discard"}
        title="바꾼 내용을 버릴까요?"
        message="적어 둔 입고 수량과 조치사항이 사라져요."
        cta="버리기"
        variant="danger"
        icon="warn"
        onConfirm={() => {
          const then = confirm?.kind === "discard" ? confirm.then : null;
          setConfirm(null);
          then?.();
        }}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}
