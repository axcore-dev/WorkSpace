"use client";

import { useState } from "react";
import { Button, Card, DataTable, FIELD, FIELD_ERROR, FIELD_SM, FIELD_SM_ERROR, Segmented } from "@/components/ui";
import type { Item, MovementKind } from "@/data/inventory";
import type { Cell, Tone } from "@/data/types";
import { downloadCsv } from "@/lib/download";
import { safetyOf, shortage, stockBreakdown, type StockBreakdown } from "@/lib/inventory-state";
import { CardTools } from "./card-tools";
import { matchesQuery } from "@/lib/search";
import { useInventory } from "./inventory-provider";
import { OrderEditor } from "./order-editor";
import { METHOD_LABEL } from "./settings/standard-tab";

const COLUMNS = ["품목명", "사양/시리즈", "규격", "기초 재고", "입고", "출고", "조정", "현재 재고", "안전 기준"];
const STOCK_COL = 7;
const SAFETY_COL = 8;

const KIND_LABEL: Record<MovementKind, string> = { in: "입고", out: "출고", adjust: "조정", baseline: "기초" };
const KIND_TONE: Record<MovementKind, Tone> = { in: "green", out: "slate", adjust: "amber", baseline: "slate" };

/** 입력 오른쪽 끝의 단위 표기(EA · 일) — 값이 무엇인지 칸 안에서 읽히게 */
function Suffixed({ suffix, children }: { suffix: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-500">{suffix}</span>
    </div>
  );
}

type Panel = "history" | "standard";
const PANEL_OPTIONS: { value: Panel; label: string }[] = [
  { value: "history", label: "이력" },
  { value: "standard", label: "기준 바꾸기" },
];

interface AdjustDraft {
  qty: string;
  note: string;
}
interface StandardDraft {
  baseline: string;
  asOf: string;
  safety: string;
}

/**
 * 현재 재고 — 저장된 값이 아니라 `기초 + 입고 − 출고 + 조정` 파생값이다.
 * 0 은 내림. 기준 미달 행만 현재 재고 강조 + 안전 기준 셀 `N에 M 모자람`(red).
 *
 * 행을 누르면 펼쳐진다 — ① 이력(등식 한 줄 + 다섯 열 + [조정 추가] · 미달일 때 [발주서 만들기]) ② 기준 바꾸기(기초 · 기준일 · 안전 기준).
 * 예외: 재고가 음수가 되는 조정 · 기초 변경은 저장하지 않는다. 기준일은 오늘까지. 기준일 이전 이력은 등식에서 빠지고 이력 탭 상세에만 남는다.
 */
export function StockTab() {
  const { state, can, dispatch, notify } = useInventory();
  const canPurchase = can("purchasing");

  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("history");
  const [adjust, setAdjust] = useState<AdjustDraft | null>(null);
  const [standard, setStandard] = useState<StandardDraft>({ baseline: "", asOf: "", safety: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editor, setEditor] = useState(0);

  const items = state.items.filter((i) => !i.discontinued).filter((i) => matchesQuery(query, [i.name, i.spec, i.size, i.code, i.location]));

  const derived = items.map((i) => {
    const b = stockBreakdown(i.code, state.movements, state.standards);
    const safety = safetyOf(i, state);
    return { b, safety, short: shortage(b.stock, safety) };
  });
  const expandedIndex = items.findIndex((i) => i.code === expanded);

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

  function toggleRow(k: number) {
    const code = items[k].code;
    setExpanded((cur) => (cur === code ? null : code));
    setPanel("history");
    setAdjust(null);
    setErrors({});
  }

  function openStandard(item: Item) {
    const std = state.standards.find((s) => s.itemCode === item.code);
    setStandard({ baseline: String(std?.baseline ?? 0), asOf: std?.asOf ?? state.today, safety: std?.safety === null || std?.safety === undefined ? "" : String(std.safety) });
    setErrors({});
    setPanel("standard");
  }

  /** 조정 저장 — 수량은 0 이 아닌 정수, 사유 필수, 결과 재고는 0 이상 */
  function saveAdjust(item: Item, b: StockBreakdown) {
    if (!adjust) return;
    const qty = Math.trunc(Number(adjust.qty));
    const next: Record<string, string> = {};
    if (!adjust.qty.trim() || !Number.isFinite(qty) || qty === 0) next.qty = "0이 아닌 수량을 적어 주세요";
    else if (b.stock + qty < 0) next.qty = `재고 ${b.stock} ${item.unit}보다 많이 뺄 수 없어요`;
    if (!adjust.note.trim()) next.note = "사유를 적어 주세요";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    void dispatch({ type: "adjust", itemCode: item.code, qty, note: adjust.note.trim() }).then((ok) => {
      if (!ok) return;
      notify(`조정 ${qty > 0 ? `+${qty}` : `−${-qty}`} ${item.unit}를 등록했어요`);
      setAdjust(null);
    });
  }

  /** 기준 저장 — 기초 0 이상, 기준일은 오늘까지, 새 기준으로 계산한 재고가 0 이상 */
  function saveStandard(item: Item) {
    const baseline = Math.trunc(Number(standard.baseline));
    const next: Record<string, string> = {};
    if (!standard.baseline.trim() || !Number.isFinite(baseline) || baseline < 0) next.baseline = "0 이상으로 적어 주세요";
    if (!standard.asOf) next.asOf = "기준일을 골라 주세요";
    else if (standard.asOf > state.today) next.asOf = "오늘까지의 날짜로 골라 주세요";
    let safety: number | null = null;
    if (state.standard.method === "manual") {
      if (standard.safety.trim() === "") safety = null;
      else {
        safety = Math.trunc(Number(standard.safety));
        if (!Number.isFinite(safety) || safety < 0) next.safety = "0 이상으로 적어 주세요";
      }
    } else {
      // 자동 산정이면 담당자 값은 건드리지 않는다 — 방식을 수동으로 바꿀 때 굳혀 둔 값이 남아 있게
      safety = state.standards.find((s) => s.itemCode === item.code)?.safety ?? null;
    }
    if (!next.baseline && !next.asOf) {
      const after = stockBreakdown(item.code, state.movements, [{ itemCode: item.code, baseline, asOf: standard.asOf, safety: null }]).stock;
      if (after < 0) next.baseline = `기준일 이후 출고가 ${baseline - after} ${item.unit} 있어요 — ${baseline - after} 이상으로 적어 주세요`;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    void dispatch({ type: "setBaseline", itemCode: item.code, baseline, asOf: standard.asOf, safety }).then((ok) => {
      if (!ok) return;
      notify("저장했어요");
      setPanel("history");
    });
  }

  function renderPanel(k: number) {
    const item = items[k];
    const { b, safety, short } = derived[k];
    const std = state.standards.find((s) => s.itemCode === item.code);
    const asOf = std?.asOf ?? "";
    const history = state.movements
      .filter((m) => m.itemCode === item.code && m.at >= asOf)
      .sort((x, y) => y.at.localeCompare(x.at));
    // 등식은 글이라 음수를 「−2」 로 쓴다(표의 숫자는 복사할 수 있게 ASCII 그대로)
    const num = (n: number, sign = false) => (
      <span className={n === 0 ? "text-slate-500" : "text-slate-700"}>{n < 0 ? `−${-n}` : sign && n > 0 ? `+${n}` : n}</span>
    );

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            options={PANEL_OPTIONS}
            value={panel}
            onChange={(v) => {
              if (v === "standard") openStandard(item);
              else {
                setPanel("history");
                setErrors({});
              }
            }}
            label={`${item.name} 패널`}
          />
          {panel === "history" && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={adjust !== null} onClick={() => setAdjust({ qty: "", note: "" })}>
                조정 추가
              </Button>
              {canPurchase && short !== null && short > 0 && (
                <Button size="sm" variant="secondary" onClick={() => setEditor((n) => n + 1)}>
                  발주서 만들기
                </Button>
              )}
            </div>
          )}
        </div>

        {panel === "history" ? (
          <>
            {/* 등식 한 줄 — 표의 숫자가 어디서 왔는지. 결과만 진하다(미달이면 red) */}
            <p className="text-sm text-slate-600">
              기초 {num(b.baseline)} + 입고 {num(b.in)} − 출고 {num(b.out)} + 조정 {num(b.adjust, true)} ={" "}
              <span className={`font-semibold ${short ? "text-red-600" : "text-slate-900"}`}>{b.stock}</span>
              {asOf && <span className="text-slate-500"> · 기준일 {asOf}</span>}
            </p>

            {adjust && (
              <form
                noValidate
                className="flex flex-wrap items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveAdjust(item, b);
                }}
              >
                <div>
                  <label htmlFor={`adj-qty-${item.code}`} className="mb-1.5 block text-xs font-medium text-slate-600">
                    조정 수량 ({item.unit}, 빼면 −)
                  </label>
                  <input
                    id={`adj-qty-${item.code}`}
                    type="number"
                    inputMode="numeric"
                    autoFocus
                    value={adjust.qty}
                    aria-invalid={!!errors.qty}
                    onChange={(e) => setAdjust({ ...adjust, qty: e.target.value })}
                    className={`${errors.qty ? FIELD_SM_ERROR : FIELD_SM} w-28 text-right`}
                  />
                  {errors.qty && <p className="mt-1 text-xs text-red-600">{errors.qty}</p>}
                </div>
                <div className="min-w-[240px] flex-1">
                  <label htmlFor={`adj-note-${item.code}`} className="mb-1.5 block text-xs font-medium text-slate-600">
                    사유
                  </label>
                  <input
                    id={`adj-note-${item.code}`}
                    value={adjust.note}
                    aria-invalid={!!errors.note}
                    onChange={(e) => setAdjust({ ...adjust, note: e.target.value })}
                    className={errors.note ? FIELD_SM_ERROR : FIELD_SM}
                  />
                  {errors.note && <p className="mt-1 text-xs text-red-600">{errors.note}</p>}
                </div>
                <div className="flex gap-2 self-end pb-px">
                  <Button
                    size="sm"
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      setAdjust(null);
                      setErrors({});
                    }}
                  >
                    닫기
                  </Button>
                  <Button size="sm" type="submit">
                    저장
                  </Button>
                </div>
              </form>
            )}

            {history.length > 0 ? (
              <DataTable
                dense
                data={{
                  columns: ["날짜", "구분", "수량", "담당자", "귀속"],
                  rows: history.map((m) => [
                    m.at.slice(0, 10),
                    { badge: KIND_LABEL[m.kind], tone: KIND_TONE[m.kind] },
                    m.kind === "baseline" ? `= ${m.qty}` : m.qty > 0 ? `+${m.qty}` : String(m.qty),
                    m.actor || "—",
                    m.ref || "—",
                  ]),
                }}
                colAlign={["left", "left", "right", "left", "left"]}
                // 조회 — 강조 0개. 불합격 입고는 재고에 안 들어간 행이라 전부 내림
                rowEmphasis={(_, r) => (history[r].judgement === "fail" ? "down" : undefined)}
                emphasisAt={(row, _, j) => (row[j] === "—" ? "down" : undefined)}
              />
            ) : (
              <p className="text-sm text-slate-500">기준일 이후 이력이 없어요</p>
            )}
          </>
        ) : (
          <form
            // noValidate — `max` · `min` 은 힌트(달력 범위)로만 두고, 막는 문구는 우리 것으로 통일한다
            noValidate
            className="grid gap-4 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveStandard(item);
            }}
          >
            <div>
              <label htmlFor={`std-base-${item.code}`} className="mb-1.5 block text-sm font-medium text-slate-700">
                기초 재고
              </label>
              <Suffixed suffix={item.unit}>
                <input
                  id={`std-base-${item.code}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={standard.baseline}
                  aria-invalid={!!errors.baseline}
                  onChange={(e) => setStandard({ ...standard, baseline: e.target.value })}
                  className={`${errors.baseline ? FIELD_ERROR : FIELD} pr-12`}
                />
              </Suffixed>
              {errors.baseline && <p className="mt-1.5 text-xs text-red-600">{errors.baseline}</p>}
            </div>
            <div>
              <label htmlFor={`std-asof-${item.code}`} className="mb-1.5 block text-sm font-medium text-slate-700">
                실사 기준일
              </label>
              <input
                id={`std-asof-${item.code}`}
                type="date"
                max={state.today}
                value={standard.asOf}
                aria-invalid={!!errors.asOf}
                onChange={(e) => setStandard({ ...standard, asOf: e.target.value })}
                className={errors.asOf ? FIELD_ERROR : FIELD}
              />
              {errors.asOf && <p className="mt-1.5 text-xs text-red-600">{errors.asOf}</p>}
            </div>
            <div>
              <label htmlFor={`std-safety-${item.code}`} className="mb-1.5 block text-sm font-medium text-slate-700">
                안전 기준
              </label>
              <Suffixed suffix={item.unit}>
                {state.standard.method === "manual" ? (
                  <input
                    id={`std-safety-${item.code}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="미설정"
                    value={standard.safety}
                    aria-invalid={!!errors.safety}
                    onChange={(e) => setStandard({ ...standard, safety: e.target.value })}
                    className={`${errors.safety ? FIELD_ERROR : FIELD} pr-12`}
                  />
                ) : (
                  // 자동 산정 — 값은 설정 화면의 방식이 정한다. 여기서는 읽기만
                  <input id={`std-safety-${item.code}`} readOnly value={safety === null ? "미설정" : String(safety)} title={METHOD_LABEL[state.standard.method]} className={`${FIELD} bg-slate-50 pr-12 text-slate-500`} />
                )}
              </Suffixed>
              {errors.safety && <p className="mt-1.5 text-xs text-red-600">{errors.safety}</p>}
            </div>
            <div className="flex justify-end gap-2 sm:col-span-3">
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setPanel("history");
                  setErrors({});
                }}
              >
                닫기
              </Button>
              <Button type="submit">저장</Button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <>
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-slate-900">현재 재고</h2>
          <CardTools search={{ value: query, onChange: setQuery, placeholder: "품목명 · 규격 · 코드 · 보관 위치로 찾기" }} onExport={exportCsv} />
        </div>
        <DataTable
          data={{ columns: COLUMNS, rows }}
          emptyText={query.trim() ? "검색 결과가 없어요" : "사용 중인 품목이 없어요"}
          colAlign={["left", "left", "left", "right", "right", "right", "right", "right", "left"]}
          emphasisAt={(row, k, j) => {
            if (j === STOCK_COL) return derived[k].short ? "em" : undefined;
            if (j === SAFETY_COL) return typeof row[j] === "string" ? "down" : undefined;
            if (j >= 3 && row[j] === "0") return "down";
            return undefined;
          }}
          onRowClick={toggleRow}
          expandedRow={expandedIndex >= 0 ? expandedIndex : null}
          renderExpanded={renderPanel}
        />
      </Card>

      {editor > 0 && <OrderEditor key={editor} onClose={() => setEditor(0)} />}
    </>
  );
}
