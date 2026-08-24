"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import { Badge, Button, Card, DataTable, FIELD, SectionHeader, WizardSteps } from "@/components/ui";
import {
  IconAlertTriangle,
  IconCheckCircle,
  IconDownload,
  IconPlus,
} from "@/components/icons";
import { downloadCsv } from "@/lib/download";
import {
  PO_BOM,
  PO_DRAWINGS,
  PURCHASE_ORDERS,
  type PoDrawing,
  type PoStatus,
  type PurchaseOrderRow,
} from "@/data/purchasing";
import type { Tone } from "@/data/types";

const STATUS_TONE: Record<PoStatus, Tone> = {
  발주: "slate",
  "부분 입고": "amber",
  "입고 완료": "green",
  지연: "red",
};

const STEPS = ["도면(BOM) 선택", "수량 확인", "발주서 출력"];

export function PurchaseOrder({ onOpenTab }: { onOpenTab?: (tabId: string, query?: string) => void }) {
  const [orders, setOrders] = useState<PurchaseOrderRow[]>(PURCHASE_ORDERS);
  const [openPo, setOpenPo] = useState<string | null>(null);
  const detail = orders.find((o) => o.poNo === openPo) ?? null;

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [picked, setPicked] = useState<PoDrawing | null>(null);
  /** 품목 키 → 발주 수량 (사용자 수정 가능) */
  const [qty, setQty] = useState<Record<string, number>>({});
  const [registered, setRegistered] = useState<string[] | null>(null);

  const needs = useMemo(() => (picked ? (PO_BOM[picked.code] ?? []) : []), [picked]);
  const keyOf = (n: { itemName: string; size: string }) => `${n.itemName}|${n.size}`;

  /** 발주처별로 분리 — 이후 검수 카드 단위가 된다 (FR-PO-07) */
  const bySupplier = useMemo(() => {
    const m = new Map<string, { key: string; itemName: string; spec: string; size: string; order: number }[]>();
    for (const n of needs) {
      const order = qty[keyOf(n)] ?? Math.max(0, n.need - n.stock);
      if (order <= 0) continue;
      const list = m.get(n.supplier) ?? [];
      list.push({ key: keyOf(n), itemName: n.itemName, spec: n.spec, size: n.size, order });
      m.set(n.supplier, list);
    }
    return [...m.entries()];
  }, [needs, qty]);

  function reset() {
    setOpen(false);
    setStep(1);
    setPicked(null);
    setQty({});
    setRegistered(null);
  }

  function pick(d: PoDrawing) {
    setPicked(d);
    const init: Record<string, number> = {};
    for (const n of PO_BOM[d.code] ?? []) init[keyOf(n)] = Math.max(0, n.need - n.stock);
    setQty(init);
  }

  function exportExcel(supplier: string, lines: { itemName: string; spec: string; size: string; order: number }[]) {
    if (!picked) return;
    downloadCsv(`발주서_${picked.projectCode.replace(/\s/g, "")}_${supplier}.csv`, [
      ["발주서"],
      ["관리번호", picked.projectCode, "", "발주처", supplier],
      ["차종/품번", picked.vehicle, "", "근거 도면", `${picked.code} ${picked.rev}`],
      [],
      ["No.", "품명", "호칭", "규격", "수량"],
      ...lines.map((l, i) => [String(i + 1), l.itemName, l.spec, l.size, String(l.order)]),
      [],
      ["합계", "", "", "", String(lines.reduce((a, b) => a + b.order, 0))],
    ]);
  }

  /** 발주처별로 발주번호를 채번해 목록에 등록 (FR-PO-01) */
  function register() {
    if (!picked) return;
    const base = orders.length;
    const created = bySupplier.map(([supplier, lines], i) => ({
      poNo: `PO-2608-${String(base + i + 1).padStart(4, "0")}`,
      orderedOn: "2026-08-20",
      supplier,
      projectCode: picked.projectCode,
      drawing: picked.code,
      rev: picked.rev,
      requester: "구매 담당",
      status: "발주" as PoStatus,
      lines: lines.map((l) => ({ itemName: l.itemName, spec: l.spec, size: l.size, qty: l.order })),
    }));
    setOrders((prev) => [...created, ...prev]);
    setRegistered(created.map((c) => `${c.poNo} (${c.supplier})`));
  }

  const blocked = !!picked && picked.unmapped > 0;
  const totalOrder = bySupplier.reduce((a, [, l]) => a + l.reduce((x, y) => x + y.order, 0), 0);

  return (
    <div className="space-y-4">
      <Card padding={false}>
        <div className="px-5 pt-5">
          <SectionHeader
            title="발주 현황"
            action={
              <Button size="sm" onClick={() => setOpen(true)}>
                <IconPlus size={14} />
                발주서 작성
              </Button>
            }
          />
        </div>
        <div className="px-5 pb-5">
          <DataTable
            data={{
              columns: ["발주번호", "발주일자", "발주처", "관리번호", "근거 도면", "품목", "요청자", "상태"],
              rows: orders.map((o) => [
                o.poNo,
                o.orderedOn,
                o.supplier,
                o.projectCode,
                `${o.drawing} ${o.rev}`,
                `${o.lines.length}품목 ${o.lines.reduce((a, b) => a + b.qty, 0)} EA`,
                o.requester,
                { badge: o.status, tone: STATUS_TONE[o.status] },
              ]),
            }}
            onRowClick={(i) => setOpenPo(orders[i].poNo)}
          />
        </div>
      </Card>

      <Modal
        open={!!detail}
        onClose={() => setOpenPo(null)}
        size="lg"
        title={detail ? `${detail.poNo} · ${detail.supplier}` : ""}
        footer={
          detail && (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpenPo(null)}>
                닫기
              </Button>
              {detail.status !== "입고 완료" && onOpenTab && (
                <Button
                  onClick={() => {
                    const code = detail.projectCode;
                    setOpenPo(null);
                    onOpenTab("receiving", code);
                  }}
                >
                  입고 등록
                </Button>
              )}
            </div>
          )
        }
      >
        {detail && (
          <div className="space-y-4 p-5">
            <dl className="grid gap-x-6 gap-y-2 rounded-lg border border-slate-200 px-4 py-3 sm:grid-cols-2">
              {[
                ["발주일자", detail.orderedOn],
                ["관리번호", detail.projectCode],
                ["근거 도면", `${detail.drawing} ${detail.rev}`],
                ["요청자", detail.requester],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start gap-3">
                  <dt className="w-20 shrink-0 text-sm text-slate-400">{k}</dt>
                  <dd className="min-w-0 flex-1 text-sm text-slate-800">{v}</dd>
                </div>
              ))}
            </dl>
            <DataTable
              dense
              data={{
                columns: ["품목명", "사양", "규격", "수량"],
                rows: detail.lines.map((l) => [l.itemName, l.spec, l.size, `${l.qty} EA`]),
              }}
            />
            <Badge tone={STATUS_TONE[detail.status]}>{detail.status}</Badge>
          </div>
        )}
      </Modal>

      <Modal
        open={open}
        onClose={reset}
        size="xl"
        title="발주서 작성"
        footer={
          registered ? (
            <div className="flex justify-end">
              <Button onClick={reset}>확인</Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                {step === 2 && `발주 대상 ${bySupplier.length}개 업체 · 총 ${totalOrder} EA`}
                {step === 3 && "발주처별로 분리해 출력됩니다"}
              </span>
              <div className="flex gap-2">
                {step > 1 && (
                  <Button variant="secondary" onClick={() => setStep(step - 1)}>
                    이전
                  </Button>
                )}
                {step < 3 ? (
                  <Button onClick={() => setStep(step + 1)} disabled={!picked || blocked || (step === 2 && totalOrder === 0)}>
                    다음
                  </Button>
                ) : (
                  <Button onClick={register} disabled={totalOrder === 0}>
                    발주 등록
                  </Button>
                )}
              </div>
            </div>
          )
        }
      >
        {registered ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <IconCheckCircle size={40} className="text-emerald-600" />
            <p className="mt-3 text-sm font-semibold text-slate-900">발주가 등록되었습니다</p>
            <p className="mt-1 max-w-md text-sm text-slate-500">{registered.join(" · ")}</p>
            <p className="mt-2 max-w-md text-xs text-slate-400">
              등록된 발주는 입고·수입검사 화면의 입고 대기 목록에 나타납니다.
            </p>
          </div>
        ) : (
          <>
            <WizardSteps steps={STEPS} current={step} />

            {step === 1 && (
              <div className="space-y-3 p-5">
                <p className="text-sm text-slate-500">발주 근거가 될 도면과 리비전을 선택하세요.</p>
                <ul className="space-y-2" role="radiogroup" aria-label="발주 대상 도면">
                  {PO_DRAWINGS.map((d) => {
                    const active = picked?.code === d.code;
                    return (
                      <li key={d.code}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => pick(d)}
                          className={`flex w-full cursor-pointer items-center gap-3 rounded-lg border p-3.5 text-left transition-colors duration-150 ${
                            active
                              ? "border-slate-400 bg-slate-50 ring-1 ring-slate-300"
                              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-slate-900">
                              {d.code} {d.rev}
                            </span>
                            <span className="block truncate text-xs text-slate-500">
                              {d.name} · {d.projectCode} · {d.vehicle}
                            </span>
                          </span>
                          {d.unmapped > 0 ? (
                            <Badge tone="red">미매핑 {d.unmapped}건</Badge>
                          ) : (
                            <Badge tone="green">발주 가능</Badge>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {blocked && (
                  <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
                    품목 마스터에 매핑되지 않은 BOM 항목이 {picked?.unmapped}건 있습니다. 제품설계 &gt; BOM 관리에서
                    매핑을 마친 뒤 발주할 수 있습니다.
                  </p>
                )}
              </div>
            )}

            {step === 2 && picked && (
              <div className="space-y-3 p-5">
                <p className="text-sm text-slate-500">
                  {picked.code} {picked.rev} 기준 소요량에서 현재 재고를 차감한 수량입니다. 필요하면 직접 수정하세요.
                </p>
                <div className="thin-scroll overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-medium text-slate-400">
                        <th scope="col" className="py-2.5 pr-3">품목명</th>
                        <th scope="col" className="px-3 py-2.5">사양</th>
                        <th scope="col" className="px-3 py-2.5">규격</th>
                        <th scope="col" className="px-3 py-2.5 text-right">소요</th>
                        <th scope="col" className="px-3 py-2.5 text-right">재고</th>
                        <th scope="col" className="px-3 py-2.5 text-right">발주</th>
                        <th scope="col" className="py-2.5 pl-3">발주처</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {needs.map((n) => {
                        const k = keyOf(n);
                        return (
                          <tr key={k}>
                            <td className="py-2.5 pr-3 font-medium text-slate-900">{n.itemName}</td>
                            <td className="px-3 py-2.5 text-slate-600">{n.spec}</td>
                            <td className="px-3 py-2.5 text-slate-600">{n.size}</td>
                            <td className="px-3 py-2.5 text-right text-slate-600">{n.need}</td>
                            <td className="px-3 py-2.5 text-right text-slate-600">{n.stock}</td>
                            <td className="px-3 py-2.5">
                              {/* FIELD 가 w-full 이라 고정폭 래퍼로 감싼다 */}
                              <div className="ml-auto w-24">
                                <input
                                  type="number"
                                  min={0}
                                  aria-label={`${n.itemName} 발주 수량`}
                                  value={qty[k] ?? 0}
                                  onChange={(e) => setQty({ ...qty, [k]: Math.max(0, Number(e.target.value) || 0) })}
                                  className={`${FIELD} h-9 py-0 text-right`}
                                />
                              </div>
                            </td>
                            <td className="py-2.5 pl-3 text-slate-600">{n.supplier}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-400">
                  잔여 재고는 자동으로 차감됩니다. 발주 수량이 0인 품목은 발주서에 포함되지 않습니다.
                </p>
              </div>
            )}

            {step === 3 && picked && (
              <div className="space-y-4 p-5">
                <p className="text-sm text-slate-500">
                  발주처별로 나누어 발주서를 생성합니다. 이 분리 단위가 이후 수입검사의 검수 카드 단위가 됩니다.
                </p>
                {bySupplier.map(([supplier, lines]) => (
                  <Card key={supplier}>
                    <SectionHeader
                      title={`${supplier} · ${lines.length}품목 ${lines.reduce((a, b) => a + b.order, 0)} EA`}
                      action={
                        <Button size="sm" variant="secondary" onClick={() => exportExcel(supplier, lines)}>
                          <IconDownload size={14} />
                          엑셀 출력
                        </Button>
                      }
                    />
                    <DataTable
                      dense
                      data={{
                        columns: ["품목명", "사양", "규격", "발주 수량"],
                        rows: lines.map((l) => [l.itemName, l.spec, l.size, `${l.order} EA`]),
                      }}
                    />
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
