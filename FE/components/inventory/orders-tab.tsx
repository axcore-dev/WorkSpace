"use client";

import { useState } from "react";
import { Card, DataTable } from "@/components/ui";
import type { Cell } from "@/data/types";
import { orderOrdered, orderReceived, orderSort, orderStatus, type OrderStatus } from "@/lib/inventory-state";
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

/**
 * 발주·입고 — 발주 라인이 입고 · 판정을 직접 갖는 한 표. 할 일 순으로 정렬하고 끝난 행은 전부 내림.
 * Phase 1 은 표만 — 행 펼침 · 입고 등록 · 발주 전 작업 줄은 Phase 2.
 */
export function OrdersTab() {
  const { state } = useInventory();
  const [query, setQuery] = useState("");

  const vendorName = (id: string) => state.vendors.find((v) => v.id === id)?.name ?? "—";
  const q = query.trim().toLowerCase();
  const orders = orderSort(state.orders, state.vendors, state.today).filter(
    (o) => !q || [o.poNo, vendorName(o.vendorId), o.projectCode].some((s) => s.toLowerCase().includes(q)),
  );
  const statuses = orders.map((o) => orderStatus(o, state.vendors, state.today));

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

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-slate-900">발주 현황</h2>
        <CardTools search={{ value: query, onChange: setQuery, placeholder: "발주번호 · 발주처 · 관리번호로 찾기" }} />
      </div>
      <DataTable
        data={{ columns: COLUMNS, rows }}
        emphasis={[undefined, undefined, undefined, undefined, undefined, "em"]}
        rowEmphasis={(_, i) => (statuses[i].kind === "done" ? "down" : undefined)}
      />
    </Card>
  );
}
