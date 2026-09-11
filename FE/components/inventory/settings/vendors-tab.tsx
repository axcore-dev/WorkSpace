"use client";

import { useState } from "react";
import { Card, DataTable } from "@/components/ui";
import type { VendorKind } from "@/data/inventory";
import type { Cell } from "@/data/types";
import { CardTools } from "../card-tools";
import { useInventory } from "../inventory-provider";

export const VENDOR_KIND_LABEL: Record<VendorKind, string> = { parts: "자재·부품", material: "소재", outsourcing: "외주 가공", inhouse: "자체 제작" };

const COLUMNS = ["거래처명", "구분", "이니셜", "리드타임", "담당자", "상태"];
const LEAD_COL = 3;

/** 거래처 — 설정 화면. 리드타임이 빈 거래처(「만들기」로 생긴 것)는 그 칸이 강조로 뜬다. Phase 1 은 표만 */
export function VendorsTab() {
  const { state } = useInventory();
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const vendors = state.vendors.filter((v) => !q || [v.name, v.initial, v.owner, VENDOR_KIND_LABEL[v.kind]].some((s) => s.toLowerCase().includes(q)));

  const rows: Cell[][] = vendors.map((v) => [
    v.name,
    VENDOR_KIND_LABEL[v.kind],
    v.initial || "—",
    v.kind === "inhouse" ? "—" : v.leadTimeDays === null ? "미입력" : `${v.leadTimeDays}일`,
    v.owner || "—",
    v.active ? "거래 중" : "거래 중지",
  ]);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-slate-900">거래처</h2>
        <CardTools search={{ value: query, onChange: setQuery, placeholder: "거래처명 · 이니셜 · 담당자로 찾기" }} />
      </div>
      <DataTable
        data={{ columns: COLUMNS, rows }}
        rowEmphasis={(_, k) => (vendors[k].active ? undefined : "down")}
        emphasisAt={(row, _, j) => (row[j] === "—" ? "down" : j === LEAD_COL && row[j] === "미입력" ? "em" : undefined)}
      />
    </Card>
  );
}
