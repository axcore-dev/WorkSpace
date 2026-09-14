"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/modal";
import { Badge, Button, Card, DataTable, EmptyState, FIELD, FIELD_SM, SectionHeader } from "@/components/ui";
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
import type { Drawing, DrawingBomLine, DrawingStatus } from "@/data/drawings";
import type { Tone } from "@/data/types";
import { autoMapLines, drawingKey, isDerived, isLatest, latestOf, nextRev, parseBomRows, revisionsOf, unmappedCount } from "@/lib/design-state";
import { parseSheet } from "@/lib/sheet";
import { useDesign } from "./design-provider";

const STATUS_TONE: Record<DrawingStatus, Tone> = { 승인: "green", "확인 필요": "amber", 폐기: "slate" };

type FormMode = "new" | "rev" | "derived";
const FORM_TITLE: Record<FormMode, string> = { new: "도면 등록", rev: "새 리비전 등록", derived: "파생 도면 등록" };

/**
 * 도면 관리 — 왼쪽 트리, 오른쪽 선택한 도면.
 *
 * **리비전 하나가 도면 하나다.** 트리에는 `26MSX-S03-20 Rev.C` · `Rev.B` · `Rev.A` 가 각각 한 줄이고, Rev.C 는 Rev.B 에서
 * 파생된 도면이다. 옛 리비전을 고르면 그때의 BOM 과 파일이 그대로 보인다. 「새 리비전 등록」은 지금 리비전에서만,
 * 「파생 도면 등록」은 고른 리비전을 근거로 한다(P1 은 Rev.B 기준, P2 는 Rev.C 기준처럼).
 *
 * 등록 · 리비전 · 파생은 한 폼이다. 도면 파일(.dwg)은 이름만 받는다 — 파일 자체를 저장하는 곳은 아직 없다. **부품 추출은
 * 정제 엑셀이 한다**: 엑셀을 고르면 「품명 · 호칭 · 규격 · 수량」 열을 읽어 BOM 줄을 채우고, 품목 마스터에서 호칭+규격 →
 * 품명 순으로 자동 매핑한다. 못 찾은 줄은 미매핑으로 남아 BOM 관리에서 사람이 맺는다. 줄은 손으로도 고치고 더할 수 있다.
 */
export function DrawingManager() {
  const { state, items, dispatch, notify, can } = useDesign();
  const drawings = state.drawings;
  const canEdit = can("drawings");

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [mode, setMode] = useState<FormMode | null>(null);
  const [drawingFile, setDrawingFile] = useState("");
  const [excelFile, setExcelFile] = useState("");
  const [form, setForm] = useState({ code: "", name: "", change: "", requester: "고객사(미창)", vehicle: "", projectCode: "" });
  const [lines, setLines] = useState<DrawingBomLine[]>([]);
  const [lineErrors, setLineErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");

  const dwgRef = useRef<HTMLInputElement>(null);
  const xlsRef = useRef<HTMLInputElement>(null);

  // 원본 도면번호(파생 아닌 것) → 그 리비전들 + 이 도면번호를 근거로 한 파생 도면들의 리비전들
  const rootCodes = [...new Set(drawings.filter((d) => !isDerived(d)).map((d) => d.code))].sort();
  const derivedCodesOf = (code: string) => [...new Set(drawings.filter((d) => d.parent === code).map((d) => d.code))].sort();

  const selected = drawings.find((d) => drawingKey(d) === selectedKey) ?? (rootCodes[0] ? latestOf(drawings, rootCodes[0]) : undefined) ?? drawings[0];
  const select = (d: Drawing) => setSelectedKey(drawingKey(d));
  const current = selected ? isLatest(drawings, selected) : false;
  const siblings = selected ? revisionsOf(drawings, selected.code) : [];
  const previous = selected ? siblings[siblings.indexOf(selected) + 1] : undefined;
  const parentNode = selected?.parent ? drawings.find((d) => d.code === selected.parent && d.rev === selected.parentRev) : undefined;
  const parentLatest = selected?.parent ? latestOf(drawings, selected.parent) : undefined;
  const children = selected ? derivedCodesOf(selected.code).map((c) => latestOf(drawings, c)!) : [];

  const q = query.trim().toLowerCase();
  const hit = (d: Drawing) => !q || [d.code, d.rev, d.name, d.vehicle ?? "", d.projectCode ?? ""].some((v) => v.toLowerCase().includes(q));
  const tree = rootCodes
    .map((code) => ({
      root: revisionsOf(drawings, code),
      kids: derivedCodesOf(code).flatMap((c) => revisionsOf(drawings, c)),
    }))
    .map((g) => (g.root.some(hit) ? { root: g.root, kids: g.kids } : { root: [], kids: g.kids.filter(hit) }))
    .filter((g) => g.root.length + g.kids.length > 0);

  function openForm(m: FormMode) {
    if (!selected) return;
    setMode(m);
    setDrawingFile("");
    setExcelFile("");
    setLineErrors([]);
    setLines(m === "rev" ? selected.bom : []);
    setForm({
      code: m === "rev" ? selected.code : m === "derived" ? `${selected.code}-P${derivedCodesOf(selected.code).length + 1}` : "",
      name: m === "rev" ? selected.name : "",
      change: m === "rev" ? "" : "최초 등록",
      requester: "고객사(미창)",
      vehicle: "",
      projectCode: "",
    });
  }

  /** 정제 엑셀 → BOM 줄. 실제 추출은 여기서 끝난다(도면 파일 파싱은 하지 않는다) */
  async function pickExcel(file: File) {
    setExcelFile(file.name);
    try {
      const sheet = await parseSheet(file);
      const parsed = parseBomRows([sheet.columns, ...sheet.rows]);
      setLineErrors(parsed.errors);
      if (parsed.lines.length > 0) setLines(autoMapLines(parsed.lines, items));
    } catch (e) {
      setLineErrors([e instanceof Error ? e.message : "파일을 읽지 못했어요"]);
    }
  }

  const setLine = (i: number, patch: Partial<DrawingBomLine>) =>
    setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch, ...(patch.item || patch.spec || patch.size ? { itemCode: null } : {}) } : l)));
  const addLine = () => setLines((ls) => [...ls, { item: "", spec: "", size: "", qty: 1, itemCode: null }]);
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, k) => k !== i));

  const validLines = lines.filter((l) => l.item.trim() && l.qty > 0);
  const canSubmit = (!!drawingFile || !!excelFile || mode === "rev") && !!form.code.trim() && !!form.name.trim() && !busy;

  async function submit() {
    if (!mode || !selected) return;
    setBusy(true);
    const mapped = autoMapLines(validLines, items);
    const code = form.code.trim();
    const ok =
      mode === "rev"
        ? await dispatch({ type: "revise", code: selected.code, change: form.change, requester: form.requester, excel: !!excelFile, lines: mapped })
        : await dispatch({
            type: "register",
            drawing: {
              code,
              name: form.name.trim(),
              parent: mode === "derived" ? selected.code : undefined,
              parentRev: mode === "derived" ? selected.rev : undefined,
              vehicle: mode === "derived" ? undefined : form.vehicle.trim(),
              projectCode: mode === "derived" ? undefined : form.projectCode.trim(),
              excel: !!excelFile,
              change: form.change,
              requester: form.requester,
            },
            lines: mapped,
          });
    setBusy(false);
    if (!ok) return;
    const unmapped = mapped.filter((l) => !l.itemCode).length;
    notify(
      mode === "rev"
        ? `${selected.code} ${nextRev(selected.rev)} 를 등록했어요${unmapped ? ` · 미매핑 ${unmapped}건은 BOM 관리에서 맺어 주세요` : ""}`
        : `${code} 를 등록했어요 · 부품 ${mapped.length}건${unmapped ? ` (미매핑 ${unmapped})` : ""}`,
    );
    setSelectedKey(mode === "rev" ? drawingKey({ code: selected.code, rev: nextRev(selected.rev) }) : drawingKey({ code, rev: "Rev.A" }));
    setMode(null);
  }

  async function discard() {
    if (!selected) return;
    if (await dispatch({ type: "discard", code: selected.code })) notify(`${selected.code} 를 폐기했어요`);
    setDiscardOpen(false);
  }

  async function acknowledge() {
    if (!selected) return;
    if (await dispatch({ type: "acknowledge", code: selected.code })) notify("개정 반영을 확인했어요");
  }

  async function saveMeta() {
    if (!selected) return;
    if (await dispatch({ type: "rename", code: selected.code, name: editName.trim() })) notify("도면명을 바꿨어요");
    setEditOpen(false);
  }

  if (!selected) {
    return (
      <EmptyState
        title="등록된 도면이 없어요"
        desc="도면 파일이나 정제 엑셀을 올려 첫 도면을 등록해 주세요. 엑셀의 부품 목록이 BOM 이 됩니다."
        action={
          canEdit ? (
            <Button size="sm" onClick={() => setMode("new")}>
              <IconPlus size={14} />
              도면 등록
            </Button>
          ) : undefined
        }
      />
    );
  }

  const rootOf = parentLatest ?? selected;

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card padding={false} className="h-fit">
        <div className="border-b border-slate-100 p-4">
          {canEdit && (
            <Button size="sm" className="mb-3 w-full" onClick={() => openForm("new")}>
              <IconPlus size={14} />
              도면 등록
            </Button>
          )}
          <div className="relative">
            <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="도면번호 · 리비전 · 도면명 · 차종"
              aria-label="도면 검색"
              className={`${FIELD} py-2 pl-9 text-[13px]`}
            />
          </div>
        </div>
        <ul className="thin-scroll max-h-[560px] overflow-y-auto p-2">
          {tree.map(({ root, kids }, gi) => (
            <li key={root[0]?.code ?? kids[0]?.code ?? gi}>
              {root.map((d) => (
                <TreeRow key={drawingKey(d)} d={d} current={isLatest(drawings, d)} active={d === selected} onClick={() => select(d)} />
              ))}
              {kids.map((d) => (
                <TreeRow key={drawingKey(d)} d={d} depth current={isLatest(drawings, d)} active={d === selected} onClick={() => select(d)} />
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
                {current ? <Badge tone={STATUS_TONE[selected.status]}>{selected.status}</Badge> : <Badge tone="slate">{selected.status === "폐기" ? "폐기" : "대체됨"}</Badge>}
                <Badge tone="slate">{isDerived(selected) ? "파생" : "원본"}</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-600">{selected.name}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {selected.vehicle ?? rootOf.vehicle ?? "차종 미지정"} · {selected.projectCode ?? rootOf.projectCode ?? "관리번호 미지정"} · {selected.updated} · {selected.author}
              </p>
            </div>
            {canEdit && (
              <Button size="sm" variant="secondary" onClick={() => setMenuOpen(true)} aria-label={`${selected.code} ${selected.rev} 처리`} title="도면 처리">
                <IconSettings size={15} />
              </Button>
            )}
          </div>

          {current && selected.status === "확인 필요" && parentLatest && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="flex items-start gap-2 text-sm text-amber-700">
                <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
                상위 {parentLatest.code} {parentLatest.rev} 개정됨 · 이 도면은 {selected.parentRev} 기준
              </p>
              {canEdit && (
                <Button size="sm" onClick={acknowledge}>
                  <IconCheck size={14} />
                  개정 반영 확인
                </Button>
              )}
            </div>
          )}

          <p className="mt-3 space-x-3 text-xs text-slate-400">
            <span>
              변경 내용 <span className="text-slate-600">{selected.change}</span> · 요청 <span className="text-slate-600">{selected.requester || "—"}</span>
            </span>
            {previous && (
              <span>
                이전 리비전{" "}
                <button type="button" onClick={() => select(previous)} className="cursor-pointer font-medium text-primary-600 hover:text-primary-700">
                  {previous.rev}
                </button>
              </span>
            )}
            {selected.parent && (
              <span>
                근거 도면{" "}
                <button
                  type="button"
                  onClick={() => (parentNode ?? parentLatest) && select(parentNode ?? parentLatest!)}
                  className="cursor-pointer font-medium text-primary-600 hover:text-primary-700"
                >
                  {selected.parent} {selected.parentRev}
                </button>
              </span>
            )}
          </p>
        </Card>

        {siblings.length > 1 && (
          <Card>
            <SectionHeader title={`${selected.code} 리비전 ${siblings.length}건`} desc="리비전마다 별도 도면이에요 — 다음 리비전은 앞 리비전에서 파생됐어요" />
            <div className="thin-scroll -mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-400">
                    {["리비전", "일자", "변경 내용", "요청 주체", "BOM", "파일", "상태"].map((h) => (
                      <th key={h} scope="col" className="whitespace-nowrap px-3 py-2.5 first:pl-1 last:pr-1">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {siblings.map((r, i) => (
                    <tr key={r.rev} onClick={() => select(r)} className={`cursor-pointer transition-colors hover:bg-slate-50/70 ${r === selected ? "bg-slate-50" : ""}`}>
                      <td className="whitespace-nowrap px-3 py-3 pl-1 font-medium text-slate-900">{r.rev}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">{r.updated}</td>
                      <td className="px-3 py-3 text-slate-600">{r.change}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">{r.requester}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">{r.bom.length ? `${r.bom.length}건` : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className="flex items-center gap-1.5">
                          <FileChip name={`${r.code}_${r.rev}.dwg`} />
                          {r.excel ? <FileChip name={`${r.code}_BOM_${r.rev}.xlsx`} /> : <span className="text-xs text-slate-300">xlsx 없음</span>}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 pr-1">
                        <Badge tone={i === 0 && r.status !== "폐기" ? "green" : "slate"}>{r.status === "폐기" ? "폐기" : i === 0 ? "현재" : "대체됨"}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Card>
          <SectionHeader
            title={`BOM ${selected.bom.length}건`}
            desc={unmappedCount(selected) > 0 ? `미매핑 ${unmappedCount(selected)}건 — BOM 관리에서 품목 마스터와 맺어 주세요` : selected.bom.length ? "전부 품목 마스터에 매핑됐어요" : undefined}
          />
          <DataTable
            dense
            data={{
              columns: ["품명", "호칭", "규격", "수량", "매핑 품목"],
              rows: selected.bom.map((l) => [
                l.item,
                l.spec || "—",
                l.size || "—",
                String(l.qty),
                l.itemCode ? { badge: `${l.itemCode} ${items.find((it) => it.code === l.itemCode)?.name ?? ""}`.trim(), tone: "green" as Tone } : { badge: "미매핑", tone: "red" as Tone },
              ]),
            }}
            emptyText="이 리비전에는 BOM 이 없어요 — 정제 엑셀 없이 등록된 도면이에요"
          />
        </Card>

        {children.length > 0 && (
          <Card>
            <SectionHeader title={`파생 도면 ${children.length}건`} desc={`${selected.code} 를 근거로 한 도면 — 지금 리비전 기준`} />
            <DataTable
              dense
              data={{
                columns: ["도면번호", "도면명", "리비전", "근거 리비전", "상태"],
                rows: children.map((c) => [c.code, c.name, c.rev, c.parentRev ?? "—", { badge: c.status, tone: STATUS_TONE[c.status] }]),
              }}
              onRowClick={(i) => select(children[i])}
            />
          </Card>
        )}
      </div>

      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} size="sm" title={`${selected.code} ${selected.rev} 처리`}>
        <ul className="space-y-2 p-5">
          {[
            { label: current ? "새 리비전 등록" : `새 리비전 등록 (지금 리비전 ${siblings[0]?.rev} 에서만)`, run: () => openForm("rev"), off: !current || selected.status === "폐기" },
            { label: `파생 도면 등록 (${selected.rev} 기준)`, run: () => openForm("derived"), off: selected.status === "폐기" },
            {
              label: "이름 수정 (모든 리비전)",
              run: () => {
                setEditName(selected.name);
                setEditOpen(true);
              },
              off: false,
            },
            { label: "폐기 (모든 리비전)", run: () => setDiscardOpen(true), off: selected.status === "폐기", danger: true },
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
              {busy ? "등록 중…" : "등록"}
            </Button>
          </div>
        }
      >
        <div className="space-y-5 p-5">
          {mode === "derived" && (
            <p className="text-xs text-slate-500">
              근거 도면 {selected.code} {selected.rev}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <FilePick label="도면 파일" hint=".dwg · .dxf · .pdf — 이름만 기록해요" value={drawingFile} onPick={() => dwgRef.current?.click()} />
            <FilePick label="정제 엑셀" hint=".xlsx · .csv — 품명 · 호칭 · 규격 · 수량" value={excelFile} onPick={() => xlsRef.current?.click()} />
          </div>
          <input
            ref={dwgRef}
            type="file"
            accept=".dwg,.dxf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setDrawingFile(f.name);
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
              if (f) void pickExcel(f);
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
            {mode === "new" && (
              <>
                <Field label="차종" value={form.vehicle} onChange={(v) => setForm({ ...form, vehicle: v })} />
                <Field label="관리번호" value={form.projectCode} onChange={(v) => setForm({ ...form, projectCode: v })} />
              </>
            )}
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-700">
                자재 목록 {validLines.length}건
                {validLines.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-slate-500">매핑 {validLines.filter((l) => l.itemCode).length} · 미매핑 {validLines.filter((l) => !l.itemCode).length}</span>
                )}
              </p>
              <Button size="sm" variant="secondary" onClick={addLine}>
                <IconPlus size={13} />
                줄 추가
              </Button>
            </div>
            {lineErrors.length > 0 && (
              <ul className="mb-2 space-y-0.5 text-xs text-red-600">
                {lineErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            {lines.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-400">
                정제 엑셀을 고르면 부품이 여기에 추출돼요. 없으면 「줄 추가」로 직접 적거나, 도면 파일만으로 등록할 수 있어요.
              </p>
            ) : (
              <div className="thin-scroll overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-medium text-slate-400">
                      {["품명", "호칭", "규격", "수량", "매핑", ""].map((h, i) => (
                        <th key={i} scope="col" className="px-2 py-2 first:pl-0">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((l, i) => (
                      <tr key={i}>
                        <td className="py-1.5 pr-2">
                          <input aria-label={`${i + 1}행 품명`} value={l.item} onChange={(e) => setLine(i, { item: e.target.value })} className={FIELD_SM} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input aria-label={`${i + 1}행 호칭`} value={l.spec} onChange={(e) => setLine(i, { spec: e.target.value })} className={FIELD_SM} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input aria-label={`${i + 1}행 규격`} value={l.size} onChange={(e) => setLine(i, { size: e.target.value })} className={FIELD_SM} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            aria-label={`${i + 1}행 수량`}
                            type="number"
                            min={1}
                            value={l.qty}
                            onChange={(e) => setLine(i, { qty: Math.max(0, Number(e.target.value) || 0) })}
                            className={`${FIELD_SM} w-20`}
                          />
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-xs">
                          {l.itemCode ? <Badge tone="green">{l.itemCode}</Badge> : <Badge tone="red">미매핑</Badge>}
                        </td>
                        <td className="py-1.5 pl-2 text-right">
                          <button type="button" onClick={() => removeLine(i)} aria-label={`${i + 1}행 삭제`} className="cursor-pointer text-slate-400 hover:text-red-600">
                            <IconXCircle size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
            <span className="font-semibold text-slate-900">{selected.code}</span> 의 모든 리비전({siblings.length}건)을 폐기합니다. 폐기된 도면으로는 발주서를 쓸 수 없어요.
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
            <Button onClick={saveMeta} disabled={!editName.trim()}>
              저장
            </Button>
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

function TreeRow({ d, depth, current, active, onClick }: { d: Drawing; depth?: boolean; current: boolean; active: boolean; onClick: () => void }) {
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
        <span className={`block truncate text-[13px] ${active ? "font-semibold text-slate-900" : current ? "text-slate-700" : "text-slate-400"}`}>
          {d.code} <span className="font-normal text-slate-400">{d.rev}</span>
        </span>
        <span className="block truncate text-[11px] text-slate-400">{d.name}</span>
      </span>
      {!current && d.status !== "폐기" && <span className="shrink-0 text-[11px] text-slate-300">대체됨</span>}
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
        value ? "border-slate-300 bg-slate-50 text-slate-700" : "border-slate-300 text-slate-400 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-600"
      }`}
    >
      {value ? <IconFile size={20} /> : <IconUpload size={20} />}
      <span className="text-sm font-medium">{value || label}</span>
      <span className="text-xs text-slate-400">{hint}</span>
    </button>
  );
}

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={`${FIELD} ${disabled ? "bg-slate-50 text-slate-400" : ""}`} />
    </div>
  );
}
