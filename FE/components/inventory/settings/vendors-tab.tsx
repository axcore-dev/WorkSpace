"use client";

import { useState } from "react";
import { Button, Card, DataTable } from "@/components/ui";
import { VENDOR_KIND_LABEL, type Vendor } from "@/data/inventory";
import type { Cell } from "@/data/types";
import { matchesQuery } from "@/lib/search";
import { CardTools } from "../card-tools";
import { useInventory } from "../inventory-provider";
import { VendorModal } from "../vendor-modal";

const COLUMNS = ["거래처명", "구분", "이니셜", "리드타임", "담당자", "상태"];
const LEAD_COL = 3;

/** 거래처 — 설정 화면. 리드타임이 빈 거래처(「만들기」로 생긴 것)는 그 칸이 강조로 떠서 채우게 한다. 행 클릭 → 수정 팝업 */
export function VendorsTab() {
  const { state } = useInventory();
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<{ seq: number; vendor: Vendor | null } | null>(null);

  const vendors = state.vendors.filter((v) => matchesQuery(query, [v.name, v.initial, v.owner, VENDOR_KIND_LABEL[v.kind]]));

  const rows: Cell[][] = vendors.map((v) => [
    v.name,
    VENDOR_KIND_LABEL[v.kind],
    v.initial || "—",
    v.kind === "inhouse" ? "—" : v.leadTimeDays === null ? "미입력" : `${v.leadTimeDays}일`,
    v.owner || "—",
    v.active ? "거래 중" : "거래 중지",
  ]);

  return (
    <>
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-slate-900">거래처</h2>
          <CardTools search={{ value: query, onChange: setQuery, placeholder: "거래처명 · 이니셜 · 담당자로 찾기" }}>
            <Button size="sm" variant="secondary" onClick={() => setModal({ seq: Date.now(), vendor: null })}>
              거래처 등록
            </Button>
          </CardTools>
        </div>
        <DataTable
          data={{ columns: COLUMNS, rows }}
          emptyText={query.trim() ? "검색 결과가 없어요" : "등록된 거래처가 없어요"}
          rowEmphasis={(_, k) => (vendors[k].active ? undefined : "down")}
          emphasisAt={(row, _, j) => (row[j] === "—" ? "down" : j === LEAD_COL && row[j] === "미입력" ? "em" : undefined)}
          onRowClick={(k) => setModal({ seq: Date.now(), vendor: vendors[k] })}
        />
      </Card>

      {modal && <VendorModal key={modal.seq} vendor={modal.vendor} onClose={() => setModal(null)} />}
    </>
  );
}
