"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/modal";
import { Badge, Button, Card, DataTable, FIELD, SectionHeader } from "@/components/ui";
import {
  IconAlertTriangle,
  IconCheck,
  IconDownload,
  IconFile,
  IconPlus,
  IconSearch,
  IconSettings,
  IconUpload,
  IconXCircle,
} from "@/components/icons";
import { DRAWINGS, nextRev, type Drawing, type DrawingBomLine, type DrawingStatus } from "@/data/drawings";
import type { Tone } from "@/data/types";

const STATUS_TONE: Record<DrawingStatus, Tone> = { 승인: "green", "확인 필요": "amber", 폐기: "slate" };

type FormMode = "new" | "rev" | "derived";
const FORM_TITLE: Record<FormMode, string> = { new: "도면 등록", rev: "새 리비전 등록", derived: "파생 도면 등록" };

export function DrawingManager() {
  const [drawings, setDrawings] = useState<Drawing[]>(DRAWINGS);
  const [selectedCode, setSelectedCode] = useState<string>(DRAWINGS[0].code);
  const [query, setQuery] = useState("");

  const [mode, setMode] = useState<FormMode | null>(null);
  const [drawingFile, setDrawingFile] = useState("");
  const [excelFile, setExcelFile] = useState("");
  const [form, setForm] = useState({ code: "", name: "", change: "", requester: "고객사(미창)" });
  const [lines, setLines] = useState<DrawingBomLine[]>([]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");

  const dwgRef = useRef<HTMLInputElement>(null);
  const xlsRef = useRef<HTMLInputElement>(null);

  const selected = drawings.find((d) => d.code === selectedCode) ?? drawings[0];
  const children = drawings.filter((d) => d.parent === selected?.code);
  const parent = selected?.parent ? drawings.find((d) => d.code === selected.parent) : undefined;

  const q = query.trim().toLowerCase();
  const hit = (d: Drawing) =>
    !q || [d.code, d.name, d.vehicle ?? "", d.projectCode ?? ""].some((v) => v.toLowerCase().includes(q));
  const tree = drawings
    .filter((d) => d.kind === "원본")
    .map((r) => ({ root: r, kids: drawings.filter((d) => d.parent === r.code) }))
    .filter((g) => hit(g.root) || g.kids.some(hit))
    .map((g) => ({ root: g.root, kids: hit(g.root) ? g.kids : g.kids.filter(hit) }));

  function openForm(m: FormMode) {
    setMode(m);
    setDrawingFile("");
    setExcelFile("");
    setLines(m === "rev" ? selected.bom : []);
    setForm({
      code: m === "rev" ? selected.code : m === "derived" ? `${selected.code}-P${children.length + 1}` : "",
      name: m === "rev" ? selected.name : "",
      change: m === "rev" ? "" : "최초 등록",
      requester: "고객사(미창)",
    });
  }

  /** 파일을 고르면 추출된 것처럼 자재 목록을 채운다 (실제 파싱은 서버 몫) */
  function afterPick() {
    if (lines.length === 0) {
      setLines([
        { item: "GUIDE POST", spec: "MYKP", size: "Φ32-140L", qty: "4" },
        { item: "SPRING-LIFT", spec: "SWF", size: "12-50", qty: "3" },
      ]);
    }
  }

  const today = "2026-08-20";

  function submit() {
    if (mode === "rev") {
      const nr = nextRev(selected.rev);
      setDrawings((prev) =>
        prev.map((d) => {
          if (d.code === selected.code) {
            return {
              ...d,
              rev: nr,
              updated: today,
              excel: d.excel || !!excelFile,
              bom: lines,
              revisions: [
                { rev: nr, date: today, change: form.change || "변경 내용 미기재", requester: form.requester },
                ...d.revisions,
              ],
            };
          }
          if (d.parent === selected.code && d.status !== "폐기") return { ...d, status: "확인 필요" as DrawingStatus };
          return d;
        }),
      );
      setMode(null);
      return;
    }
    const isDerived = mode === "derived";
    const created: Drawing = {
      code: form.code || "(신규 도면)",
      name: form.name || "이름 미지정",
      rev: "Rev.A",
      kind: isDerived ? "파생" : "원본",
      parent: isDerived ? selected.code : undefined,
      parentRev: isDerived ? selected.rev : undefined,
      vehicle: isDerived ? undefined : "미창 (신규)",
      projectCode: isDerived ? selected.projectCode : undefined,
      excel: !!excelFile,
      author: "설계 외주",
      updated: today,
      status: "승인",
      revisions: [{ rev: "Rev.A", date: today, change: form.change || "최초 등록", requester: form.requester }],
      bom: lines,
    };
    setDrawings((prev) => [...prev, created]);
    setSelectedCode(created.code);
    setMode(null);
  }

  function discard() {
    setDrawings((prev) => prev.map((d) => (d.code === selected.code ? { ...d, status: "폐기" } : d)));
    setDiscardOpen(false);
  }

  function acknowledge() {
    setDrawings((prev) =>
      prev.map((d) => (d.code === selected.code ? { ...d, status: "승인", parentRev: parent?.rev ?? d.parentRev } : d)),
    );
  }

  function saveMeta() {
    setDrawings((prev) => prev.map((d) => (d.code === selected.code ? { ...d, name: editName || d.name } : d)));
    setEditOpen(false);
  }

  const canSubmit = (!!drawingFile || !!excelFile) && !!form.code && !!form.name;

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card padding={false} className="h-fit">
        <div className="border-b border-slate-100 p-4">
          <Button size="sm" className="mb-3 w-full" onClick={() => openForm("new")}>
            <IconPlus size={14} />
            도면 등록
          </Button>
          <div className="relative">
            <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="도면번호 · 도면명 · 차종"
              aria-label="도면 검색"
              className={`${FIELD} py-2 pl-9 text-[13px]`}
            />
          </div>
        </div>
        <ul className="thin-scroll max-h-[560px] overflow-y-auto p-2">
          {tree.map(({ root, kids }) => (
            <li key={root.code}>
              <TreeRow d={root} active={root.code === selectedCode} onClick={() => setSelectedCode(root.code)} />
              {kids.map((k) => (
                <TreeRow
                  key={k.code}
                  d={k}
                  depth
                  active={k.code === selectedCode}
                  onClick={() => setSelectedCode(k.code)}
                />
              ))}
            </li>
          ))}
          {tree.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400">검색 결과가 없습니다</li>}
        </ul>
      </Card>

      <div className="space-y-4">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-slate-900">{selected.code}</h2>
                <span className="text-sm font-semibold text-slate-500">{selected.rev}</span>
                <Badge tone={STATUS_TONE[selected.status]}>{selected.status}</Badge>
                <Badge tone="slate">{selected.kind}</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-600">{selected.name}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {selected.vehicle ?? parent?.vehicle} · {selected.projectCode ?? parent?.projectCode} ·{" "}
                {selected.updated} · {selected.author}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setMenuOpen(true)}
              aria-label={`${selected.code} 처리`}
              title="도면 처리"
            >
              <IconSettings size={15} />
            </Button>
          </div>

          {selected.status === "확인 필요" && parent && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="flex items-start gap-2 text-sm text-amber-700">
                <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
                상위 {parent.code} {parent.rev} 개정됨 · 이 도면은 {selected.parentRev} 기준
              </p>
              <Button size="sm" onClick={acknowledge}>
                <IconCheck size={14} />
                개정 반영 확인
              </Button>
            </div>
          )}

          {parent && (
            <p className="mt-3 text-xs text-slate-400">
              상위{" "}
              <button
                type="button"
                onClick={() => setSelectedCode(parent.code)}
                className="cursor-pointer font-medium text-primary-600 hover:text-primary-700"
              >
                {parent.code} {selected.parentRev}
              </button>
            </p>
          )}
        </Card>

        <Card>
          <SectionHeader title="리비전 이력" />
          <div className="thin-scroll -mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-400">
                  {["리비전", "일자", "변경 내용", "요청 주체", "파일", "상태"].map((h) => (
                    <th key={h} scope="col" className="whitespace-nowrap px-3 py-2.5 first:pl-1 last:pr-1">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selected.revisions.map((r, i) => (
                  <tr key={r.rev} className="transition-colors hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-3 py-3 pl-1 font-medium text-slate-900">{r.rev}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">{r.date}</td>
                    <td className="px-3 py-3 text-slate-600">{r.change}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">{r.requester}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <span className="flex items-center gap-1.5">
                        <FileChip name={`${selected.code}_${r.rev}.dwg`} />
                        {selected.excel ? (
                          <FileChip name={`${selected.code}_BOM_${r.rev}.xlsx`} />
                        ) : (
                          <span className="text-xs text-slate-300">xlsx 없음</span>
                        )}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 pr-1">
                      <Badge
                        tone={i === 0 ? (selected.status === "폐기" ? "slate" : "green") : "slate"}
                      >
                        {i === 0 ? (selected.status === "폐기" ? "폐기" : "현재") : "대체됨"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {children.length > 0 && (
          <Card>
            <SectionHeader title={`파생 도면 ${children.length}건`} />
            <DataTable
              dense
              data={{
                columns: ["도면번호", "도면명", "리비전", "상위 리비전", "상태"],
                rows: children.map((c) => [
                  c.code,
                  c.name,
                  c.rev,
                  c.parentRev ?? "—",
                  { badge: c.status, tone: STATUS_TONE[c.status] },
                ]),
              }}
              onRowClick={(i) => setSelectedCode(children[i].code)}
            />
          </Card>
        )}
      </div>

      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} size="sm" title={`${selected.code} ${selected.rev} 처리`}>
        <ul className="space-y-2 p-5">
          {[
            { label: "새 리비전 등록", run: () => openForm("rev"), off: selected.status === "폐기" },
            { label: "파생 도면 등록", run: () => openForm("derived"), off: selected.status === "폐기" },
            {
              label: "이름 수정",
              run: () => {
                setEditName(selected.name);
                setEditOpen(true);
              },
              off: false,
            },
            { label: "폐기", run: () => setDiscardOpen(true), off: selected.status === "폐기", danger: true },
          ].map((a) => (
            <li key={a.label}>
              <button
                type="button"
                disabled={a.off}
                onClick={() => {
                  setMenuOpen(false);
                  a.run();
                }}
                className={`w-full rounded-lg border px-3.5 py-3 text-left text-sm transition-colors ${
                  a.off
                    ? "cursor-not-allowed border-slate-100 text-slate-300"
                    : a.danger
                      ? "cursor-pointer border-slate-200 text-red-600 hover:border-red-200 hover:bg-red-50"
                      : "cursor-pointer border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      </Modal>

      {/* 등록 · 리비전 · 파생 — 한 화면에서 처리 */}
      <Modal
        open={mode !== null}
        onClose={() => setMode(null)}
        size="xl"
        title={mode ? FORM_TITLE[mode] : ""}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMode(null)}>
              취소
            </Button>
            <Button onClick={submit} disabled={!canSubmit}>
              등록
            </Button>
          </div>
        }
      >
        <div className="space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <FilePick label="도면 파일" hint=".dwg · .dxf" value={drawingFile} onPick={() => dwgRef.current?.click()} />
            <FilePick label="정제 엑셀" hint=".xlsx · .csv" value={excelFile} onPick={() => xlsRef.current?.click()} />
          </div>
          <input
            ref={dwgRef}
            type="file"
            accept=".dwg,.dxf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setDrawingFile(f.name);
                afterPick();
              }
              e.target.value = "";
            }}
          />
          <input
            ref={xlsRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setExcelFile(f.name);
                afterPick();
              }
              e.target.value = "";
            }}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="도면번호" value={form.code} onChange={(v) => setForm({ ...form, code: v })} disabled={mode === "rev"} />
            <Field label="도면명" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field
              label={mode === "rev" ? `변경 내용 (${selected.rev} → ${nextRev(selected.rev)})` : "변경 내용"}
              value={form.change}
              onChange={(v) => setForm({ ...form, change: v })}
            />
            <Field label="요청 주체" value={form.requester} onChange={(v) => setForm({ ...form, requester: v })} />
          </div>

          {lines.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">자재 목록 {lines.length}건</p>
              <DataTable
                dense
                data={{
                  columns: ["품명", "호칭", "규격", "수량"],
                  rows: lines.map((l) => [l.item, l.spec, l.size, l.qty]),
                }}
              />
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        size="sm"
        title="도면 폐기"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDiscardOpen(false)}>
              취소
            </Button>
            <Button variant="danger" onClick={discard}>
              폐기 처리
            </Button>
          </div>
        }
      >
        <div className="flex items-start gap-3 p-5">
          <IconXCircle size={20} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">
              {selected.code} {selected.rev}
            </span>
            을(를) 폐기합니다.
          </p>
        </div>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        size="sm"
        title="도면명 수정"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              취소
            </Button>
            <Button onClick={saveMeta}>저장</Button>
          </div>
        }
      >
        <div className="p-5">
          <Field label="도면명" value={editName} onChange={setEditName} />
        </div>
      </Modal>
    </div>
  );
}

function FileChip({ name }: { name: string }) {
  return (
    <button
      type="button"
      title={name}
      className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
    >
      <IconDownload size={11} />
      {name.split(".").pop()}
    </button>
  );
}

function TreeRow({ d, depth, active, onClick }: { d: Drawing; depth?: boolean; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active}
      className={`flex w-full cursor-pointer items-center gap-2 rounded-lg py-2 pr-2.5 text-left transition-colors duration-150 ${
        depth ? "pl-7" : "pl-2.5"
      } ${active ? "bg-slate-100 ring-1 ring-slate-200" : "hover:bg-slate-50"}`}
    >
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[13px] ${active ? "font-semibold text-slate-900" : "text-slate-700"}`}>
          {d.code}
        </span>
        <span className="block truncate text-[11px] text-slate-400">{d.name}</span>
      </span>
      <span className="shrink-0 text-[11px] text-slate-400">{d.rev}</span>
      {d.status !== "승인" && (
        <span className={`shrink-0 ${d.status === "확인 필요" ? "text-amber-600" : "text-slate-300"}`}>
          {d.status === "확인 필요" ? <IconAlertTriangle size={12} /> : <IconXCircle size={12} />}
        </span>
      )}
    </button>
  );
}

function FilePick({ label, hint, value, onPick }: { label: string; hint: string; value: string; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-7 transition-colors ${
        value
          ? "border-slate-300 bg-slate-50 text-slate-700"
          : "border-slate-300 text-slate-400 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-600"
      }`}
    >
      {value ? <IconFile size={20} /> : <IconUpload size={20} />}
      <span className="text-sm font-medium">{value || label}</span>
      <span className="text-xs text-slate-400">{hint}</span>
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${FIELD} ${disabled ? "bg-slate-50 text-slate-400" : ""}`}
      />
    </div>
  );
}
