"use client";

import { useEffect, useRef, useState } from "react";
import { IconChevronDown } from "@/components/icons";
import { Button, Card, DataTable } from "@/components/ui";
import { UploadReviewModal, type UploadRowStatus } from "@/components/upload-review-modal";
import type { Item } from "@/data/inventory";
import type { Cell } from "@/data/types";
import { ITEM_SHEET_COLUMNS, parseItemRows } from "@/lib/inventory-state";
import { parseSheet } from "@/lib/sheet";
import { CardTools } from "../card-tools";
import { useInventory } from "../inventory-provider";
import { ItemModal } from "../item-modal";

const COLUMNS = ["품목 코드", "품목명", "사양", "규격", "단위", "분류", "거래처", "보관 위치", "상태"];

/** 「등록 ▾」 — 엑셀 업로드 / 직접 등록. 떠 있는 표면이라 shadow-lg. 바깥 클릭 · ESC 로 닫힌다 */
function RegisterMenu({ onUpload, onCreate }: { onUpload: () => void; onCreate: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = (label: string, onClick: () => void) => (
    <li role="none">
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          setOpen(false);
          onClick();
        }}
        className="w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm text-slate-700 transition-colors duration-150 hover:bg-slate-100"
      >
        {label}
      </button>
    </li>
  );

  return (
    <div ref={ref} className="relative">
      <Button size="sm" variant="secondary" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        등록
        <IconChevronDown size={14} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </Button>
      {open && (
        <ul role="menu" aria-label="등록 방법" className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {item("엑셀 업로드", onUpload)}
          {item("직접 등록", onCreate)}
        </ul>
      )}
    </div>
  );
}

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
  const q = query.trim().toLowerCase();
  const items = state.items.filter((i) => !q || [i.code, i.name, i.spec, i.size, i.category, i.location].some((s) => s.toLowerCase().includes(q)));

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
    const body = cells.map((r) => r.map((c) => (typeof c === "object" ? c.badge : String(c))));
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
            {/* 제품설계 완성 뒤 연결한다 — 지금은 자리만 알린다 */}
            <span className="rounded px-1.5 py-0.5 text-xs text-slate-500 ring-1 ring-inset ring-slate-200">도면(BOM) 자동 연동 · 준비 중</span>
          </div>
          <CardTools search={{ value: query, onChange: setQuery, placeholder: "코드 · 품목명 · 규격으로 찾기" }}>
            <RegisterMenu onUpload={() => setUpload((n) => n + 1)} onCreate={() => setModal({ seq: Date.now(), item: null })} />
          </CardTools>
        </div>
        <DataTable
          data={{ columns: COLUMNS, rows }}
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
