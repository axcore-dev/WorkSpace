"use client";

import { useState } from "react";
import { IconAlertTriangle, IconDownload } from "@/components/icons";
import { ConfirmModal } from "@/components/management/workbench";
import { Button, Card, DataTable, FIELD_SM, FIELD_SM_ERROR, MenuButton, Segmented } from "@/components/ui";
import type { Judgement, PoLine, PurchaseOrder } from "@/data/inventory";
import { PO_BOM, PO_DRAWINGS } from "@/data/purchasing";
import type { Cell } from "@/data/types";
import { downloadCsv } from "@/lib/download";
import { matchesQuery } from "@/lib/search";
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
import { OrderEditor } from "./order-editor";

/** 상태 셀 — 본문 크기. 지금 행동할 값(기한 넘김 · 잔량)만 색 + 굵게, 나머지는 내림. 「도착」은 말하지 않는다 */
function statusCell(s: OrderStatus): Cell {
  switch (s.kind) {
    case "overdue":
      return { badge: `${s.days}일 경과`, tone: "red", size: "md", strong: true };
    case "partial":
      return { badge: `잔량 ${s.remaining} EA`, tone: "amber", size: "md", strong: true };
    case "waiting":
      return { badge: `등록 전 · ${s.days}일차`, tone: "slate", size: "md" };
    case "making":
      return { badge: `제작 중 · ${s.days}일차`, tone: "slate", size: "md" };
    case "done":
      return { badge: "입고 완료", tone: "slate", size: "md" };
  }
}

const COLUMNS_ALL = ["발주번호", "발주일", "발주처", "관리번호", "품목", "입고", "상태"];
/** 간단 밀도 — 발주번호는 기록용 식별자라 매일 보는 표에서는 뺀다. 펼침 패널 메타 · 상세 밀도 · 출력물에는 있다 */
const COLUMNS_SIMPLE = COLUMNS_ALL.slice(1);
/** 패널의 라인 표 — 문서의 줄 번호(01, 02)는 출력물에만 있다 */
const LINE_COLUMNS = ["품명", "규격", "발주", "입고", "잔량", "판정", "조치사항"];
const LINE_ALIGN = ["left", "left", "right", "right", "right", "left", "left"] as const;
const JUDGEMENT_OPTIONS: { value: Judgement; label: string }[] = [
  { value: "pass", label: "합격" },
  { value: "fail", label: "불합격" },
];
/** 수량 칸 — 스피너를 감춘다. 숫자를 가리고 손가락 타깃과 겹친다 */
const NUM = "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

/** 편집 상태의 라인 하나 — 입력은 문자열로 들고 저장할 때 검증한다 */
interface Draft {
  qty: string;
  judgement: Judgement;
  note: string;
}
const emptyDraft = (lines: PoLine[]): Record<string, Draft> =>
  Object.fromEntries(lines.map((l) => [l.no, { qty: "", judgement: "pass", note: "" }]));
const qtyOf = (d: Draft) => Math.max(0, Math.floor(Number(d.qty) || 0));

type Confirm = null | { kind: "close"; detail: string; then: () => Promise<void> } | { kind: "discard"; then: () => void };

/**
 * 발주·입고 — 발주 라인이 입고 · 판정을 직접 갖는 한 표. 할 일 순으로 정렬하고 끝난 행은 전부 내림.
 * 행을 누르면 아래로 펼쳐지고(모달 아님), 「입고 등록」은 같은 패널을 편집 상태로 바꾼다.
 *
 * 편집 폼은 `<form>` — Enter 가 저장이고, 첫 열린 라인의 수량 칸에 포커스가 선다. primary 는 「저장」 하나.
 * 「검수 완료」(마감)는 secondary 다 — 잔량을 전부 취소로 만드는 길이 가장 눈에 띄는 버튼이면 안 된다.
 * 초과 입고는 사유 전에 사실(「잔량 N EA보다 M 많아요」)을 먼저 말한다.
 *
 * 권한: `receiving` 이 없으면 입고 등록 · 판정을 그리지 않고, `purchasing` 이 없으면 발주서 만들기 · 출력 · 「발주 전」 줄을 그리지 않는다.
 * 표와 펼침은 둘 다 본다.
 */
export function OrdersTab() {
  const { state, can, dispatch, notify, density } = useInventory();
  const canReceive = can("receiving");
  const canPurchase = can("purchasing");

  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  /** `${no}:qty` · `${no}:note` · `_form` */
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<Confirm>(null);
  /** 발주서 편집기는 열 때마다 새로 마운트한다(key). 0 = 닫힘 */
  const [editor, setEditor] = useState<{ seq: number; drawing?: string }>({ seq: 0 });

  const vendorName = (id: string) => state.vendors.find((v) => v.id === id)?.name ?? "—";
  // 발주번호 · 발주처 · 관리번호 + 라인의 품명 · 호칭 · 규격 — 실무자는 품명으로 찾는다
  const orders = orderSort(state.orders, state.vendors, state.today).filter((o) =>
    matchesQuery(query, [o.poNo, vendorName(o.vendorId), o.projectCode, ...o.lines.flatMap((l) => [l.nameAtOrder, l.specAtOrder, l.sizeAtOrder])]),
  );
  const statuses = orders.map((o) => orderStatus(o, state.vendors, state.today));
  const expandedIndex = orders.findIndex((o) => o.poNo === expanded);

  const fullRows: Cell[][] = orders.map((o, i) => {
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
  const simple = density === "simple";
  const columns = simple ? COLUMNS_SIMPLE : COLUMNS_ALL;
  const rows = simple ? fullRows.map((r) => r.slice(1)) : fullRows;

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

  /** 잔량이 남은 라인의 이번 입고를 잔량으로 — 전량 입고가 대부분인 실무의 기본 동작 */
  function fillAll(order: PurchaseOrder) {
    setDraft((prev) => Object.fromEntries(order.lines.map((l) => [l.no, { ...prev[l.no], qty: lineRemaining(l) > 0 ? String(lineRemaining(l)) : prev[l.no].qty }])));
    setErrors({});
  }

  /** 업체별 — 이 발주 한 장 */
  function printOne(order: PurchaseOrder) {
    downloadCsv(`발주서_${order.poNo}.csv`, [
      ["발주서"],
      ["발주번호", order.poNo, "", "발주처", vendorName(order.vendorId)],
      ["관리번호", order.projectCode, "", "근거 도면", `${order.drawing} ${order.rev}`],
      [],
      ["No.", "품명", "호칭", "규격", "수량"],
      ...order.lines.map((l) => [l.no, l.nameAtOrder, l.specAtOrder, l.sizeAtOrder, String(l.ordered)]),
    ]);
    notify(`${vendorName(order.vendorId)} 발주서를 내보냈어요`);
  }

  /** 전체 — 같은 관리번호로 나간 발주 전부를 한 장에(발주처 · 발주번호 열 포함) */
  function printAll(order: PurchaseOrder) {
    const siblings = state.orders.filter((o) => o.projectCode === order.projectCode);
    let no = 0;
    downloadCsv(`발주서_${order.projectCode.replace(/\s+/g, "")}_전체.csv`, [
      ["발주서 · 전체"],
      ["관리번호", order.projectCode, "", "근거 도면", `${order.drawing} ${order.rev}`],
      [],
      ["No.", "품명", "호칭", "규격", "수량", "발주처", "발주번호"],
      ...siblings.flatMap((o) => o.lines.map((l) => [String(++no), l.nameAtOrder, l.specAtOrder, l.sizeAtOrder, String(l.ordered), vendorName(o.vendorId), o.poNo])),
    ]);
    notify(`관리번호 ${order.projectCode} 발주서 ${siblings.length}건을 내보냈어요`);
  }

  /**
   * 저장 — 초과 입고는 사실 + 사유, 불합격은 수량 + 사유가 있어야 한다.
   * `complete` 면 마감 — 잔량이 남으면 어느 라인이 취소로 남는지 적어 한 번 묻는다. 입고 없이 마감(공급 불가)도 이 길로 간다.
   */
  function save(order: PurchaseOrder, complete: boolean) {
    const entries = order.lines.map((l) => ({ line: l, d: draft[l.no], qty: qtyOf(draft[l.no]), rem: lineRemaining(l) }));
    const next: Record<string, string> = {};
    for (const { line, d, qty, rem } of entries) {
      if (d.judgement === "fail" && qty === 0) next[`${line.no}:qty`] = "불합격 수량을 적어 주세요";
      const over = d.judgement === "pass" && qty > rem;
      if (over && !d.note.trim()) next[`${line.no}:note`] = `잔량 ${rem} EA보다 ${qty - rem} 많아요 — 사유를 적어 주세요`;
      else if (d.judgement === "fail" && qty > 0 && !d.note.trim()) next[`${line.no}:note`] = "불합격 사유를 적어 주세요";
    }
    const active = entries.filter((e) => e.qty > 0);
    if (active.length === 0 && !complete) next._form = "이번에 들어온 수량을 적어 주세요";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const commit = async () => {
      const ok = await dispatch({
        type: "receive",
        poNo: order.poNo,
        lines: active.map(({ line, d, qty }) => ({ no: line.no, received: qty, judgement: d.judgement, note: d.note.trim() || undefined })),
        complete,
      });
      if (!ok) return;
      const pass = active.filter((e) => e.d.judgement === "pass").reduce((s, e) => s + e.qty, 0);
      const fail = active.filter((e) => e.d.judgement === "fail").reduce((s, e) => s + e.qty, 0);
      const parts = [pass > 0 ? `입고 ${pass} EA를 등록했어요` : "", fail > 0 ? `불합격 ${fail} EA를 기록했어요` : "", complete ? "검수를 완료했어요" : ""].filter(Boolean);
      notify(parts.join(" · "));
      setEditing(null);
      setErrors({});
    };

    if (complete) {
      const left = entries
        .map((e) => ({ name: e.line.nameAtOrder, rem: Math.max(0, e.rem - (e.d.judgement === "pass" ? e.qty : 0)) }))
        .filter((x) => x.rem > 0);
      if (left.length > 0) {
        const overs = active.filter((e) => e.d.judgement === "pass" && e.qty > e.rem).map((e) => `${e.line.nameAtOrder} 초과 +${e.qty - e.rem}`);
        const detail = [
          `취소로 남는 잔량: ${left.map((x) => `${x.name} ${x.rem} EA`).join(" · ")}.`,
          active.length === 0 ? "이번 입고 없이 마감합니다." : "",
          overs.length > 0 ? `${overs.join(" · ")}는 이력 메모에 남습니다.` : "",
          "이 발주는 입고 완료로 처리됩니다.",
        ]
          .filter(Boolean)
          .join(" ");
        setConfirm({ kind: "close", detail, then: commit });
        return;
      }
    }
    void commit();
  }

  // 소요가 확정됐는데 발주가 없는 작업 — 도면(BOM) 데모에서 읽는다(제품설계 연동 전)
  // 검색 중이면 이 목록도 같은 검색어로 걸러진다 — 표만 줄고 아래 줄이 그대로면 「없음」 이 아닌 것처럼 읽힌다
  const pendingWorks = canPurchase
    ? PO_DRAWINGS.filter((d) => !state.orders.some((o) => o.projectCode === d.projectCode))
        .filter((d) => matchesQuery(query, [d.projectCode, d.code, d.name, d.rev]))
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
    const siblings = state.orders.filter((o) => o.projectCode === order.projectCode).length;
    const firstOpen = order.lines.findIndex((l) => lineRemaining(l) > 0);

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
            <span className="text-slate-500">{order.poNo}</span> · 도면 {order.drawing} {order.rev} · 요청 {order.requester}
            {order.closedOn && <span className="text-slate-500"> · {order.closedOn.slice(5).replace("-", ".")} 마감</span>}
          </p>
          {!isEditing && (
            <div className="flex gap-2">
              {canPurchase && (
                <MenuButton
                  size="sm"
                  menuLabel="발주서 출력 범위"
                  label={
                    <>
                      <IconDownload size={14} />
                      발주서 출력
                    </>
                  }
                  items={[
                    { label: `업체별 · ${vendorName(order.vendorId)}`, onClick: () => printOne(order) },
                    { label: `전체 · 관리번호 ${order.projectCode} (${siblings}건)`, onClick: () => printAll(order) },
                  ]}
                />
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
          <form
            className="fade-in space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              save(order, false);
            }}
          >
            <div className="thin-scroll overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th scope="col" className="py-2 pr-3">품명</th>
                    <th scope="col" className="px-3 py-2">규격</th>
                    <th scope="col" className="px-3 py-2 text-right">발주</th>
                    <th scope="col" className="px-3 py-2 text-right">입고</th>
                    <th scope="col" className="px-3 py-2 text-right">잔량</th>
                    <th scope="col" className="w-28 px-3 py-2">이번 입고</th>
                    <th scope="col" className="px-3 py-2">판정</th>
                    <th scope="col" className="py-2 pl-3">조치사항</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.lines.map((l, k) => {
                    const d = draft[l.no];
                    const rem = lineRemaining(l);
                    const qty = qtyOf(d);
                    const over = d.judgement === "pass" && qty > rem;
                    const qtyErr = errors[`${l.no}:qty`];
                    const noteErr = errors[`${l.no}:note`];
                    const set = (patch: Partial<Draft>) => setDraft((prev) => ({ ...prev, [l.no]: { ...prev[l.no], ...patch } }));
                    return (
                      <tr key={l.no} className="align-top">
                        <td className="whitespace-nowrap py-2 pr-3 text-slate-600">{l.nameAtOrder}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">{`${l.specAtOrder} ${l.sizeAtOrder}`}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{l.ordered}</td>
                        <td className={`px-3 py-2 text-right ${l.received === 0 ? "text-slate-500" : "text-slate-600"}`}>{l.received}</td>
                        <td className={`px-3 py-2 text-right ${rem > 0 ? "font-semibold text-slate-900" : "text-slate-500"}`}>{rem}</td>
                        <td className="w-28 px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            autoFocus={k === firstOpen}
                            aria-label={`${l.nameAtOrder} 이번 입고`}
                            aria-invalid={!!qtyErr || over || undefined}
                            value={d.qty}
                            onChange={(e) => set({ qty: e.target.value })}
                            className={`${qtyErr || over ? FIELD_SM_ERROR : FIELD_SM} ${NUM} text-right`}
                          />
                          {qtyErr ? (
                            <p className="mt-1 text-xs text-red-600">{qtyErr}</p>
                          ) : over ? (
                            <p className="mt-1 whitespace-nowrap text-xs text-amber-700">잔량보다 {qty - rem} 많아요</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <Segmented options={JUDGEMENT_OPTIONS} value={d.judgement} onChange={(v) => set({ judgement: v })} label={`${l.nameAtOrder} 판정`} />
                        </td>
                        <td className="py-2 pl-3">
                          <input
                            aria-label={`${l.nameAtOrder} 조치사항`}
                            aria-invalid={!!noteErr || undefined}
                            value={d.note}
                            onChange={(e) => set({ note: e.target.value })}
                            placeholder={over || d.judgement === "fail" ? "사유" : undefined}
                            className={`${noteErr ? FIELD_SM_ERROR : FIELD_SM} min-w-[220px]`}
                          />
                          {noteErr && <p className="mt-1 text-xs text-red-600">{noteErr}</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={cancelEdit}>
                  닫기
                </Button>
                {firstOpen >= 0 && (
                  <Button type="button" size="sm" variant="secondary" onClick={() => fillAll(order)}>
                    전량 입고로 채우기
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {errors._form && (
                  <p className="text-xs text-red-600" role="alert">
                    {errors._form}
                  </p>
                )}
                <Button type="button" size="sm" variant="secondary" onClick={() => save(order, true)}>
                  검수 완료
                </Button>
                <Button type="submit" size="sm" disabled={!dirty}>
                  저장
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <DataTable
            dense
            data={{
              columns: LINE_COLUMNS,
              rows: order.lines.map((l) => {
                const rem = lineRemaining(l);
                const judgement: Cell = l.judgement === "fail" ? { badge: "불합격", tone: "red" } : l.judgement === "pass" ? "합격" : "대기";
                return [l.nameAtOrder, `${l.specAtOrder} ${l.sizeAtOrder}`, String(l.ordered), String(l.received), order.closedOn && rem > 0 ? `취소 ${rem}` : String(rem), judgement, l.note || "—"];
              }),
            }}
            colAlign={[...LINE_ALIGN]}
            // 합격 · 잔량 0 라인은 셀 전부 내림. 잔량이 남은 라인은 잔량만 강조
            rowEmphasis={(_, k) => (lineRemaining(order.lines[k]) === 0 && order.lines[k].judgement === "pass" ? "down" : undefined)}
            emphasisAt={(row, k, j) => {
              if (j === 4) return !order.closedOn && lineRemaining(order.lines[k]) > 0 ? "em" : "down";
              if (row[j] === "—" || row[j] === "합격" || row[j] === "대기" || row[j] === "0") return "down";
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
          <CardTools
            search={{ value: query, onChange: setQuery, placeholder: "품명 · 발주처 · 관리번호 · 발주번호로 찾기" }}
            density
            onExport={() => {
              downloadCsv("재고물류_발주현황.csv", [COLUMNS_ALL, ...fullRows]);
              notify(`발주 ${fullRows.length}건을 내보냈어요`);
            }}
          >
            {canPurchase && (
              <Button size="sm" variant="secondary" onClick={() => setEditor((w) => ({ seq: w.seq + 1 }))}>
                발주서 만들기
              </Button>
            )}
          </CardTools>
        </div>
        <DataTable
          data={{ columns, rows }}
          emptyText={query.trim() ? "검색 결과가 없어요" : "발주가 없어요"}
          // 강조는 상태 셀(기한 넘김 · 잔량)에만 — 입고 열까지 굵으면 행마다 강조가 둘이 된다. 입고 완료는 지나간 행 — 한 단 더 옅게
          rowEmphasis={(_, i) => (statuses[i].kind === "done" ? "faint" : undefined)}
          onRowClick={toggleRow}
          expandedRow={expandedIndex >= 0 ? expandedIndex : null}
          renderExpanded={renderPanel}
        />

        {pendingWorks.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-200">
            {pendingWorks.map(({ d, count, qty }) => (
              <li key={d.code} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <p className="text-sm text-slate-600">
                  <span className="whitespace-nowrap">{d.projectCode}</span> · {d.rev} ·{" "}
                  <span className="whitespace-nowrap font-semibold text-slate-900">
                    {count}품목 {qty} EA
                  </span>{" "}
                  · <span className="whitespace-nowrap">발주 전</span>
                </p>
                <Button size="sm" variant="secondary" onClick={() => setEditor((w) => ({ seq: w.seq + 1, drawing: d.code }))}>
                  발주서 만들기
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editor.seq > 0 && <OrderEditor key={editor.seq} initialDrawing={editor.drawing} onClose={() => setEditor({ seq: 0 })} />}

      <ConfirmModal
        open={confirm?.kind === "close"}
        title="잔량을 남긴 채 마감하시겠습니까?"
        message={confirm?.kind === "close" ? confirm.detail : ""}
        cancel="계속 입력"
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
        title="입력한 내용을 저장하지 않고 나가시겠습니까?"
        message="적어 둔 입고 수량과 조치사항은 사라집니다."
        cancel="계속 입력"
        cta="저장하지 않고 나가기"
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
