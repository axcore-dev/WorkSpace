"use client";

import { useState } from "react";
import { Card, DataTable } from "@/components/ui";
import type { Movement, MovementKind } from "@/data/inventory";
import type { Cell, Tone } from "@/data/types";
import { downloadCsv } from "@/lib/download";
import { runningStock } from "@/lib/inventory-state";
import { CardTools } from "./card-tools";
import { useInventory } from "./inventory-provider";

const KIND_LABEL: Record<MovementKind, string> = { in: "입고", out: "출고", adjust: "조정", baseline: "기초" };
// 조회 화면 — 강조 0개. 구분만 톤이 있고, 출고 · 기초는 내림
const KIND_TONE: Record<MovementKind, Tone> = { in: "green", out: "slate", adjust: "amber", baseline: "slate" };

const SIMPLE = ["날짜", "품목", "구분", "수량", "귀속"];
const DETAIL = ["일시", "품목", "사양", "규격", "구분", "수량", "잔량", "담당자", "발주번호", "검사", "귀속", "메모"];
/** 상세 12열은 폭을 고정하고 넘치는 글자는 말줄임(`title` 로 전문). 합 1,190px — 좁으면 카드 안에서 가로 스크롤 */
const DETAIL_WIDTHS = ["104px", "150px", "72px", "104px", "56px", "64px", "64px", "96px", "116px", "64px", "140px", "160px"];

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const dateOf = (at: string) => at.slice(5, 10).replace("-", ".");
const timeOf = (at: string) => `${dateOf(at)} ${at.slice(11, 16)}`;

/** 입출고 이력 — 최신순 고정. 간단 5열 / 상세 12열. 검색은 품목 · 관리번호 · 담당자 · 발주번호 */
export function MovementsTab() {
  const { state, density, notify } = useInventory();
  const [query, setQuery] = useState("");

  const itemOf = (code: string) => state.items.find((i) => i.code === code);
  const balance = runningStock(state.movements, state.standards);
  const q = query.trim().toLowerCase();
  const rows = [...state.movements]
    .sort((a, b) => b.at.localeCompare(a.at))
    .filter((m) => {
      if (!q) return true;
      const it = itemOf(m.itemCode);
      return [it?.name ?? m.itemCode, it?.spec ?? "", it?.size ?? "", m.ref, m.actor, m.poNo ?? ""].some((s) => s.toLowerCase().includes(q));
    });

  const kindCell = (m: Movement): Cell => ({ badge: KIND_LABEL[m.kind], tone: KIND_TONE[m.kind] });
  const qtyOf = (m: Movement) => (m.kind === "baseline" ? `= ${m.qty}` : signed(m.qty));
  const judgementCell = (m: Movement): Cell => (m.judgement === "fail" ? { badge: "불합격", tone: "red" } : m.judgement === "pass" ? "합격" : "—");

  const cells: Cell[][] = rows.map((m) => {
    const it = itemOf(m.itemCode);
    const name = it?.name ?? m.itemCode;
    return density === "simple"
      ? [dateOf(m.at), [name, it?.spec, it?.size].filter(Boolean).join(" "), kindCell(m), qtyOf(m), m.ref]
      : [timeOf(m.at), name, it?.spec ?? "—", it?.size ?? "—", kindCell(m), qtyOf(m), String(balance[m.id] ?? "—"), m.actor || "—", m.poNo ?? "—", judgementCell(m), m.ref, m.note || "—"];
  });
  const columns = density === "simple" ? SIMPLE : DETAIL;

  function exportCsv() {
    downloadCsv(`재고물류_입출고이력.csv`, [columns, ...cells]);
    notify(`이력 ${cells.length}건을 내보냈어요`);
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-slate-900">입출고 이력</h2>
        <CardTools search={{ value: query, onChange: setQuery, placeholder: "품목 · 관리번호 · 담당자로 찾기" }} density onExport={exportCsv} />
      </div>
      <DataTable
        data={{ columns, rows: cells }}
        dense={density === "detail"}
        colWidths={density === "detail" ? DETAIL_WIDTHS : undefined}
        colAlign={density === "detail" ? ["left", "left", "left", "left", "left", "right", "right"] : ["left", "left", "left", "right"]}
        // 조회 화면 — 열 강조 없음. 「—」 · 합격은 내림
        emphasisAt={(row, _, j) => (row[j] === "—" || row[j] === "합격" ? "down" : undefined)}
      />
    </Card>
  );
}
