"use client";

import { useState } from "react";
import { Button, Card, DataTable, FIELD_SM, FIELD_SM_ERROR } from "@/components/ui";
import type { Item } from "@/data/inventory";
import type { Cell } from "@/data/types";
import { downloadCsv } from "@/lib/download";
import { formatQty, formatStamp } from "@/lib/format";
import { runningStock, safetyOf, shortage, stockBreakdown, type StockBreakdown } from "@/lib/inventory-state";
import { matchesQuery } from "@/lib/search";
import { CardTools } from "./card-tools";
import { useInventory } from "./inventory-provider";
import { KIND_LABEL, qtyCell, reasonOf } from "./movements-tab";
import { METHOD_LABEL } from "./settings/standard-tab";

/** 표는 판단할 값만 — 기초 · 입고 · 출고 · 조정은 펼침의 산식으로 한 번만 보인다 */
const COLUMNS = ["품목명", "사양", "규격", "현재 재고", "안전 재고", "부족"];
const ALIGN = ["left", "left", "left", "right", "right", "right"] as const;
const STOCK_COL = 3;
/** 펼침 이력 — 입출고 이력 탭과 같은 열에서 품목 세 칸만 뺐다 */
const HISTORY_COLUMNS = ["일시", "구분", "사유", "수량", "조정 후 재고", "담당자"];
const HISTORY_ALIGN = ["left", "left", "left", "right", "right", "left"] as const;
/** 펼침에서 처음 보이는 이력 수 — 넘으면 「모두 보기」 */
const HISTORY_PREVIEW = 5;
const LABEL = "mb-1 block text-xs font-medium text-slate-600";
const NUM = "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

/** 입력 오른쪽 끝의 단위 표기(EA · kg) — 값이 무엇인지 칸 안에서 읽히게 */
function Suffixed({ suffix, children }: { suffix: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-500">{suffix}</span>
    </div>
  );
}

/** 산식의 한 항 — 이름 위, 숫자 아래 */
function Figure({ label, value, tone }: { label: string; value: string; tone?: "short" | "result" }) {
  return (
    <span className="grid">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-[17px] font-semibold tabular-nums ${tone === "short" ? "text-red-600" : tone === "result" ? "text-slate-900" : "text-slate-600"}`}>{value}</span>
    </span>
  );
}

type Form = { code: string; kind: "adjust"; qty: string; note: string } | { code: string; kind: "standard"; baseline: string; asOf: string; safety: string };

/**
 * 현재 재고 — 저장된 값이 아니라 `기초 + 입고 − 출고 + 조정` 파생값이다. 표에는 현재 · 안전 · 부족만.
 * 부족한 행만 현재 재고 강조 + 부족 칸 red. 안전 재고가 없으면 「—」(「미설정」 · 「충족」 글자를 쓰지 않는다).
 *
 * 행을 누르면 펼쳐진다(여럿 동시에) — 산식 숫자 칸 다섯 개 + 오른쪽 [기준 바꾸기] [조정 등록] + 최근 이력.
 * 버튼을 누르면 산식 아래에 같은 크기(32)의 한 줄 폼이 열린다. 폼은 화면에 하나 — 다른 행의 폼을 열면 앞의 것은 닫힌다.
 * 예외: 재고가 음수가 되는 조정 · 기초 변경은 저장하지 않는다. 기준일은 오늘까지. 기준일 이전 이력은 산식에서 빠지고 이력 탭에만 남는다.
 */
export function StockTab() {
  const { state, dispatch, notify } = useInventory();

  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** 이력을 전부 펼친 품목 */
  const [allHistory, setAllHistory] = useState<string[]>([]);

  const items = state.items.filter((i) => !i.discontinued).filter((i) => matchesQuery(query, [i.name, i.spec, i.size, i.code, i.location]));
  const balance = runningStock(state.movements, state.standards);

  const derived = items.map((i) => {
    const b = stockBreakdown(i.code, state.movements, state.standards);
    const safety = safetyOf(i, state);
    return { b, safety, short: shortage(b.stock, safety) };
  });

  const rows: Cell[][] = items.map((i, k) => {
    const { b, safety, short } = derived[k];
    return [
      i.name,
      i.spec || "—",
      i.size || "—",
      formatQty(b.stock),
      safety === null ? "—" : formatQty(safety),
      short && short > 0 ? { badge: formatQty(short), tone: "red", size: "md", strong: true } : "—",
    ];
  });

  /** CSV 는 원래 숫자로 — 네 항까지 모두 */
  function exportCsv() {
    downloadCsv("재고물류_현재재고.csv", [
      ["품목명", "사양", "규격", "기초 재고", "입고", "출고", "조정", "현재 재고", "안전 재고", "부족"],
      ...items.map((i, k) => {
        const { b, safety, short } = derived[k];
        return [i.name, i.spec, i.size, String(b.baseline), String(b.in), String(b.out), String(b.adjust), String(b.stock), safety === null ? "" : String(safety), short && short > 0 ? String(short) : ""];
      }),
    ]);
    notify(`재고 ${formatQty(rows.length)}품목을 내보냈어요`);
  }

  function toggleRow(k: number) {
    const code = items[k].code;
    setExpanded((cur) => (cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]));
    if (form?.code === code) closeForm();
  }

  function closeForm() {
    setForm(null);
    setErrors({});
  }

  function openAdjust(item: Item) {
    setErrors({});
    setForm({ code: item.code, kind: "adjust", qty: "", note: "" });
  }

  function openStandard(item: Item) {
    const std = state.standards.find((s) => s.itemCode === item.code);
    setErrors({});
    setForm({ code: item.code, kind: "standard", baseline: String(std?.baseline ?? 0), asOf: std?.asOf || state.today, safety: std?.safety == null ? "" : String(std.safety) });
  }

  /** 조정 저장 — 수량은 0 이 아닌 정수, 사유 필수, 결과 재고는 0 이상 */
  function saveAdjust(item: Item, b: StockBreakdown) {
    if (form?.kind !== "adjust") return;
    const qty = Math.trunc(Number(form.qty));
    const next: Record<string, string> = {};
    if (!form.qty.trim() || !Number.isFinite(qty) || qty === 0) next.qty = "0이 아닌 수량을 적어 주세요";
    else if (b.stock + qty < 0) next.qty = `재고 ${formatQty(b.stock)} ${item.unit}보다 많이 뺄 수 없어요`;
    if (!form.note.trim()) next.note = "사유를 적어 주세요";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    void dispatch({ type: "adjust", itemCode: item.code, qty, note: form.note.trim() }).then((ok) => {
      if (!ok) return;
      notify(`조정 ${qty > 0 ? `+${formatQty(qty)}` : `-${formatQty(-qty)}`} ${item.unit}를 등록했어요`);
      closeForm();
    });
  }

  /** 기준 저장 — 기초 0 이상, 기준일은 오늘까지, 새 기준으로 계산한 재고가 0 이상 */
  function saveStandard(item: Item) {
    if (form?.kind !== "standard") return;
    const baseline = Math.trunc(Number(form.baseline));
    const next: Record<string, string> = {};
    if (!form.baseline.trim() || !Number.isFinite(baseline) || baseline < 0) next.baseline = "0 이상으로 적어 주세요";
    if (!form.asOf) next.asOf = "기준일을 골라 주세요";
    else if (form.asOf > state.today) next.asOf = "오늘까지의 날짜로 골라 주세요";
    let safety: number | null = null;
    if (state.standard.method === "manual") {
      if (form.safety.trim() !== "") {
        safety = Math.trunc(Number(form.safety));
        if (!Number.isFinite(safety) || safety < 0) next.safety = "0 이상으로 적어 주세요";
      }
    } else {
      // 자동 산정이면 담당자 값은 건드리지 않는다 — 방식을 수동으로 바꿀 때 굳혀 둔 값이 남아 있게
      safety = state.standards.find((s) => s.itemCode === item.code)?.safety ?? null;
    }
    if (!next.baseline && !next.asOf) {
      const after = stockBreakdown(item.code, state.movements, [{ itemCode: item.code, baseline, asOf: form.asOf, safety: null }]).stock;
      if (after < 0) next.baseline = `기준일 이후 출고가 ${formatQty(baseline - after)} ${item.unit} 있어요 — ${formatQty(baseline - after)} 이상으로 적어 주세요`;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    void dispatch({ type: "setBaseline", itemCode: item.code, baseline, asOf: form.asOf, safety }).then((ok) => {
      if (!ok) return;
      notify("기준을 저장했어요");
      closeForm();
    });
  }

  const err = (key: string) => errors[key] && <p className="mt-1 text-xs text-red-600">{errors[key]}</p>;
  const formActions = (
    <div className="flex gap-2 self-end">
      <Button size="sm" variant="secondary" type="button" onClick={closeForm}>
        닫기
      </Button>
      <Button size="sm" type="submit">
        저장
      </Button>
    </div>
  );

  function renderPanel(k: number) {
    const item = items[k];
    const { b, safety, short } = derived[k];
    const asOf = state.standards.find((s) => s.itemCode === item.code)?.asOf ?? "";
    const history = state.movements.filter((m) => m.itemCode === item.code && m.at >= asOf).sort((x, y) => y.at.localeCompare(x.at));
    const shown = allHistory.includes(item.code) ? history : history.slice(0, HISTORY_PREVIEW);
    const mine = form?.code === item.code ? form : null;

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          {/* 산식 — 문장이 아니라 이름 붙은 숫자 다섯 칸. 결과만 진하고, 부족하면 빨강 */}
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2" aria-label="재고 산식">
            <Figure label={asOf ? `기초 · ${asOf.slice(5).replace("-", ".")}` : "기초"} value={formatQty(b.baseline)} />
            <span className="pb-0.5 text-slate-400" aria-hidden>+</span>
            <Figure label="입고" value={formatQty(b.in)} />
            <span className="pb-0.5 text-slate-400" aria-hidden>−</span>
            <Figure label="출고" value={formatQty(b.out)} />
            <span className="pb-0.5 text-slate-400" aria-hidden>+</span>
            <Figure label="조정" value={formatQty(b.adjust)} />
            <span className="pb-0.5 text-slate-400" aria-hidden>=</span>
            <Figure label={safety === null ? "현재" : `현재 · 안전 ${formatQty(safety)}`} value={formatQty(b.stock)} tone={short ? "short" : "result"} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => openStandard(item)} disabled={mine?.kind === "standard"}>
              기준 바꾸기
            </Button>
            <Button size="sm" variant="secondary" onClick={() => openAdjust(item)} disabled={mine?.kind === "adjust"}>
              조정 등록
            </Button>
          </div>
        </div>

        {mine?.kind === "adjust" && (
          <form
            noValidate
            className="fade-in flex flex-wrap items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveAdjust(item, b);
            }}
          >
            <div>
              <label htmlFor={`adj-qty-${item.code}`} className={LABEL}>
                조정 수량 (빼면 -)
              </label>
              <Suffixed suffix={item.unit}>
                <input
                  id={`adj-qty-${item.code}`}
                  type="number"
                  inputMode="numeric"
                  autoFocus
                  value={mine.qty}
                  aria-invalid={!!errors.qty}
                  onChange={(e) => setForm({ ...mine, qty: e.target.value })}
                  className={`${errors.qty ? FIELD_SM_ERROR : FIELD_SM} ${NUM} w-32 pr-10 text-right`}
                />
              </Suffixed>
              {err("qty")}
            </div>
            <div className="min-w-[240px] flex-1">
              <label htmlFor={`adj-note-${item.code}`} className={LABEL}>
                사유
              </label>
              <input id={`adj-note-${item.code}`} value={mine.note} aria-invalid={!!errors.note} onChange={(e) => setForm({ ...mine, note: e.target.value })} className={errors.note ? FIELD_SM_ERROR : FIELD_SM} />
              {err("note")}
            </div>
            {formActions}
          </form>
        )}

        {mine?.kind === "standard" && (
          <form
            // noValidate — `max` · `min` 은 힌트(달력 범위)로만 두고, 막는 문구는 우리 것으로 통일한다
            noValidate
            className="fade-in flex flex-wrap items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveStandard(item);
            }}
          >
            <div>
              <label htmlFor={`std-base-${item.code}`} className={LABEL}>
                기초 재고
              </label>
              <Suffixed suffix={item.unit}>
                <input
                  id={`std-base-${item.code}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  autoFocus
                  value={mine.baseline}
                  aria-invalid={!!errors.baseline}
                  onChange={(e) => setForm({ ...mine, baseline: e.target.value })}
                  className={`${errors.baseline ? FIELD_SM_ERROR : FIELD_SM} ${NUM} w-32 pr-10 text-right`}
                />
              </Suffixed>
              {err("baseline")}
            </div>
            <div>
              <label htmlFor={`std-asof-${item.code}`} className={LABEL}>
                실사 기준일
              </label>
              <input
                id={`std-asof-${item.code}`}
                type="date"
                max={state.today}
                value={mine.asOf}
                aria-invalid={!!errors.asOf}
                onChange={(e) => setForm({ ...mine, asOf: e.target.value })}
                className={`${errors.asOf ? FIELD_SM_ERROR : FIELD_SM} w-40`}
              />
              {err("asOf")}
            </div>
            <div>
              <label htmlFor={`std-safety-${item.code}`} className={LABEL}>
                안전 재고
              </label>
              <Suffixed suffix={item.unit}>
                {state.standard.method === "manual" ? (
                  <input
                    id={`std-safety-${item.code}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="없음"
                    value={mine.safety}
                    aria-invalid={!!errors.safety}
                    onChange={(e) => setForm({ ...mine, safety: e.target.value })}
                    className={`${errors.safety ? FIELD_SM_ERROR : FIELD_SM} ${NUM} w-32 pr-10 text-right`}
                  />
                ) : (
                  // 자동 산정 — 값은 설정 화면의 방식이 정한다. 여기서는 읽기만
                  <input id={`std-safety-${item.code}`} readOnly value={safety === null ? "—" : formatQty(safety)} title={METHOD_LABEL[state.standard.method]} className={`${FIELD_SM} w-32 bg-slate-50 pr-10 text-right text-slate-500`} />
                )}
              </Suffixed>
              {err("safety")}
            </div>
            {formActions}
          </form>
        )}

        {history.length > 0 ? (
          <div className="space-y-2">
            <DataTable
              dense
              data={{ columns: HISTORY_COLUMNS, rows: shown.map((m) => [formatStamp(m.at, state.today), KIND_LABEL[m.kind], reasonOf(m), qtyCell(m), balance[m.id] === undefined ? "—" : formatQty(balance[m.id]), m.actor || "—"]) }}
              colAlign={[...HISTORY_ALIGN]}
              // 조회 — 강조 0개. 불합격 입고는 재고에 안 들어간 줄이라 전부 내림
              rowEmphasis={(_, r) => (shown[r].judgement === "fail" ? "down" : undefined)}
              emphasisAt={(row, _, j) => (row[j] === "—" ? "down" : undefined)}
            />
            {history.length > HISTORY_PREVIEW && (
              <button
                type="button"
                onClick={() => setAllHistory((cur) => (cur.includes(item.code) ? cur.filter((c) => c !== item.code) : [...cur, item.code]))}
                className="cursor-pointer text-[13px] font-medium text-slate-600 transition-colors duration-150 hover:text-slate-900"
              >
                {allHistory.includes(item.code) ? "최근 5건만 보기" : `이력 ${formatQty(history.length)}건 모두 보기`}
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">기준일 이후 이력이 없어요</p>
        )}
      </div>
    );
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-slate-900">현재 재고</h2>
        <CardTools search={{ value: query, onChange: setQuery, placeholder: "품목명 · 규격 · 보관 위치로 찾기" }} onExport={exportCsv} />
      </div>
      <DataTable
        data={{ columns: COLUMNS, rows }}
        emptyText={query.trim() ? "검색 결과가 없어요" : "사용 중인 품목이 없어요"}
        colAlign={[...ALIGN]}
        emphasisAt={(row, k, j) => {
          if (j === STOCK_COL) return derived[k].short ? "em" : undefined;
          if (row[j] === "—" || row[j] === "0") return "down";
          return undefined;
        }}
        onRowClick={toggleRow}
        expandedRows={items.flatMap((i, k) => (expanded.includes(i.code) ? [k] : []))}
        renderExpanded={renderPanel}
      />
    </Card>
  );
}
