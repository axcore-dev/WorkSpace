"use client";

import { useState } from "react";
import { Card, DataTable, MenuButton } from "@/components/ui";
import { UploadReviewModal, type UploadRowStatus } from "@/components/upload-review-modal";
import type { Item } from "@/data/inventory";
import { cellText, type Cell } from "@/data/types";
import { liveLatest } from "@/lib/design-state";
import { ITEM_SHEET_COLUMNS, parseItemRows } from "@/lib/inventory-state";
import { matchesQuery } from "@/lib/search";
import { parseSheet } from "@/lib/sheet";
import { CardTools } from "../card-tools";
import { useInventory } from "../inventory-provider";
import { ItemModal } from "../item-modal";

const COLUMNS = ["품목 코드", "품목명", "사양", "규격", "단위", "분류", "거래처", "보관 위치", "상태"];

/**
 * 품목 마스터 — 설정 화면. 「등록 ▾」 하나(엑셀 / 직접) + 행 클릭 → 수정 팝업(저장 시 자동 닫힘 + 토스트).
 * 엑셀은 코드 기준으로 갱신 · 신규 · 오류를 나눠 보이고 오류 행은 빼고 반영한다.
 */
export function ItemsTab() {
  const { state, dispatch, notify } = useInventory();
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<{ seq: number; item: Item | null } | null>(null);
  const [upload, setUpload] = useState(0);

  const vendorName = (id: string) => state.vendors.find((v) => v.id === id)?.name ?? "—";
  const items = state.items.filter((i) => matchesQuery(query, [i.code, i.name, i.spec, i.size, i.category, i.location, ...i.vendorIds.map(vendorName)]));
  // 폐기되지 않은 도면(지금 리비전)의 BOM 줄이 이 품목들을 얼마나 가리키는지
  const bomLines = liveLatest(state.drawings).flatMap((d) => d.bom);
  const bomMapped = bomLines.filter((l) => l.itemCode).length;
  const bomUnmapped = bomLines.length - bomMapped;

  const rows: Cell[][] = items.map((i) => [
    i.code,
    i.name,
    i.spec,
    i.size,
    i.unit,
    i.category || "—",
    i.vendorIds.length > 1 ? `${vendorName(i.vendorIds[0])} +${i.vendorIds.length - 1}` : vendorName(i.vendorIds[0] ?? ""),
    i.location || "—",
    i.discontinued ? "단종" : "사용",
  ]);

  /** 파일 행 → 갱신 · 신규 · 오류 (행 번호로 다시 맞춘다 — 빈 행 · 머리글 오류 포함) */
  function classify(columns: string[], body: string[][]): UploadRowStatus[] {
    const parsed = parseItemRows([columns, ...body], state);
    const byRow = new Map(parsed.map((p) => [p.row, p]));
    const headerError = parsed.length === 1 && parsed[0].row === 1 ? parsed[0].reason : undefined;
    return body.map((_, i) => {
      const p = byRow.get(i + 2);
      return p ? { status: p.status, reason: p.reason } : { status: "error", reason: headerError ?? "빈 행이에요" };
    });
  }

  function approve(cells: Cell[][], columns: string[]) {
    const body = cells.map((r) => r.map(cellText));
    const parsed = parseItemRows([columns, ...body], state).filter((p) => p.item);
    const updates = parsed.filter((p) => p.status === "update").length;
    const creates = parsed.filter((p) => p.status === "create").length;
    void dispatch({ type: "importItems", items: parsed.map((p) => p.item!) }).then((ok) => ok && notify(`품목 ${updates}건을 갱신하고 ${creates}건을 등록했어요`));
  }

  return (
    <>
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-[15px] font-semibold text-slate-900">품목 마스터</h2>
            {/* 제품설계 연동 — 도면 BOM 이 이 품목들을 가리킨다. 미매핑이 남아 있으면 그 도면으로 발주서를 쓸 수 없다 */}
            {state.drawings.length > 0 && (
              <span
                className={`rounded px-1.5 py-0.5 text-xs ring-1 ring-inset ${bomUnmapped > 0 ? "text-amber-700 ring-amber-200" : "text-slate-500 ring-slate-200"}`}
                title="제품설계 > BOM 관리에서 도면의 부품을 품목 마스터와 맺어요"
              >
                도면(BOM) 연동 · 매핑 {bomMapped}건{bomUnmapped > 0 ? ` · 미매핑 ${bomUnmapped}건` : ""}
              </span>
            )}
          </div>
          <CardTools search={{ value: query, onChange: setQuery, placeholder: "코드 · 품목명 · 규격 · 거래처로 찾기" }}>
            <MenuButton
              size="sm"
              label="등록"
              menuLabel="등록 방법"
              items={[
                { label: "엑셀 업로드", onClick: () => setUpload((n) => n + 1) },
                { label: "직접 등록", onClick: () => setModal({ seq: Date.now(), item: null }) },
              ]}
            />
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

      {upload > 0 && (
        <UploadReviewModal
          key={upload}
          open
          title="품목 마스터"
          columns={ITEM_SHEET_COLUMNS}
          parse={parseSheet}
          classify={classify}
          onApprove={approve}
          onClose={() => setUpload(0)}
        />
      )}
    </>
  );
}
