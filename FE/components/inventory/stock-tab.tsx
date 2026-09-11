"use client";

import { useState } from "react";
import { Card, DataTable } from "@/components/ui";
import type { Cell } from "@/data/types";
import { downloadCsv } from "@/lib/download";
import { safetyOf, shortage, stockBreakdown } from "@/lib/inventory-state";
import { CardTools } from "./card-tools";
import { useInventory } from "./inventory-provider";

const COLUMNS = ["품목명", "사양/시리즈", "규격", "기초 재고", "입고", "출고", "조정", "현재 재고", "안전 기준"];
const STOCK_COL = 7;
const SAFETY_COL = 8;

/**
 * 현재 재고 — 저장된 값이 아니라 `기초 + 입고 − 출고 + 조정` 파생값이다.
 * 0 은 내림. 기준 미달 행만 현재 재고 강조 + 안전 기준 셀 `N에 M 모자람`(red).
 * Phase 1 은 표만 — 행 펼침(이력 · 기준 바꾸기 · 조정 추가)은 Phase 3.
 */
export function StockTab() {
  const { state, notify } = useInventory();
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const items = state.items.filter((i) => !i.discontinued).filter((i) => !q || [i.name, i.spec, i.size, i.code].some((s) => s.toLowerCase().includes(q)));

  const derived = items.map((i) => {
    const b = stockBreakdown(i.code, state.movements, state.standards);
    const safety = safetyOf(i, state);
    return { b, safety, short: shortage(b.stock, safety) };
  });

  const rows: Cell[][] = items.map((i, k) => {
    const { b, safety, short } = derived[k];
    const safetyCell: Cell =
      safety === null ? "미설정" : short && short > 0 ? { badge: `${safety}에 ${short} 모자람`, tone: "red" } : `${safety} · 충족`;
    return [i.name, i.spec, i.size, String(b.baseline), String(b.in), String(b.out), String(b.adjust), String(b.stock), safetyCell];
  });

  function exportCsv() {
    downloadCsv("재고물류_현재재고.csv", [COLUMNS, ...rows]);
    notify(`재고 ${rows.length}품목을 내보냈어요`);
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-slate-900">현재 재고</h2>
        <CardTools search={{ value: query, onChange: setQuery, placeholder: "품목명 · 규격 · 코드로 찾기" }} onExport={exportCsv} />
      </div>
      <DataTable
        data={{ columns: COLUMNS, rows }}
        colAlign={["left", "left", "left", "right", "right", "right", "right", "right", "left"]}
        emphasisAt={(row, k, j) => {
          if (j === STOCK_COL) return derived[k].short ? "em" : undefined;
          if (j === SAFETY_COL) return typeof row[j] === "string" ? "down" : undefined;
          if (j >= 3 && row[j] === "0") return "down";
          return undefined;
        }}
      />
    </Card>
  );
}
