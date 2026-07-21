"use client";

import { useMemo, useState } from "react";
import { ChartFromSpec } from "@/components/charts";
import { IconArrowRight, IconCheck, IconCheckCircle, IconDownload, IconFile, IconSparkles } from "@/components/icons";
import { AiBadge, Button, Card, DataTable, FIELD, SectionHeader } from "@/components/ui";
import { downloadCsv } from "@/lib/download";
import { CHART } from "@/lib/palette";
import {
  APPROVAL_LINE,
  DEFECT_TYPES,
  LINE_ITEMS,
  LINE_PLANS,
  LINES,
  REPORT_REASONING,
  SEED_ENTRIES,
  type FieldEntry,
} from "@/data/reporting";
import type { Cell, Tone } from "@/data/types";

const nf = new Intl.NumberFormat("ko-KR");
const pct = (v: number) => `${v.toFixed(1)}%`;

/** 현장 입력 → 자동 집계 → AI 보고서 3단계 흐름 표시 */
function StepStrip({ reportReady }: { reportReady: boolean }) {
  const steps = [
    { n: 1, label: "현장 입력", desc: "작업자 POP·태블릿", done: true },
    { n: 2, label: "자동 집계", desc: "입력 즉시 실시간 반영", done: true },
    { n: 3, label: "AI 보고서", desc: "일일 생산·품질 보고서", done: reportReady },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              s.done ? "bg-slate-800 text-white" : "border border-slate-300 bg-white text-slate-400"
            }`}
          >
            {s.done ? <IconCheck size={12} /> : s.n}
          </span>
          <span className="text-sm font-semibold text-slate-800">{s.label}</span>
          <span className="hidden text-xs text-slate-400 sm:inline">{s.desc}</span>
          {i < steps.length - 1 && <IconArrowRight size={14} className="mx-1 text-slate-300" />}
        </div>
      ))}
    </div>
  );
}

/** 생산관리 > 보고 자동화 — 현장 입력이 집계로, 집계가 AI 보고서로 이어지는 시연 화면 */
export function ReportAutomation() {
  const [entries, setEntries] = useState<FieldEntry[]>(SEED_ENTRIES);

  // 입력 폼
  const [line, setLine] = useState(LINES[0]);
  const [qty, setQty] = useState("");
  const [defects, setDefects] = useState("");
  const [defectType, setDefectType] = useState(DEFECT_TYPES[0]);
  const [note, setNote] = useState("");
  const [justAdded, setJustAdded] = useState(false);

  // 보고서 생성 상태
  const [generating, setGenerating] = useState(false);
  const [genSteps, setGenSteps] = useState<string[]>([]);
  const [reportAt, setReportAt] = useState<string | null>(null);
  const [reportStale, setReportStale] = useState(false);

  const agg = useMemo(() => {
    const byLine = LINES.map((l) => {
      const rows = entries.filter((e) => e.line === l);
      const produced = rows.reduce((s, e) => s + e.qty, 0);
      const defect = rows.reduce((s, e) => s + e.defects, 0);
      const plan = LINE_PLANS[l];
      return { line: l, item: LINE_ITEMS[l], plan, produced, defect, rate: plan ? (produced / plan) * 100 : 0 };
    });
    const produced = byLine.reduce((s, r) => s + r.produced, 0);
    const defect = byLine.reduce((s, r) => s + r.defect, 0);
    const plan = byLine.reduce((s, r) => s + r.plan, 0);
    const byDefect = DEFECT_TYPES.map((t) => ({
      type: t,
      count: entries.filter((e) => e.defectType === t).reduce((s, e) => s + e.defects, 0),
    })).filter((d) => d.count > 0);
    const topDefect = [...byDefect].sort((a, b) => b.count - a.count)[0];
    const worstLine = [...byLine].sort((a, b) => a.rate - b.rate)[0];
    const notes = entries.filter((e) => e.note);
    const worstNote = notes.find((e) => e.line === worstLine.line);
    return {
      byLine,
      produced,
      defect,
      plan,
      rate: plan ? (produced / plan) * 100 : 0,
      defectRate: produced + defect > 0 ? (defect / (produced + defect)) * 100 : 0,
      byDefect,
      topDefect,
      worstLine,
      worstNote,
      notes,
    };
  }, [entries]);

  function submitEntry() {
    const q = Number(qty);
    if (!q || q <= 0) return;
    const d = Math.max(0, Number(defects) || 0);
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setEntries((prev) => [
      { time, line, item: LINE_ITEMS[line], qty: q, defects: d, defectType: d > 0 ? defectType : undefined, note: note.trim() || undefined },
      ...prev,
    ]);
    setQty("");
    setDefects("");
    setNote("");
    if (reportAt) setReportStale(true);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2500);
  }

  function generateReport() {
    if (generating) return;
    setGenerating(true);
    setGenSteps([]);
    REPORT_REASONING.forEach((s, i) => {
      setTimeout(() => setGenSteps((prev) => [...prev, s]), i * 800);
    });
    setTimeout(() => {
      setGenerating(false);
      setGenSteps([]);
      const now = new Date();
      setReportAt(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
      setReportStale(false);
    }, REPORT_REASONING.length * 800 + 600);
  }

  /** AI 종합 의견 — 화면 표시와 Excel 다운로드가 같은 문장을 공유한다 */
  const aiComments = [
    `집계 시점 기준 총 ${nf.format(agg.produced)} EA 생산, 계획 대비 ${pct(agg.rate)} 진척입니다. 잔여 시간대 가동을 고려하면 금일 목표 달성이 가능한 수준입니다.`,
    `달성률 최저 라인은 ${agg.worstLine.line}(${pct(agg.worstLine.rate)})입니다.${
      agg.worstNote ? ` 현장 특이사항 "${agg.worstNote.note}" 보고와 연관된 것으로 판단됩니다.` : ""
    }`,
    ...(agg.topDefect
      ? [
          `불량 최다 유형은 ${agg.topDefect.type}(${agg.topDefect.count}건)입니다. CNC 계열 치수 불량은 CNC-07 스핀들 진동 상승과 상관관계가 있어 장비관리 > 정비 예측 연계 조치를 권고합니다.`,
        ]
      : []),
    "야간조에 CNC 1·2라인 증산 배치 시 계획 만회가 가능할 것으로 예측됩니다 (신뢰도 86%).",
  ];

  /** 보고서 전체 내용을 Excel 호환 CSV로 다운로드 */
  function downloadExcel() {
    const rows: Cell[][] = [
      ["일일 생산·품질 보고서"],
      ["(주)데모컴퍼니 생산본부", "2026-07-20", "문서번호 RPT-260720-01", `작성 AXpoint AI · ${reportAt} 자동 생성`],
      [],
      ["요약", "값", "비고"],
      ["총 생산 실적", `${nf.format(agg.produced)} EA`, `계획 ${nf.format(agg.plan)} EA`],
      ["계획 달성률", pct(agg.rate), "집계 시점 기준"],
      ["불량", `${agg.defect}건`, `불량률 ${pct(agg.defectRate)}`],
      ["특이사항", `${agg.notes.length}건`, agg.notes.map((e) => `${e.line}: ${e.note}`).join(" / ")],
      [],
      ["1. 라인별 실적"],
      ["라인", "품목", "계획", "실적", "달성률", "불량"],
      ...agg.byLine.map((r) => [r.line, r.item, r.plan, r.produced, pct(r.rate), r.defect] as Cell[]),
      [],
      ["2. 불량 현황"],
      ["유형", "건수"],
      ...agg.byDefect.map((d) => [d.type, d.count] as Cell[]),
      [],
      ["3. AI 종합 의견"],
      ...aiComments.map((c) => [c] as Cell[]),
    ];
    downloadCsv("일일_생산품질_보고서_2026-07-20.csv", rows);
  }

  const lineTable: Cell[][] = agg.byLine.map((r) => [
    r.line,
    r.item,
    nf.format(r.plan),
    nf.format(r.produced),
    pct(r.rate),
    r.defect > 0 ? { badge: `${r.defect}건`, tone: (r.defect >= 10 ? "red" : "amber") as Tone } : "—",
  ]);

  return (
    <div className="space-y-4">
      <StepStrip reportReady={!!reportAt} />

      <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
        {/* ── ① 현장 입력 ── */}
        <Card className="self-start">
          <SectionHeader title="① 현장 실적 입력" desc="작업자가 POP 단말·태블릿에서 입력하는 화면입니다. 등록 즉시 집계에 반영됩니다." />
          <form
            className="space-y-3.5"
            onSubmit={(e) => {
              e.preventDefault();
              submitEntry();
            }}
          >
            <div>
              <label htmlFor="ra-line" className="mb-1.5 block text-sm font-medium text-slate-700">
                라인
              </label>
              <select id="ra-line" value={line} onChange={(e) => setLine(e.target.value)} className={`${FIELD} cursor-pointer`}>
                {LINES.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">품목: {LINE_ITEMS[line]}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ra-qty" className="mb-1.5 block text-sm font-medium text-slate-700">
                  양품 수량 <span className="text-red-500">*</span>
                </label>
                <input id="ra-qty" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="EA" className={FIELD} />
              </div>
              <div>
                <label htmlFor="ra-def" className="mb-1.5 block text-sm font-medium text-slate-700">
                  불량 수량
                </label>
                <input id="ra-def" type="number" min={0} value={defects} onChange={(e) => setDefects(e.target.value)} placeholder="0" className={FIELD} />
              </div>
            </div>
            {Number(defects) > 0 && (
              <div>
                <label htmlFor="ra-dtype" className="mb-1.5 block text-sm font-medium text-slate-700">
                  불량 유형
                </label>
                <select id="ra-dtype" value={defectType} onChange={(e) => setDefectType(e.target.value)} className={`${FIELD} cursor-pointer`}>
                  {DEFECT_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="ra-note" className="mb-1.5 block text-sm font-medium text-slate-700">
                특이사항
              </label>
              <input id="ra-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="설비 이상, 자재 지연 등 (선택)" className={FIELD} />
            </div>
            <Button type="submit" className="w-full" disabled={!qty || Number(qty) <= 0}>
              실적 등록
            </Button>
            {justAdded && (
              <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-600" role="status">
                <IconCheckCircle size={14} /> 집계에 반영되었습니다
              </p>
            )}
          </form>

          {/* 최근 입력 이력 */}
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-semibold text-slate-500">금일 입력 이력 · {entries.length}건</p>
            <ul className="thin-scroll max-h-52 space-y-1 overflow-y-auto">
              {entries.map((e, i) => (
                <li key={`${e.time}-${e.line}-${i}`} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <p className="flex items-center justify-between font-medium text-slate-700">
                    <span>
                      {e.time} · {e.line}
                    </span>
                    <span>{nf.format(e.qty)} EA</span>
                  </p>
                  {(e.defects > 0 || e.note) && (
                    <p className="mt-0.5 text-slate-400">
                      {e.defects > 0 && `불량 ${e.defects}건 (${e.defectType})`}
                      {e.defects > 0 && e.note && " · "}
                      {e.note}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Card>

        {/* ── ② 자동 집계 ── */}
        <Card className="self-start">
          <SectionHeader
            title="② 실시간 자동 집계"
            desc="현장 입력이 집계 서버로 전송되어 라인·불량 유형별로 자동 합산됩니다."
          />
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "총 생산", value: `${nf.format(agg.produced)} EA` },
              { label: "계획 달성률", value: pct(agg.rate) },
              { label: "불량", value: `${agg.defect}건` },
              { label: "불량률", value: pct(agg.defectRate) },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-slate-200 px-3.5 py-2.5">
                <p className="text-[11px] text-slate-500">{s.label}</p>
                <p className="mt-0.5 text-lg font-bold text-slate-900">{s.value}</p>
              </div>
            ))}
          </div>
          <ChartFromSpec
            spec={{
              type: "bar",
              title: "라인별 계획 대비 실적 (EA)",
              compact: true,
              labels: agg.byLine.map((r) => r.line),
              series: [
                { name: "계획", color: CHART.neutral, values: agg.byLine.map((r) => r.plan) },
                { name: "실적", color: CHART.primary, values: agg.byLine.map((r) => r.produced) },
              ],
            }}
          />
          <div className="mt-4">
            <DataTable data={{ columns: ["라인", "품목", "계획", "실적", "달성률", "불량"], rows: lineTable }} />
          </div>
        </Card>
      </div>

      {/* ── ③ AI 보고서 ── */}
      <Card>
        <SectionHeader
          title={
            <span className="flex items-center gap-2">
              ③ 일일 생산·품질 보고서 <AiBadge />
            </span>
          }
          desc="집계 결과를 근거로 AI가 보고서 초안을 작성합니다. 발송 전 내용을 검토하세요."
          action={
            reportAt ? (
              <Button variant="secondary" onClick={generateReport} disabled={generating}>
                <IconSparkles size={15} />
                {reportStale ? "최신 입력 반영해 다시 생성" : "다시 생성"}
              </Button>
            ) : undefined
          }
        />

        {generating ? (
          <ul className="space-y-1.5 py-6">
            {genSteps.map((s, i) => {
              const current = i === genSteps.length - 1;
              return (
                <li key={s} className="flex items-center gap-2 text-[13px]">
                  {current ? (
                    <span className="shimmer-text font-medium">{s}…</span>
                  ) : (
                    <>
                      <IconCheck size={12} className="shrink-0 text-slate-400" />
                      <span className="text-slate-400">{s}</span>
                    </>
                  )}
                </li>
              );
            })}
            {genSteps.length === 0 && <li className="shimmer-text text-[13px] font-medium">보고서를 준비하는 중…</li>}
          </ul>
        ) : !reportAt ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 py-10">
            <p className="text-sm text-slate-500">현장 입력 {entries.length}건이 집계되어 있습니다. 버튼 한 번으로 보고서가 완성됩니다.</p>
            <Button onClick={generateReport}>
              <IconSparkles size={15} />
              AI 보고서 생성
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {reportStale && (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
                보고서 생성 이후 새 현장 입력이 있습니다. &lsquo;다시 생성&rsquo;하면 최신 집계가 반영됩니다.
              </p>
            )}
            {/* 보고서 문서 목업 — report-print-area: 'PDF 저장' 인쇄 시 이 영역만 출력 */}
            <div className="report-print-area overflow-hidden rounded-xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-slate-900">일일 생산·품질 보고서</h3>
                    <p className="mt-0.5 text-xs text-slate-500">(주)데모컴퍼니 생산본부 · 2026-07-20 · 문서번호 RPT-260720-01</p>
                  </div>
                  <p className="text-xs text-slate-400">작성 AXpoint AI · {reportAt} 자동 생성</p>
                </div>
              </div>
              <div className="space-y-5 px-6 py-5">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[
                    { label: "총 생산 실적", value: `${nf.format(agg.produced)} EA`, sub: `계획 ${nf.format(agg.plan)} EA` },
                    { label: "계획 달성률", value: pct(agg.rate), sub: "집계 시점 기준" },
                    { label: "불량", value: `${agg.defect}건`, sub: `불량률 ${pct(agg.defectRate)}` },
                    { label: "특이사항", value: `${agg.notes.length}건`, sub: "설비·금형 관련" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-slate-50 px-3.5 py-3">
                      <p className="text-[11px] text-slate-500">{s.label}</p>
                      <p className="mt-0.5 text-base font-bold text-slate-900">{s.value}</p>
                      <p className="text-[11px] text-slate-400">{s.sub}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-500">1. 라인별 실적</p>
                  <DataTable data={{ columns: ["라인", "품목", "계획", "실적", "달성률", "불량"], rows: lineTable }} />
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-500">2. 불량 현황</p>
                  <ul className="space-y-1 text-sm text-slate-600">
                    {agg.byDefect.map((d) => (
                      <li key={d.type} className="flex items-center justify-between rounded-lg border border-slate-100 px-3.5 py-2">
                        <span>{d.type}</span>
                        <span className="font-semibold text-slate-800">{d.count}건</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    3. AI 종합 의견 <AiBadge />
                  </p>
                  <ul className="space-y-1.5 text-sm leading-relaxed text-slate-600">
                    {aiComments.map((c) => (
                      <li key={c}>· {c}</li>
                    ))}
                  </ul>
                </div>

                {/* 결재선 */}
                <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
                  {APPROVAL_LINE.map((a) => (
                    <div key={a.role} className="rounded-lg border border-slate-200 px-3 py-2.5 text-center">
                      <p className="text-[11px] text-slate-400">{a.role}</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-800">{a.name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{a.state}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <p className="mr-auto text-xs text-slate-400">
                PDF 저장은 브라우저 인쇄 대화상자에서 &lsquo;PDF로 저장&rsquo;을 선택하세요.
              </p>
              <Button variant="secondary" onClick={() => window.print()}>
                <IconFile size={14} />
                PDF 저장
              </Button>
              <Button onClick={downloadExcel}>
                <IconDownload size={14} />
                Excel 다운로드
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
