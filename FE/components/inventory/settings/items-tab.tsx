"use client";

import { useState } from "react";
import { IconUpload } from "@/components/icons";
import { Button, Card, DataTable } from "@/components/ui";
import type { Item } from "@/data/inventory";
import type { Cell } from "@/data/types";
import { matchesQuery } from "@/lib/search";
import { CardTools } from "../card-tools";
import { useInventory } from "../inventory-provider";
import { ItemImportModal } from "../item-import-modal";
import { ItemModal } from "../item-modal";

/** 품목 코드는 표에 없다 — 실무에서 코드로 품목을 부르지 않는다. 수정 팝업 · 엑셀 양식에만 있다 */
const COLUMNS = ["품목명", "사양", "규격", "단위", "분류", "거래처", "보관 위치", "상태"];

/**
 * 품목 마스터 — 설정 화면. 카드 머리 [품목 추가](한 건) · [품목 한 번에 등록하기](엑셀, 이 화면의 primary 하나) +
 * 행 클릭 → 수정 팝업(저장 시 자동 닫힘 + 토스트). 양식 받기는 등록 팝업 안 링크에만 둔다.
 */
export function ItemsTab() {
  const { state } = useInventory();
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<{ seq: number; item: Item | null } | null>(null);
  const [importing, setImporting] = useState(false);

  const vendorName = (id: string) => state.vendors.find((v) => v.id === id)?.name ?? "—";
  // 코드는 안내하지 않지만 쳐도 찾힌다(양식 · 다른 시스템에서 코드를 보고 찾을 때)
  const items = state.items.filter((i) => matchesQuery(query, [i.code, i.name, i.spec, i.size, i.category, i.location, ...i.vendorIds.map(vendorName)]));

  const rows: Cell[][] = items.map((i) => [
    i.name,
    i.spec || "—",
    i.size || "—",
    i.unit,
    i.category || "—",
    i.vendorIds.length > 1 ? `${vendorName(i.vendorIds[0])} +${i.vendorIds.length - 1}` : vendorName(i.vendorIds[0] ?? ""),
    i.location || "—",
    i.discontinued ? "단종" : "사용",
  ]);

  return (
    <>
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-slate-900">품목 마스터</h2>
          <CardTools search={{ value: query, onChange: setQuery, placeholder: "품목명 · 규격 · 거래처로 찾기" }}>
            <Button variant="secondary" onClick={() => setModal({ seq: Date.now(), item: null })}>
              품목 추가
            </Button>
            <Button onClick={() => setImporting(true)}>
              <IconUpload size={16} />
              품목 한 번에 등록하기
            </Button>
          </CardTools>
        </div>
        <DataTable
          data={{ columns: COLUMNS, rows }}
          emptyText={query.trim() ? "검색 결과가 없어요" : "등록된 품목이 없어요"}
          rowEmphasis={(_, k) => (items[k].discontinued ? "down" : undefined)}
          emphasisAt={(row, _, j) => (row[j] === "—" ? "down" : undefined)}
          onRowClick={(k) => setModal({ seq: Date.now(), item: items[k] })}
        />
      </Card>

      {modal && <ItemModal key={modal.seq} item={modal.item} onClose={() => setModal(null)} />}
      {importing && <ItemImportModal onClose={() => setImporting(false)} />}
    </>
  );
}
