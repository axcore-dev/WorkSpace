"use client";

import { useState } from "react";
import { Card, DataTable } from "@/components/ui";
import type { Movement, MovementKind } from "@/data/inventory";
import type { Cell } from "@/data/types";
import { downloadCsv } from "@/lib/download";
import { formatQty, formatStamp } from "@/lib/format";
import { runningStock } from "@/lib/inventory-state";
import { matchesQuery } from "@/lib/search";
import { CardTools } from "./card-tools";
import { useInventory } from "./inventory-provider";

export const KIND_LABEL: Record<MovementKind, string> = { in: "입고", out: "출고", adjust: "조정", baseline: "기초" };

/** 이력 한 줄의 사유 — 관리번호(입출고) · 조정 사유 · 메모를 한 칸에. 불합격 입고는 앞에 「불합격」 */
export const reasonOf = (m: Movement) => [m.judgement === "fail" ? "불합격" : "", m.ref, m.note].filter(Boolean).join(" · ") || "—";

/** 수량 칸 — 기초는 새 값(`= 29`), 나머지는 증감(늘면 빨강 · 줄면 파랑, DESIGN.md 「재고 증감 부호」) */
export const qtyCell = (m: Movement): Cell => (m.kind === "baseline" ? `= ${formatQty(m.qty)}` : { delta: m.qty });

/** 레퍼런스(시간 · 입출고 · 조정 사유 · 조정 개수 · 조정 후 재고)를 뼈대로 품목 세 칸과 담당자를 더한 한 벌. 간단/상세는 없다 */
const COLUMNS = ["일시", "품목명", "사양", "규격", "구분", "사유", "수량", "조정 후 재고", "담당자"];
const ALIGN = ["left", "left", "left", "left", "left", "left", "right", "right", "left"] as const;

/** 입출고 이력 — 최신순 고정. 검색은 품목명 · 사양 · 규격 · 관리번호 · 담당자(발주번호도 쳐지면 찾는다) */
export function MovementsTab() {
  const { state, notify } = useInventory();
  const [query, setQuery] = useState("");

  const itemOf = (code: string) => state.items.find((i) => i.code === code);
  const balance = runningStock(state.movements, state.standards);
  const rows = [...state.movements]
    .sort((a, b) => b.at.localeCompare(a.at))
    .filter((m) => {
      const it = itemOf(m.itemCode);
      return matchesQuery(query, [it?.name ?? m.itemCode, it?.spec, it?.size, m.ref, m.actor, m.poNo, m.note]);
    });

  const cells: Cell[][] = rows.map((m) => {
    const it = itemOf(m.itemCode);
    return [
      formatStamp(m.at, state.today),
      it?.name ?? m.itemCode,
      it?.spec || "—",
      it?.size || "—",
      KIND_LABEL[m.kind],
      reasonOf(m),
      qtyCell(m),
      balance[m.id] === undefined ? "—" : formatQty(balance[m.id]),
      m.actor || "—",
    ];
  });

  /** CSV 는 원래 숫자로 — 쉼표 · 색 없이, 일시는 날짜까지 */
  function exportCsv() {
    downloadCsv("재고물류_입출고이력.csv", [
      COLUMNS,
      ...rows.map((m) => {
        const it = itemOf(m.itemCode);
        return [m.at.replace("T", " "), it?.name ?? m.itemCode, it?.spec ?? "", it?.size ?? "", KIND_LABEL[m.kind], reasonOf(m), String(m.qty), String(balance[m.id] ?? ""), m.actor];
      }),
    ]);
    notify(`이력 ${formatQty(rows.length)}건을 내보냈어요`);
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-slate-900">입출고 이력</h2>
        <CardTools search={{ value: query, onChange: setQuery, placeholder: "품목명 · 관리번호 · 담당자로 찾기" }} onExport={exportCsv} />
      </div>
      <DataTable
        data={{ columns: COLUMNS, rows: cells }}
        emptyText={query.trim() ? "검색 결과가 없어요" : "입출고 이력이 없어요"}
        colAlign={[...ALIGN]}
        // 조회 화면 — 강조 없음. 불합격 입고는 재고에 안 들어간 줄이라 전부 내림, 「—」 도 내림
        rowEmphasis={(_, i) => (rows[i].judgement === "fail" ? "down" : undefined)}
        emphasisAt={(row, _, j) => (row[j] === "—" ? "down" : undefined)}
      />
    </Card>
  );
}
