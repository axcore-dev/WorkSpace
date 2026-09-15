"use client";

import { useState } from "react";
import { IconAlertTriangle, IconDownload } from "@/components/icons";
import { ConfirmModal } from "@/components/management/workbench";
import { Button, Card, DataTable, FIELD_SM, FIELD_SM_ERROR, MenuButton, Segmented, TONE_TEXT } from "@/components/ui";
import type { Judgement, PoLine, PurchaseOrder } from "@/data/inventory";
import type { Cell } from "@/data/types";
import { downloadCsv } from "@/lib/download";
import { formatQty } from "@/lib/format";
import { matchesQuery } from "@/lib/search";
import { lineRemaining, orderGroups, orderOrdered, orderReceived, orderStatus, revMismatch, toPoDrawings, type OrderGroup, type OrderStatus } from "@/lib/inventory-state";
import { CardTools } from "./card-tools";
import { useInventory } from "./inventory-provider";
import { OrderEditor } from "./order-editor";

/** 상태 셀 — 셋뿐이다. 기한 넘김만 색 + 굵게, 대기 · 완료는 내림. 「도착」은 말하지 않는다 */
function statusCell(s: OrderStatus): Cell {
  if (s.kind === "overdue") return { badge: `${s.days}일 경과`, tone: "red", size: "md", strong: true };
  return { badge: s.kind === "waiting" ? "대기" : "입고 완료", tone: "slate", size: "md" };
}

/** 발주 현황 — 한 줄 = 한 번의 발주서 작성(발주처가 여럿이면 펼쳐서 발주처별로). 발주번호는 화면에 두지 않는다(출력물에만) */
const COLUMNS = ["발주일", "발주처", "관리번호", "품목", "입고", "상태"];
/** 품목 표기는 어디서나 품목명 · 사양 · 규격 세 칸 (DESIGN.md 「품목 표기」) */
const LINE_COLUMNS = ["품목명", "사양", "규격", "발주", "기입고", "잔량", "판정", "조치사항"];
const LINE_ALIGN = ["left", "left", "left", "right", "right", "right", "left", "left"] as const;
const JUDGEMENT_OPTIONS: { value: Judgement; label: string }[] = [
  { value: "pass", label: "합격" },
  { value: "fail", label: "불합격" },
];
/** 수량 칸 — 스피너를 감춘다. 숫자를 가리고 손가락 타깃과 겹친다 */
const NUM = "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
const shortDate = (iso: string) => iso.slice(5).replace("-", ".");

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
 * 발주·입고 — 한 번의 발주서 작성이 한 줄. 할 일 순으로 정렬하고 끝난 줄은 옅게.
 * 줄을 누르면 아래로 펼쳐지고(모달 아님) **여럿을 동시에 열어 둘 수 있다**. 펼치면 발주처마다 한 덩어리 — 발주처 이름 · 상태 ·
 * 「입고 등록」 · 라인 표. 「입고 등록」은 그 덩어리를 편집 상태로 바꾼다(한 번에 한 발주만 편집).
 *
 * 편집 폼은 `<form>` — Enter 가 저장이고, 첫 열린 라인의 입고 칸에 포커스가 선다. 폼은 960px 을 넘지 않는다(넓은 화면에서
 * 품목명과 입력 칸이 멀어지지 않게). 잔량 0 라인은 입력을 닫는다. 「저장」은 늘 켜 두고 빈 채로 누르면 무엇을 적을지 말한다.
 * 「검수 완료」(마감)는 secondary — 잔량을 전부 취소로 만드는 길이 가장 눈에 띄는 버튼이면 안 된다.
 *
 * 권한: `receiving` 이 없으면 입고 등록 · 판정을 그리지 않고, `purchasing` 이 없으면 발주서 만들기 · 출력을 그리지 않는다. 표와 펼침은 둘 다 본다.
 */
export function OrdersTab() {
  const { state, can, dispatch, notify } = useInventory();
  const canReceive = can("receiving");
  const canPurchase = can("purchasing");

  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  /** `${no}:qty` · `${no}:note` · `_form` */
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<Confirm>(null);
  /** 발주서 편집기는 열 때마다 새로 마운트한다(key). 0 = 닫힘 */
  const [editor, setEditor] = useState(0);

  const vendorOf = (id: string) => state.vendors.find((v) => v.id === id);
  const vendorName = (id: string) => vendorOf(id)?.name ?? "—";
  // 발주처 · 관리번호 + 라인의 품목명 · 사양 · 규격. 발주번호는 안내하지 않지만 쳐도 찾힌다(출력한 종이를 보고 찾을 때)
  const groups = orderGroups(state.orders, state.vendors, state.today).filter((g) =>
    matchesQuery(
      query,
      g.orders.flatMap((o) => [o.poNo, vendorName(o.vendorId), o.projectCode, ...o.lines.flatMap((l) => [l.nameAtOrder, l.specAtOrder, l.sizeAtOrder])]),
    ),
  );
  const expandedRows = groups.flatMap((g, i) => (expanded.includes(g.key) ? [i] : []));
  // 도면의 지금 리비전 — 발주 뒤 도면이 개정됐는지(revMismatch) 보는 데만 쓴다
  const poDrawings = toPoDrawings(state.drawings);

  const rows: Cell[][] = groups.map((g) => {
    const lines = g.orders.flatMap((o) => o.lines);
    const first = g.orders[0];
    return [
      shortDate(first.orderedOn),
      g.orders.length > 1 ? `${vendorName(first.vendorId)} 외 ${g.orders.length - 1}` : vendorName(first.vendorId),
      first.projectCode,
      lines.length > 1 ? `${lines[0].nameAtOrder} 외 ${lines.length - 1}` : (lines[0]?.nameAtOrder ?? "—"),
      { progress: { value: g.orders.reduce((s, o) => s + orderReceived(o), 0), total: g.orders.reduce((s, o) => s + orderOrdered(o), 0) } },
      statusCell(g.status),
    ];
  });

  const editingOrder = state.orders.find((o) => o.poNo === editing);
  const dirty = editingOrder !== undefined && Object.values(draft).some((d) => qtyOf(d) > 0 || d.note.trim() !== "" || d.judgement === "fail");

  /** 편집 중인 입력을 버려도 되는지 한 번 묻고 진행 */
  function guard(go: () => void) {
    if (dirty) setConfirm({ kind: "discard", then: go });
    else go();
  }

  function stopEdit() {
    setEditing(null);
    setErrors({});
  }

  /** 접을 때만 묻는다 — 다른 줄을 열어도 편집 중인 줄은 그대로 열려 있다 */
  function toggleRow(i: number) {
    const g = groups[i];
    if (!expanded.includes(g.key)) {
      setExpanded((cur) => [...cur, g.key]);
      return;
    }
    const collapse = () => setExpanded((cur) => cur.filter((k) => k !== g.key));
    if (!g.orders.some((o) => o.poNo === editing)) return collapse();
    guard(() => {
      stopEdit();
      collapse();
    });
  }

  function startEdit(order: PurchaseOrder) {
    guard(() => {
      setDraft(emptyDraft(order.lines));
      setErrors({});
      setEditing(order.poNo);
    });
  }

  /** 잔량이 남은 라인의 입고를 잔량으로 — 전량 입고가 대부분인 실무의 기본 동작 */
  function fillAll(order: PurchaseOrder) {
    setDraft((prev) => Object.fromEntries(order.lines.map((l) => [l.no, { ...prev[l.no], qty: lineRemaining(l) > 0 ? String(lineRemaining(l)) : prev[l.no].qty }])));
    setErrors({});
  }

  /** 발주처 한 곳 — 이 발주 한 장 */
  function printOne(order: PurchaseOrder) {
    downloadCsv(`발주서_${vendorName(order.vendorId)}_${order.poNo}.csv`, [
      ["발주서"],
      ["발주번호", order.poNo, "", "발주처", vendorName(order.vendorId)],
      ["관리번호", order.projectCode, "", "근거 도면", `${order.drawing} ${order.rev}`],
      [],
      ["No.", "품목명", "사양", "규격", "수량"],
      ...order.lines.map((l) => [l.no, l.nameAtOrder, l.specAtOrder, l.sizeAtOrder, String(l.ordered)]),
    ]);
    notify(`${vendorName(order.vendorId)} 발주서를 내보냈어요`);
  }

  /** 전체 — 이 묶음의 발주 전부를 한 장에(발주처 · 발주번호 열 포함) */
  function printAll(group: OrderGroup) {
    const first = group.orders[0];
    let no = 0;
    downloadCsv(`발주서_${first.projectCode.replace(/\s+/g, "")}_전체.csv`, [
      ["발주서 · 전체"],
      ["관리번호", first.projectCode, "", "근거 도면", `${first.drawing} ${first.rev}`],
      [],
      ["No.", "품목명", "사양", "규격", "수량", "발주처", "발주번호"],
      ...group.orders.flatMap((o) => o.lines.map((l) => [String(++no), l.nameAtOrder, l.specAtOrder, l.sizeAtOrder, String(l.ordered), vendorName(o.vendorId), o.poNo])),
    ]);
    notify(`${first.projectCode} 발주서 ${group.orders.length}장을 내보냈어요`);
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
      if (over && !d.note.trim()) next[`${line.no}:note`] = `잔량 ${formatQty(rem)} EA보다 ${formatQty(qty - rem)} 많아요 — 사유를 적어 주세요`;
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
      const parts = [pass > 0 ? `입고 ${formatQty(pass)} EA를 등록했어요` : "", fail > 0 ? `불합격 ${formatQty(fail)} EA를 기록했어요` : "", complete ? "검수를 완료했어요" : ""].filter(Boolean);
      notify(parts.join(" · "));
      stopEdit();
    };

    if (complete) {
      const left = entries
        .map((e) => ({ name: e.line.nameAtOrder, rem: Math.max(0, e.rem - (e.d.judgement === "pass" ? e.qty : 0)) }))
        .filter((x) => x.rem > 0);
      if (left.length > 0) {
        const overs = active.filter((e) => e.d.judgement === "pass" && e.qty > e.rem).map((e) => `${e.line.nameAtOrder} 초과 +${formatQty(e.qty - e.rem)}`);
        const detail = [
          `취소로 남는 잔량: ${left.map((x) => `${x.name} ${formatQty(x.rem)} EA`).join(" · ")}.`,
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

  /** 발주처 한 곳의 입고 등록 폼 — 읽는 열(발주 · 기입고 · 잔량) ‖ 적는 열(입고 · 판정 · 조치사항) */
  function renderForm(order: PurchaseOrder) {
    const firstOpen = order.lines.findIndex((l) => lineRemaining(l) > 0);
    return (
      <form
        className="fade-in max-w-[960px] space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          save(order, false);
        }}
      >
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th scope="col" className="py-2 pr-3">품목명</th>
                <th scope="col" className="px-3 py-2">사양</th>
                <th scope="col" className="px-3 py-2">규격</th>
                <th scope="col" className="px-3 py-2 text-right">발주</th>
                <th scope="col" className="px-3 py-2 text-right">기입고</th>
                <th scope="col" className="px-3 py-2 text-right">잔량</th>
                <th scope="col" className="w-28 border-l border-slate-200 py-2 pl-4 pr-3">입고</th>
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
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{l.specAtOrder || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{l.sizeAtOrder || "—"}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{formatQty(l.ordered)}</td>
                    <td className={`px-3 py-2 text-right ${l.received === 0 ? "text-slate-500" : "text-slate-600"}`}>{formatQty(l.received)}</td>
                    <td className={`px-3 py-2 text-right ${rem > 0 ? "font-semibold text-slate-900" : "text-slate-500"}`}>{formatQty(rem)}</td>
                    {rem === 0 ? (
                      // 받을 게 없는 라인은 입력을 열지 않는다 — 초과분은 잔량이 남은 라인에서 사유와 함께
                      <td colSpan={3} className="border-l border-slate-200 py-2 pl-4 text-[13px] leading-8 text-slate-500">
                        받을 수량 없음
                      </td>
                    ) : (
                      <>
                        <td className="w-28 border-l border-slate-200 py-2 pl-4 pr-3">
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            autoFocus={k === firstOpen}
                            aria-label={`${l.nameAtOrder} 입고`}
                            aria-invalid={!!qtyErr || over || undefined}
                            value={d.qty}
                            onChange={(e) => set({ qty: e.target.value })}
                            className={`${qtyErr || over ? FIELD_SM_ERROR : FIELD_SM} ${NUM} w-20 text-right`}
                          />
                          {qtyErr ? (
                            <p className="mt-1 text-xs text-red-600">{qtyErr}</p>
                          ) : over ? (
                            <p className="mt-1 whitespace-nowrap text-xs text-amber-700">잔량보다 {formatQty(qty - rem)} 많아요</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <Segmented size="sm" options={JUDGEMENT_OPTIONS} value={d.judgement} onChange={(v) => set({ judgement: v })} label={`${l.nameAtOrder} 판정`} />
                        </td>
                        <td className="py-2 pl-3">
                          <input
                            aria-label={`${l.nameAtOrder} 조치사항`}
                            aria-invalid={!!noteErr || undefined}
                            value={d.note}
                            onChange={(e) => set({ note: e.target.value })}
                            placeholder={over || d.judgement === "fail" ? "사유" : undefined}
                            className={`${noteErr ? FIELD_SM_ERROR : FIELD_SM} w-[260px]`}
                          />
                          {noteErr && <p className="mt-1 max-w-[260px] text-xs text-red-600">{noteErr}</p>}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {firstOpen >= 0 && (
              <Button type="button" size="sm" variant="secondary" onClick={() => fillAll(order)}>
                잔량 전부 채우기
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {errors._form && (
              <p className="text-xs text-red-600" role="alert">
                {errors._form}
              </p>
            )}
            <Button type="button" size="sm" variant="secondary" onClick={() => guard(stopEdit)}>
              닫기
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => save(order, true)}>
              검수 완료
            </Button>
            <Button type="submit" size="sm">
              저장
            </Button>
          </div>
        </div>
      </form>
    );
  }

  /** 발주처 한 곳의 라인 표 — 읽기 */
  function renderLines(order: PurchaseOrder) {
    return (
      <DataTable
        dense
        data={{
          columns: LINE_COLUMNS,
          rows: order.lines.map((l) => {
            const rem = lineRemaining(l);
            const judgement: Cell = l.judgement === "fail" ? { badge: "불합격", tone: "red" } : l.judgement === "pass" ? "합격" : "대기";
            return [l.nameAtOrder, l.specAtOrder || "—", l.sizeAtOrder || "—", formatQty(l.ordered), formatQty(l.received), order.closedOn && rem > 0 ? `취소 ${formatQty(rem)}` : formatQty(rem), judgement, l.note || "—"];
          }),
        }}
        colAlign={[...LINE_ALIGN]}
        // 합격 · 잔량 0 라인은 셀 전부 내림. 잔량이 남은 라인은 잔량만 강조
        rowEmphasis={(_, k) => (lineRemaining(order.lines[k]) === 0 && order.lines[k].judgement === "pass" ? "down" : undefined)}
        emphasisAt={(row, k, j) => {
          if (j === 5) return !order.closedOn && lineRemaining(order.lines[k]) > 0 ? "em" : "down";
          if (row[j] === "—" || row[j] === "합격" || row[j] === "대기" || row[j] === "0") return "down";
          return undefined;
        }}
      />
    );
  }

  function renderPanel(i: number) {
    const group = groups[i];
    const first = group.orders[0];
    const mismatch = revMismatch(first, poDrawings);
    const drawingRev = poDrawings.find((d) => d.code === first.drawing)?.rev;
    const printable = group.orders.filter((o) => vendorOf(o.vendorId)?.kind !== "inhouse");
    const many = group.orders.length > 1;

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            <span className="mr-2 font-semibold text-slate-900">발주</span>
            {first.drawing ? `도면 ${first.drawing} ${first.rev}` : "도면 없이 작성"}
          </p>
          {canPurchase && printable.length > 0 && (
            <MenuButton
              size="sm"
              menuLabel="발주서 출력"
              label={
                <>
                  <IconDownload size={14} />
                  발주서 출력
                </>
              }
              items={[
                ...printable.map((o) => ({ label: `${vendorName(o.vendorId)} 발주서`, onClick: () => printOne(o) })),
                ...(many
                  ? [
                      {
                        label: (
                          <>
                            {first.projectCode} 전체 발주서<span className="ml-1.5 text-slate-500">{group.orders.length}장</span>
                          </>
                        ),
                        onClick: () => printAll(group),
                      },
                    ]
                  : []),
              ]}
            />
          )}
        </div>
        {mismatch && (
          <p className="flex items-center gap-1.5 text-sm text-amber-700">
            <IconAlertTriangle size={14} className="shrink-0" />
            발주는 {first.rev} · 도면은 지금 {drawingRev} — 라인 규격을 확인해 주세요
          </p>
        )}

        {group.orders.map((order, k) => {
          const status = orderStatus(order, state.vendors, state.today);
          const isEditing = editing === order.poNo;
          return (
            // 발주처 한 곳 = 한 덩어리. 여럿이면 사이에 실선
            <section key={order.poNo} className={`space-y-2 ${k > 0 ? "border-t border-slate-200 pt-4" : ""}`} aria-label={`${vendorName(order.vendorId)} 발주`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm">
                    <span className="font-semibold text-slate-900">{vendorName(order.vendorId)}</span>
                    <span className={`ml-2 ${status.kind === "overdue" ? `font-semibold ${TONE_TEXT.red}` : "text-slate-500"}`}>
                      {status.kind === "overdue" ? `${status.days}일 경과` : status.kind === "waiting" ? "대기" : "입고 완료"}
                    </span>
                    {order.closedOn && <span className="ml-2 text-slate-500">{shortDate(order.closedOn)} 마감</span>}
                  </p>
                  {/* secondary — 여러 줄 · 여러 발주처가 동시에 열리면 파란 버튼이 줄마다 생긴다. 파랑은 편집 중 「저장」 하나 */}
                  {canReceive && status.kind !== "done" && !isEditing && (
                    <Button size="sm" variant="secondary" onClick={() => startEdit(order)}>
                      입고 등록
                    </Button>
                  )}
                </div>
                {isEditing ? renderForm(order) : renderLines(order)}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-slate-900">발주 현황</h2>
          <CardTools search={{ value: query, onChange: setQuery, placeholder: "품목명 · 발주처 · 관리번호로 찾기" }}>
            {canPurchase && (
              <Button variant="secondary" onClick={() => setEditor((n) => n + 1)}>
                발주서 만들기
              </Button>
            )}
          </CardTools>
        </div>
        <DataTable
          data={{ columns: COLUMNS, rows }}
          emptyText={query.trim() ? "검색 결과가 없어요" : "발주가 없어요"}
          // 강조는 상태 셀(기한 넘김)에만. 입고 완료는 지나간 줄 — 한 단 더 옅게
          rowEmphasis={(_, i) => (groups[i].status.kind === "done" ? "faint" : undefined)}
          onRowClick={toggleRow}
          expandedRows={expandedRows}
          renderExpanded={renderPanel}
        />
      </Card>

      {editor > 0 && <OrderEditor key={editor} onClose={() => setEditor(0)} />}

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
