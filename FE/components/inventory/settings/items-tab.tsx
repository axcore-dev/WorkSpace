"use client";

import { useState } from "react";
import { Card, DataTable } from "@/components/ui";
import type { Cell } from "@/data/types";
import { CardTools } from "../card-tools";
import { useInventory } from "../inventory-provider";

const COLUMNS = ["품목 코드", "품목명", "사양", "규격", "단위", "분류", "거래처", "보관 위치", "상태"];

/** 품목 마스터 — 설정 화면. Phase 1 은 표만 — 「등록 ▾」 · 수정 팝업 · 다중 선택은 Phase 4 */
export function ItemsTab() {
  const { state } = useInventory();
  const [query, setQuery] = useState("");

  const vendorName = (id: string) => state.vendors.find((v) => v.id === id)?.name ?? "—";
  const q = query.trim().toLowerCase();
  const items = state.items.filter((i) => !q || [i.code, i.name, i.spec, i.size, i.category, i.location].some((s) => s.toLowerCase().includes(q)));

  const rows: Cell[][] = items.map((i) => [
    i.code,
    i.name,
    i.spec,
    i.size,
    i.unit,
    i.category,
    i.vendorIds.length > 1 ? `${vendorName(i.vendorIds[0])} +${i.vendorIds.length - 1}` : vendorName(i.vendorIds[0] ?? ""),
    i.location || "—",
    i.discontinued ? "단종" : "사용",
  ]);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-[15px] font-semibold text-slate-900">품목 마스터</h2>
          {/* 제품설계 완성 뒤 연결한다 — 지금은 자리만 알린다 */}
          <span className="rounded px-1.5 py-0.5 text-xs text-slate-500 ring-1 ring-inset ring-slate-200">도면(BOM) 자동 연동 · 준비 중</span>
        </div>
        <CardTools search={{ value: query, onChange: setQuery, placeholder: "코드 · 품목명 · 규격으로 찾기" }} />
      </div>
      <DataTable data={{ columns: COLUMNS, rows }} rowEmphasis={(_, k) => (items[k].discontinued ? "down" : undefined)} />
    </Card>
  );
}
