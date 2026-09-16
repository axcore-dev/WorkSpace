"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Field } from "@/components/admin/form-parts";
import { IconPlus } from "@/components/icons";
import { Modal } from "@/components/modal";
import { Button, Card, FIELD, SectionHeader, Toast } from "@/components/ui";
import { useToast } from "@/components/use-toast";
import { MODULES } from "@/data/modules";
import { BUILTIN, type Concept } from "@/lib/ai/ontology";
import { ApiRequestError } from "@/lib/api";
import {
  applyConceptTemplate,
  createConcept,
  deleteConcept,
  listConcepts,
  listConceptTemplates,
  previewConceptSql,
  updateConcept,
  type ConceptPreviewDto,
  type ConceptTemplateDto,
  type ExternalConceptAdminDto,
  type ExternalConceptInput,
  type ExternalSystemAdminDto,
} from "@/lib/admin-api";
import { isDraft } from "@/lib/ai/refine-types";
import { DraftModal } from "./draft-modal";
import { RefinePanel } from "./refine-panel";
import { EditModal } from "./shared";

/**
 * 온톨로지 스튜디오 — 이 회사의 개념을 표(캔버스)로 보고 외부 개념을 고친다.
 *
 * 세 칸이다. 왼쪽 탐색기(시스템별 개념 · 관계), 가운데 캔버스(개념 카드 + 관계 선), 오른쪽 속성 패널(속성 · 원천 컬럼 · 관계).
 * 내장 개념(AXPoint, `BUILTIN`)은 읽기 전용으로 같이 그린다 — `mes_work_order → drawing` 같은 관계가 보여야 한다.
 * 외부 개념은 운영 콘솔의 행이라 여기서 등록 · 수정 · 삭제 · 템플릿 적용 · SQL 미리보기를 한다.
 *
 * 캔버스는 시스템마다 한 줄, 카드는 고정 크기다. 끌어 옮기기는 두지 않았다 — 개념이 스무 개를 넘어 줄이 엉킬 때 넣는다.
 */

/** 캔버스 노드 — 내장과 외부를 같은 모양으로 */
type Node = {
  id: string;
  name: string;
  system: string; // 그룹 이름. 내장은 "AXPoint"
  kind: string; // AXPoint · MES · ERP …
  tab: string;
  description: string;
  attrs: Record<string, string>;
  relations: { attr: string; to: string }[];
  formula?: string;
  synonyms: string[];
  /** 「DB 에서 초안 만들기」 가 넣고 아직 다듬지 않은 것 — 설명 끝 `[초안 — …]` 로 판별한다(#116 「정하지 않은 것」: 상태 필드는 나중에) */
  draft: boolean;
  external?: ExternalConceptAdminDto;
};

const CARD_W = 232;
const CARD_HEAD = 44;
const ATTR_ROW = 18;
const ATTRS_SHOWN = 5;
/** 한 띠에 접는 열 수. 넘으면 다음 줄로 — 카드가 옆으로 끝없이 늘어나지 않게 */
const COLS = 4;
const GAP_X = 72;
/** 같은 원천 안의 줄 간격 · 원천(띠) 사이 간격 */
const GAP_Y_INNER = 56;
const GAP_Y = 96;
const PAD = 32;

/** 자동 배치에서 사용자가 끌어 옮긴 만큼. 개념 id → (dx, dy) */
type Offsets = Record<string, { x: number; y: number }>;
/** 끌어 옮긴 위치는 이 브라우저에만 남는다 — 서버 표에 열을 두지 않았다. 회사마다 다른 키 */
const layoutKey = (workspaceId: number) => `axpoint-ontology-layout:${workspaceId}`;
/** 끌기 시작으로 볼 최소 이동. 그 안이면 클릭(선택) */
const DRAG_THRESHOLD = 4;
const SNAP = 8;

function readOffsets(key: string): Offsets {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Offsets) : {};
  } catch {
    return {};
  }
}

function writeOffsets(key: string, o: Offsets) {
  try {
    if (Object.keys(o).length) localStorage.setItem(key, JSON.stringify(o));
    else localStorage.removeItem(key);
  } catch {
    // 저장 못 해도 화면은 그대로 — 새로고침하면 자동 배치로 돌아갈 뿐
  }
}

function cardHeight(n: Node): number {
  const shown = Math.min(Object.keys(n.attrs).length, ATTRS_SHOWN);
  return CARD_HEAD + shown * ATTR_ROW + (Object.keys(n.attrs).length > ATTRS_SHOWN ? ATTR_ROW : 0) + 12;
}

/** 「초안」 외곽선 태그 — 카드 · 탐색기 줄 · 속성 패널 머리. 점선 테두리로 「아직 정해지지 않았다」 를 말한다 */
function DraftTag() {
  return <span className="shrink-0 rounded border border-dashed border-amber-700 px-1 font-sans text-[10px] font-medium leading-4 text-amber-700">초안</span>;
}

function tabLabel(tab: string): string {
  for (const m of MODULES) {
    const s = m.subfunctions.find((x) => x.id === tab);
    if (s) return `${m.name} · ${s.name}`;
  }
  return tab;
}

export function OntologyStudio({ workspaceId, systems }: { workspaceId: number; systems: ExternalSystemAdminDto[] }) {
  const [external, setExternal] = useState<ExternalConceptAdminDto[] | null>(null);
  const [templates, setTemplates] = useState<ConceptTemplateDto[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ systemId: number; initial: ExternalConceptAdminDto | null } | null>(null);
  const [removing, setRemoving] = useState<ExternalConceptAdminDto | null>(null);
  const [templateFor, setTemplateFor] = useState<number | null>(null);
  const [drafting, setDrafting] = useState(false);
  /** 「AI 로 다듬기」 대상 — 초안 넣기 직후 · 헤더 버튼 · 속성 패널 버튼에서 연다 */
  const [refining, setRefining] = useState<{ rowId: number; conceptId: string; name: string }[] | null>(null);
  /** 개념 목록을 못 불러온 이유. 있으면 캔버스에 「다시 불러오기」 — 빈 목록과 장애를 구분한다(#116 3번) */
  const [loadError, setLoadError] = useState<string | null>(null);
  /** 카드 좌표가 잡힌 다음 렌더에서 이 개념으로 스크롤한다 — 초안을 넣거나 다듬은 뒤 캔버스 아래에 생긴 카드를 보여 주려고(#116 4번) */
  const pendingScroll = useRef<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [toast, showToast] = useToast();
  /** 끌어 옮긴 카드들. 자동 배치 위에 더한다 */
  const [offsets, setOffsets] = useState<Offsets>({});
  const storageKey = layoutKey(workspaceId);
  // localStorage 는 서버에 없다. 마운트 뒤 마이크로태스크로 읽어야 프리렌더 결과와 어긋나지 않는다
  useEffect(() => {
    queueMicrotask(() => setOffsets(readOffsets(storageKey)));
  }, [storageKey]);
  /** 진행 중인 끌기. ref 인 이유: 포인터가 움직일 때마다 다시 그릴 것은 offsets 뿐이다 */
  const drag = useRef<{ id: string; startX: number; startY: number; fromX: number; fromY: number; moved: boolean } | null>(null);
  /** 지금 끌고 있는 카드 — 그림자 · 커서만 바꾼다(렌더는 ref 를 못 읽는다) */
  const [draggingId, setDraggingId] = useState<string | null>(null);

  /** 목록을 다시 읽는다. 실패하면 null — 삼키지 않고 캔버스에 이유를 보인다. 마지막으로 읽은 목록은 그대로 둔다 */
  async function reload(): Promise<ExternalConceptAdminDto[] | null> {
    try {
      const list = await listConcepts(workspaceId);
      setExternal(list);
      setLoadError(null);
      return list;
    } catch (e) {
      setLoadError(e instanceof ApiRequestError ? e.message : "개념을 불러오지 못했어요");
      return null;
    }
  }

  const drafts = (external ?? []).filter((d) => isDraft(d.description));
  const asTargets = (list: ExternalConceptAdminDto[]) => list.map((d) => ({ rowId: d.id, conceptId: d.conceptId, name: d.name }));
  useEffect(() => {
    let alive = true;
    Promise.all([listConcepts(workspaceId), listConceptTemplates(workspaceId).catch(() => [])])
      .then(([c, t]) => {
        if (!alive) return;
        setExternal(c);
        setTemplates(t);
        setLoadError(null);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setExternal([]);
        setLoadError(e instanceof ApiRequestError ? e.message : "개념을 불러오지 못했어요");
      });
    return () => {
      alive = false;
    };
  }, [workspaceId]);

  const fail = (e: unknown, fallback: string) => showToast(e instanceof ApiRequestError ? e.message : fallback, "error");

  /** 내장 + 외부를 한 목록으로. 시스템 순서는 내장 → 등록 순 */
  const nodes = useMemo<Node[]>(() => {
    const builtin: Node[] = BUILTIN.map((c: Concept) => ({
      id: c.id,
      name: c.name,
      system: "AXPoint",
      kind: "AXPoint",
      tab: c.tab,
      description: c.description,
      attrs: c.attrs,
      relations: c.relations ?? [],
      formula: c.formula,
      synonyms: c.synonyms,
      draft: false,
    }));
    const ext: Node[] = (external ?? []).map((d) => ({
      id: d.conceptId,
      name: d.name,
      system: d.systemName,
      kind: d.systemKind,
      tab: d.tab,
      description: d.description,
      attrs: d.attrs,
      relations: d.relations,
      formula: d.formula ?? undefined,
      synonyms: d.synonyms,
      draft: isDraft(d.description),
      external: d,
    }));
    return [...builtin, ...ext];
  }, [external]);

  /** 원천(시스템)마다 한 띠, 띠 안에서는 COLS 열로 접는다. 카드 좌표는 여기서 한 번 정한다 */
  const layout = useMemo(() => {
    const groups = new Map<string, Node[]>();
    for (const n of nodes) groups.set(n.system, [...(groups.get(n.system) ?? []), n]);
    const pos = new Map<string, { x: number; y: number; w: number; h: number }>();
    let y = PAD;
    let maxX = 0;
    const rows: { system: string; kind: string; y: number }[] = [];
    for (const [system, list] of groups) {
      rows.push({ system, kind: list[0].kind, y });
      let rowH = 0;
      list.forEach((n, i) => {
        const col = i % COLS;
        if (i > 0 && col === 0) {
          y += rowH + GAP_Y_INNER;
          rowH = 0;
        }
        const h = cardHeight(n);
        const x = PAD + col * (CARD_W + GAP_X);
        pos.set(n.id, { x, y, w: CARD_W, h });
        rowH = Math.max(rowH, h);
        maxX = Math.max(maxX, x + CARD_W);
      });
      y += rowH + GAP_Y;
    }
    return { pos, rows, width: maxX + PAD, height: y };
  }, [nodes]);

  /** 자동 배치 + 끌어 옮긴 만큼. 선과 카드가 같은 좌표를 본다. 캔버스는 옮긴 카드까지 품게 늘린다 */
  const placed = useMemo(() => {
    const pos = new Map<string, { x: number; y: number; w: number; h: number }>();
    let width = layout.width;
    let height = layout.height;
    for (const [id, p] of layout.pos) {
      const o = offsets[id];
      const q = o ? { ...p, x: Math.max(PAD, p.x + o.x), y: Math.max(PAD, p.y + o.y) } : p;
      pos.set(id, q);
      width = Math.max(width, q.x + q.w + PAD);
      height = Math.max(height, q.y + q.h + PAD);
    }
    return { pos, width, height };
  }, [layout, offsets]);

  const edges = useMemo(() => {
    const out: { from: string; to: string; attr: string; key: string }[] = [];
    for (const n of nodes) for (const r of n.relations) if (layout.pos.has(r.to)) out.push({ from: n.id, to: r.to, attr: r.attr, key: `${n.id}.${r.attr}` });
    return out;
  }, [nodes, layout]);

  /** 카드 끌기 — 문턱을 넘기 전에는 클릭(선택)으로 둔다. 놓을 때 8px 격자에 맞추고 브라우저에 남긴다 */
  function onCardPointerDown(e: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (e.button !== 0) return;
    const o = offsets[id] ?? { x: 0, y: 0 };
    drag.current = { id, startX: e.clientX, startY: e.clientY, fromX: o.x, fromY: o.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onCardPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!d.moved) setDraggingId(d.id);
    d.moved = true;
    setOffsets((prev) => ({ ...prev, [d.id]: { x: d.fromX + dx, y: d.fromY + dy } }));
  }
  function onCardPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // pointercancel 뒤에는 이미 풀려 있다
    }
    if (d.moved) {
      setOffsets((prev) => {
        const o = prev[d.id];
        const next = { ...prev, [d.id]: { x: Math.round(o.x / SNAP) * SNAP, y: Math.round(o.y / SNAP) * SNAP } };
        writeOffsets(storageKey, next);
        return next;
      });
    }
    setDraggingId(null);
    // 클릭 핸들러가 이 뒤에 온다 — 끌었으면 선택으로 치지 않게 moved 를 남겨 둔다
    setTimeout(() => (drag.current = null), 0);
  }
  function resetLayout() {
    setOffsets({});
    writeOffsets(storageKey, {});
  }
  const movedCount = Object.keys(offsets).length;

  const current = nodes.find((n) => n.id === selected) ?? null;
  const groupsInOrder = layout.rows.map((r) => r.system);

  /** 선택하고, 배치가 잡히는 다음 렌더에서 그 카드로 스크롤한다 */
  const focus = (id: string) => {
    setSelected(id);
    pendingScroll.current = id;
  };
  /** 스크롤은 DOM 일이라 효과에서. 목록을 다시 읽은 직후에는 아직 배치가 없으니 좌표가 생길 때까지 기다린다 */
  useEffect(() => {
    const id = pendingScroll.current;
    if (!id) return;
    const p = placed.pos.get(id);
    if (!p) return;
    pendingScroll.current = null;
    canvasRef.current?.scrollTo({ left: Math.max(0, p.x - PAD), top: Math.max(0, p.y - PAD - 18), behavior: "smooth" });
  }, [placed, selected]);

  /** 현재 다음의 초안 — 속성 패널 「다음 초안 ›」. 마지막이면 처음으로 돈다 */
  const nextDraftAfter = (id: string | null): Node | null => {
    const list = nodes.filter((n) => n.draft);
    if (list.length === 0) return null;
    const i = list.findIndex((n) => n.id === id);
    return list[(i + 1) % list.length];
  };

  async function remove(d: ExternalConceptAdminDto) {
    try {
      await deleteConcept(workspaceId, d.id);
      showToast(`${d.name}을 삭제했어요`);
      setRemoving(null);
      if (selected === d.conceptId) setSelected(null);
      await reload();
    } catch (e) {
      fail(e, "삭제하지 못했어요");
    }
  }

  async function applyTemplate(systemId: number, key: string) {
    try {
      const before = external?.length ?? 0;
      await applyConceptTemplate(workspaceId, systemId, key);
      setTemplateFor(null);
      const list = await reload();
      if (list === null) showToast("템플릿은 넣었지만 목록을 다시 불러오지 못했어요", "error");
      else showToast(list.length > before ? `개념 ${list.length - before}개를 넣었어요` : "이미 전부 들어 있어요");
    } catch (e) {
      fail(e, "템플릿을 적용하지 못했어요");
    }
  }

  const linkedSystems = systems.filter((s) => s.host);

  return (
    <Card padding={false} className="mt-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <SectionHeader
          title="온톨로지"
          desc="AI 가 읽는 개념. AXPoint 내장 개념은 읽기 전용이고, 외부 시스템 개념은 여기서 고쳐요."
        />
        <div className="flex gap-2">
          {drafts.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setRefining(asTargets(drafts))}>
              AI 로 다듬기 (초안 {drafts.length})
            </Button>
          )}
          {linkedSystems.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setDrafting(true)}>
              DB 에서 초안 만들기
            </Button>
          )}
          {linkedSystems.length > 0 && templates.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setTemplateFor(linkedSystems[0].id)}>
              템플릿 적용
            </Button>
          )}
          {linkedSystems.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setEditing({ systemId: linkedSystems[0].id, initial: null })}>
              <IconPlus size={14} />
              개념 추가
            </Button>
          )}
        </div>
      </div>

      {linkedSystems.length === 0 && (
        <p className="border-b border-slate-200 px-5 py-3 text-[13px] text-slate-500">
          접속 정보가 있는 외부 시스템이 없어요. 위에서 시스템을 먼저 등록하면 개념을 넣을 수 있어요.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_300px]" style={{ minHeight: 480 }}>
        {/* ── 탐색기 ── */}
        <aside className="thin-scroll max-h-[640px] overflow-y-auto border-b border-slate-200 bg-slate-50/60 p-4 text-[13px] lg:border-b-0 lg:border-r">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">모델 탐색기</p>
          {groupsInOrder.map((system) => {
            const inGroup = nodes.filter((n) => n.system === system);
            const draftCount = inGroup.filter((n) => n.draft).length;
            return (
              <div key={system} className="mb-4">
                <p className="mb-1 flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                  {system}
                  <span className="text-slate-400">· {inGroup.length}</span>
                  {draftCount > 0 && <span className="text-amber-700">· 다듬을 초안 {draftCount}</span>}
                </p>
                <ul className="space-y-0.5">
                  {inGroup.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(n.id)}
                        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left font-mono text-[12px] transition-colors duration-150 ${
                          selected === n.id ? "bg-white text-slate-900 ring-1 ring-slate-200" : "text-slate-600 hover:bg-white/70"
                        }`}
                      >
                        <span className="min-w-0 truncate">{n.id}</span>
                        {n.draft && <DraftTag />}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <p className="mb-1 mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">관계 {edges.length}</p>
          <ul className="space-y-0.5 font-mono text-[11px] text-slate-500">
            {edges.map((e) => (
              <li key={e.key} className="truncate">
                {e.from}.{e.attr} → {e.to}
              </li>
            ))}
          </ul>
        </aside>

        {/* ── 캔버스 ── */}
        <div ref={canvasRef} className="thin-scroll relative max-h-[640px] overflow-auto" style={{ backgroundImage: "radial-gradient(#cbd5e1 0.8px, transparent 0.8px)", backgroundSize: "20px 20px" }}>
          {loadError && (
            <div role="alert" className="sticky left-0 top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-red-200 bg-red-50 px-4 py-2 text-[13px] text-red-700">
              <span>외부 개념을 불러오지 못했어요 — {loadError}</span>
              <button type="button" onClick={() => void reload()} className="cursor-pointer font-medium underline-offset-2 hover:underline">
                다시 불러오기
              </button>
            </div>
          )}
          <div className="relative" style={{ width: placed.width, height: placed.height }}>
            {layout.rows.map((r) => {
              const draftCount = nodes.filter((n) => n.system === r.system && n.draft).length;
              return (
                <span key={r.system} className="absolute whitespace-nowrap font-mono text-[11px] text-slate-400" style={{ left: PAD, top: r.y - 18 }}>
                  {r.system}
                  {draftCount > 0 && <span className="ml-2 text-amber-700">다듬을 초안 {draftCount}</span>}
                </span>
              );
            })}
            <svg className="pointer-events-none absolute inset-0" width={placed.width} height={placed.height} aria-hidden>
              <defs>
                <marker id="ont-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L8,4 L0,8 z" fill="#94a3b8" />
                </marker>
              </defs>
              {edges.map((e) => {
                const a = placed.pos.get(e.from)!;
                const b = placed.pos.get(e.to)!;
                // 두 카드가 옆으로 떨어져 있으면 좌우 면, 아래위로 떨어져 있으면 위아래 면에서 선을 뽑는다 — 카드를 가로지르지 않게
                const dx = b.x + b.w / 2 - (a.x + a.w / 2);
                const dy = b.y + b.h / 2 - (a.y + a.h / 2);
                const horizontal = Math.abs(dx) > a.w && Math.abs(dy) < Math.max(a.h, b.h);
                const p1 = horizontal ? { x: dx > 0 ? a.x + a.w : a.x, y: a.y + 24 } : { x: a.x + a.w / 2, y: dy > 0 ? a.y + a.h : a.y };
                const p2 = horizontal ? { x: dx > 0 ? b.x : b.x + b.w, y: b.y + 24 } : { x: b.x + b.w / 2, y: dy > 0 ? b.y : b.y + b.h };
                const d = horizontal
                  ? `M${p1.x},${p1.y} C${(p1.x + p2.x) / 2},${p1.y} ${(p1.x + p2.x) / 2},${p2.y} ${p2.x},${p2.y}`
                  : `M${p1.x},${p1.y} C${p1.x},${(p1.y + p2.y) / 2} ${p2.x},${(p1.y + p2.y) / 2} ${p2.x},${p2.y}`;
                const hot = selected === e.from || selected === e.to;
                const label = `${e.attr} N:1`;
                const mx = (p1.x + p2.x) / 2;
                const my = (p1.y + p2.y) / 2;
                const lw = label.length * 6.2 + 8;
                return (
                  <g key={e.key}>
                    <path d={d} fill="none" stroke={hot ? "#0f172a" : "#94a3b8"} strokeWidth={hot ? 1.5 : 1} markerEnd="url(#ont-arrow)" />
                    <rect x={mx - lw / 2} y={my - 8} width={lw} height={15} rx={3} fill="#ffffff" stroke={hot ? "#0f172a" : "#e2e8f0"} strokeWidth={0.5} />
                    <text x={mx} y={my + 3} textAnchor="middle" fontSize={10} fontFamily="ui-monospace, monospace" fill={hot ? "#0f172a" : "#64748b"}>
                      {label}
                    </text>
                  </g>
                );
              })}
            </svg>
            {nodes.map((n) => {
              const p = placed.pos.get(n.id)!;
              const keys = Object.keys(n.attrs);
              const active = selected === n.id;
              const dragging = draggingId === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    if (drag.current?.moved) return;
                    setSelected(n.id);
                  }}
                  onPointerDown={(e) => onCardPointerDown(e, n.id)}
                  onPointerMove={onCardPointerMove}
                  onPointerUp={onCardPointerUp}
                  onPointerCancel={onCardPointerUp}
                  title="끌어서 옮길 수 있어요"
                  className={`absolute touch-none rounded-lg border bg-white text-left ${
                    dragging ? "cursor-grabbing shadow-lg" : "cursor-grab transition-colors duration-150"
                  } ${active ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200 hover:border-slate-400"}`}
                  style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
                >
                  <div className="flex items-start justify-between gap-2 px-3 pt-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-slate-900">{n.name}</p>
                      <p className="truncate font-mono text-[11px] text-slate-500">{n.id}</p>
                    </div>
                    <span className="flex shrink-0 gap-1">
                      {n.draft && <DraftTag />}
                      <span className="rounded border border-slate-200 px-1.5 font-mono text-[10px] text-slate-500">{n.kind}</span>
                    </span>
                  </div>
                  <ul className="mt-1.5 px-3 font-mono text-[11px] leading-[18px] text-slate-600">
                    {keys.slice(0, ATTRS_SHOWN).map((k) => (
                      <li key={k} className="flex justify-between gap-2">
                        <span className="truncate">{k}</span>
                        <span className="shrink-0 text-slate-400">{n.relations.some((r) => r.attr === k) ? "FK" : ""}</span>
                      </li>
                    ))}
                    {keys.length > ATTRS_SHOWN && <li className="text-slate-400">+{keys.length - ATTRS_SHOWN}</li>}
                  </ul>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 속성 패널 ── */}
        <aside className="thin-scroll max-h-[640px] overflow-y-auto border-t border-slate-200 p-4 text-[13px] lg:border-l lg:border-t-0">
          {current === null ? (
            <p className="text-slate-500">개념을 누르면 속성 · 원천 · 관계가 여기 보여요.</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">엔티티 속성</p>
                {current.draft && nodes.filter((n) => n.draft).length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = nextDraftAfter(current.id);
                      if (next) focus(next.id);
                    }}
                    className="cursor-pointer text-[12px] text-slate-700 underline-offset-2 hover:underline"
                  >
                    다음 초안 ›
                  </button>
                )}
              </div>
              <h4 className="mt-1 flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                {current.name}
                {current.draft && <DraftTag />}
              </h4>
              <p className="font-mono text-[12px] text-slate-500">{current.id}</p>
              <p className="mt-2 text-slate-600">{current.description}</p>
              <dl className="mt-3 grid grid-cols-[64px_1fr] gap-y-1 text-[12px]">
                <dt className="text-slate-500">원천</dt>
                <dd className="font-mono text-slate-700">{current.system}</dd>
                <dt className="text-slate-500">권한 탭</dt>
                <dd className="text-slate-700">{tabLabel(current.tab)}</dd>
                {current.synonyms.length > 0 && (
                  <>
                    <dt className="text-slate-500">동의어</dt>
                    <dd className="text-slate-700">{current.synonyms.join(" · ")}</dd>
                  </>
                )}
                {current.formula && (
                  <>
                    <dt className="text-slate-500">계산</dt>
                    <dd className="text-slate-700">{current.formula}</dd>
                  </>
                )}
              </dl>

              <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">속성 {Object.keys(current.attrs).length}</p>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {Object.entries(current.attrs).map(([k, label]) => {
                  const rel = current.relations.find((r) => r.attr === k);
                  const filterable = current.external?.filterColumns.includes(k);
                  return (
                    <li key={k} className="px-2.5 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[12px] text-slate-900">{k}</span>
                        <span className="flex gap-1 text-[10px] text-slate-500">
                          {filterable && <span className="rounded border border-slate-200 px-1">filter</span>}
                          {rel && <span className="rounded border border-slate-200 px-1">→ {rel.to}</span>}
                        </span>
                      </div>
                      <p className="text-[12px] text-slate-500">{label}</p>
                    </li>
                  );
                })}
              </ul>

              {current.external && (
                <>
                  <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">SQL</p>
                  <pre className="thin-scroll max-h-40 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-[11px] leading-relaxed text-slate-700">
                    {current.external.sql}
                  </pre>
                  <p className="mt-1 font-mono text-[11px] text-slate-500">order by {current.external.orderBy}</p>
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setEditing({ systemId: current.external!.systemId, initial: current.external! })}>
                      수정
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setRefining(asTargets([current.external!]))}>
                      AI 로 다듬기
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRemoving(current.external!)}>
                      삭제
                    </Button>
                  </div>
                </>
              )}
              {!current.external && <p className="mt-4 text-[12px] text-slate-500">내장 개념은 코드(`lib/ai/ontology.ts`)에서 고쳐요.</p>}
            </>
          )}
        </aside>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 px-5 py-2.5 font-mono text-[11px] text-slate-500">
        <span>엔티티 {nodes.length}</span>
        <span>관계 {edges.length}</span>
        <span>원천 {layout.rows.length}</span>
        {movedCount > 0 && (
          <span>
            옮긴 카드 {movedCount} · 이 브라우저에만 남아요 ·{" "}
            <button type="button" onClick={resetLayout} className="cursor-pointer text-slate-700 underline-offset-2 hover:underline">
              배치 초기화
            </button>
          </span>
        )}
        <span className="ml-auto">
          외부 개념 {external?.length ?? 0} · {external === null ? "불러오는 중" : loadError ? <span className="text-red-600">불러오지 못했어요</span> : "최신"}
        </span>
      </div>

      {editing && (
        <ConceptForm
          workspaceId={workspaceId}
          systems={linkedSystems}
          systemId={editing.systemId}
          initial={editing.initial}
          conceptIds={nodes.map((n) => n.id)}
          onClose={() => setEditing(null)}
          onSaved={async (d) => {
            setEditing(null);
            showToast(`${d.name}을 저장했어요`);
            setSelected(d.conceptId);
            await reload();
          }}
          onError={(e) => fail(e, "저장하지 못했어요")}
        />
      )}

      {drafting && (
        <DraftModal
          workspaceId={workspaceId}
          systems={linkedSystems}
          existingIds={nodes.map((n) => n.id)}
          onClose={() => setDrafting(false)}
          onDone={async (added) => {
            setDrafting(false);
            const list = await reload();
            if (list === null) {
              // 넣긴 했는데 목록을 못 읽었다 — 캔버스의 「다시 불러오기」 로 보낸다. 조용히 「초안 0」 으로 보이지 않게
              showToast(added > 0 ? `초안 ${added}개를 넣었지만 목록을 다시 불러오지 못했어요` : "목록을 다시 불러오지 못했어요", "error");
            } else if (added > 0) {
              // 방금 넣은 초안을 바로 다듬기로 넘긴다 — 초안 표시가 남은 것 전부
              showToast(`개념 초안 ${added}개를 넣었어요`);
              setRefining(asTargets(list.filter((d) => isDraft(d.description))));
            } else {
              showToast("새로 넣은 개념이 없어요 — 전부 이미 있어요");
            }
          }}
        />
      )}
      {refining && refining.length > 0 && (
        <RefinePanel
          workspaceId={workspaceId}
          targets={refining}
          onClose={() => {
            // 저장 없이 닫았다 — 초안이 남아 있으면 그 첫 카드로 스크롤 · 선택해서 손으로 다듬을 자리를 보여 준다
            const firstDraft = refining.find((t) => drafts.some((d) => d.id === t.rowId));
            setRefining(null);
            if (firstDraft) focus(firstDraft.conceptId);
          }}
          onApplied={async ({ updated, created, deleted }) => {
            const first = refining[0];
            setRefining(null);
            showToast(`개념 ${updated}개를 고치고 ${created}개를 만들고 ${deleted}개를 지웠어요`);
            const list = await reload();
            // 다듬은 첫 개념을 보여 준다. 지웠으면 남은 초안 중 첫 것으로
            const target = list?.find((d) => d.id === first.rowId) ?? list?.find((d) => isDraft(d.description));
            if (target) focus(target.conceptId);
          }}
        />
      )}

      <Modal
        open={templateFor !== null}
        onClose={() => setTemplateFor(null)}
        title="템플릿 적용"
        desc="템플릿의 개념을 시스템에 넣어요. 이미 있는 개념 id 는 건너뛰어요."
        size="sm"
      >
        <Field id="tpl-system" label="시스템">
          <select id="tpl-system" value={templateFor ?? ""} onChange={(e) => setTemplateFor(Number(e.target.value))} className={`${FIELD} cursor-pointer`}>
            {linkedSystems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.kind})
              </option>
            ))}
          </select>
        </Field>
        <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {templates.map((t) => (
            <li key={t.key} className="flex items-center justify-between gap-3 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-slate-900">{t.name}</p>
                <p className="text-xs text-slate-500">
                  {t.kind} · 개념 {t.conceptCount}개
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => templateFor !== null && void applyTemplate(templateFor, t.key)}>
                넣기
              </Button>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="개념을 삭제할까요?"
        desc={removing ? `${removing.name}(${removing.conceptId})을 지우면 AI 가 더는 이 자료를 읽지 못해요.` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              취소
            </Button>
            <Button variant="danger" onClick={() => removing && void remove(removing)}>
              삭제
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-500">다른 개념이 이 개념을 가리키는 관계는 그대로 남아요. 필요하면 그쪽도 고쳐 주세요.</p>
      </Modal>

      <Toast toast={toast} />
    </Card>
  );
}

/* ─────────────────────────── 개념 폼 ─────────────────────────── */

const TAB_OPTIONS = MODULES.flatMap((m) => m.subfunctions.map((s) => ({ value: s.id, label: `${m.name} · ${s.name}` })));

function ConceptForm({
  workspaceId,
  systems,
  systemId: initialSystemId,
  initial,
  conceptIds,
  onClose,
  onSaved,
  onError,
}: {
  workspaceId: number;
  systems: ExternalSystemAdminDto[];
  systemId: number;
  initial: ExternalConceptAdminDto | null;
  conceptIds: string[];
  onClose: () => void;
  onSaved: (d: ExternalConceptAdminDto) => Promise<void>;
  onError: (e: unknown) => void;
}) {
  const [systemId, setSystemId] = useState(initialSystemId);
  const [d, setD] = useState<ExternalConceptInput>({
    conceptId: initial?.conceptId ?? "",
    name: initial?.name ?? "",
    synonyms: initial?.synonyms ?? [],
    tab: initial?.tab ?? TAB_OPTIONS[0]?.value ?? "",
    description: initial?.description ?? "",
    attrs: initial?.attrs ?? {},
    relations: initial?.relations ?? [],
    formula: initial?.formula ?? null,
    sql: initial?.sql ?? "select * from ",
    filterColumns: initial?.filterColumns ?? [],
    orderBy: initial?.orderBy ?? "",
    sortOrder: initial?.sortOrder ?? 0,
  });
  const [synonymText, setSynonymText] = useState((initial?.synonyms ?? []).join(", "));
  const [preview, setPreview] = useState<ConceptPreviewDto | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<ExternalConceptInput>) => setD((p) => ({ ...p, ...patch }));
  const attrKeys = Object.keys(d.attrs);
  const canSave = d.conceptId.trim() !== "" && d.name.trim() !== "" && d.description.trim() !== "" && attrKeys.length > 0 && d.sql.trim() !== "" && d.orderBy.trim() !== "" && !saving;

  async function runPreview() {
    setPreviewing(true);
    try {
      setPreview(await previewConceptSql(workspaceId, systemId, d.sql));
    } catch (e) {
      onError(e);
    } finally {
      setPreviewing(false);
    }
  }

  /** 미리보기가 준 컬럼 중 attrs 에 없는 것을 라벨 비운 채로 더한다. 정렬이 비어 있으면 첫 컬럼으로 */
  function fillFromPreview() {
    if (!preview || preview.columns.length === 0) return;
    const next = { ...d.attrs };
    for (const c of preview.columns) if (!(c in next)) next[c] = "";
    set({ attrs: next, orderBy: d.orderBy || preview.columns[0] });
  }

  function setAttr(key: string, label: string) {
    set({ attrs: { ...d.attrs, [key]: label } });
  }
  function removeAttr(key: string) {
    const next = { ...d.attrs };
    delete next[key];
    set({ attrs: next, filterColumns: d.filterColumns.filter((c) => c !== key), relations: d.relations.filter((r) => r.attr !== key) });
  }
  function toggleFilter(key: string) {
    set({ filterColumns: d.filterColumns.includes(key) ? d.filterColumns.filter((c) => c !== key) : [...d.filterColumns, key] });
  }
  function setRelation(key: string, to: string) {
    const rest = d.relations.filter((r) => r.attr !== key);
    set({ relations: to ? [...rest, { attr: key, to }] : rest });
  }

  async function save() {
    setSaving(true);
    try {
      const input: ExternalConceptInput = {
        ...d,
        conceptId: d.conceptId.trim(),
        name: d.name.trim(),
        description: d.description.trim(),
        synonyms: synonymText.split(",").map((s) => s.trim()).filter(Boolean),
        formula: d.formula?.trim() || null,
        sql: d.sql.trim(),
        orderBy: d.orderBy.trim(),
      };
      const saved = initial ? await updateConcept(workspaceId, initial.id, input) : await createConcept(workspaceId, systemId, input);
      if (saved) await onSaved(saved);
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditModal open onClose={onClose} title={initial ? "개념 수정" : "개념 추가"} canSave={canSave} onSave={() => void save()} size="xl">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {!initial && (
          <Field id="c-system" label="시스템" required>
            <select id="c-system" value={systemId} onChange={(e) => setSystemId(Number(e.target.value))} className={`${FIELD} cursor-pointer`}>
              {systems.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.kind})
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field id="c-id" label="개념 id" required hint="모델이 고르는 값. 영문 소문자 · 숫자 · 밑줄. 예: mes_downtime">
          <input id="c-id" value={d.conceptId} onChange={(e) => set({ conceptId: e.target.value })} className={`${FIELD} font-mono`} />
        </Field>
        <Field id="c-name" label="이름" required>
          <input id="c-name" value={d.name} onChange={(e) => set({ name: e.target.value })} className={FIELD} />
        </Field>
        <Field id="c-tab" label="권한 탭" required hint="이 탭이 없는 사람에게는 이름조차 보이지 않아요">
          <select id="c-tab" value={d.tab} onChange={(e) => set({ tab: e.target.value })} className={`${FIELD} cursor-pointer`}>
            {TAB_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="c-syn" label="동의어" hint="쉼표로 구분. 사용자가 쓰는 말">
          <input id="c-syn" value={synonymText} onChange={(e) => setSynonymText(e.target.value)} className={FIELD} />
        </Field>
        <div className="sm:col-span-2">
          <Field id="c-desc" label="설명" required hint="어떤 질문에 쓰는지 한 줄. 모델이 개념을 고를 때 읽어요">
            <textarea id="c-desc" rows={2} value={d.description} onChange={(e) => set({ description: e.target.value })} className={FIELD} />
          </Field>
        </div>
      </div>

      <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">실행 정의</p>
      <Field id="c-sql" label="SQL" required hint="FROM 까지의 SELECT 하나. 서버가 서브쿼리로 감싸 WHERE · ORDER BY · LIMIT 를 붙여요">
        <textarea id="c-sql" rows={5} value={d.sql} onChange={(e) => set({ sql: e.target.value })} className={`${FIELD} font-mono text-[12px]`} spellCheck={false} />
      </Field>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" disabled={previewing || !d.sql.trim()} onClick={() => void runPreview()}>
          {previewing ? "실행 중…" : "미리보기 (5행)"}
        </Button>
        {preview && !preview.error && preview.columns.length > 0 && (
          <Button size="sm" variant="ghost" onClick={fillFromPreview}>
            컬럼 {preview.columns.length}개를 속성에 채우기
          </Button>
        )}
        {preview?.error && <span className="text-[12px] text-red-600">{preview.error}</span>}
        {preview && !preview.error && preview.columns.length === 0 && <span className="text-[12px] text-slate-500">행이 없어요. 컬럼을 알 수 없어요</span>}
      </div>
      {preview && !preview.error && preview.columns.length > 0 && (
        <div className="thin-scroll mt-2 max-h-40 overflow-auto rounded-lg border border-slate-200">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {preview.columns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-2 py-1 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-slate-600">
              {preview.rows.map((r, i) => (
                <tr key={i} className="border-t border-slate-100">
                  {preview.columns.map((c) => (
                    <td key={c} className="max-w-[160px] truncate whitespace-nowrap px-2 py-1">
                      {r[c] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="c-order" label="정렬" required hint="출력 컬럼 이름으로. 예: started_at desc, id desc">
          <input id="c-order" value={d.orderBy} onChange={(e) => set({ orderBy: e.target.value })} className={`${FIELD} font-mono`} />
        </Field>
        <Field id="c-formula" label="계산식" hint="파생값이면 사람이 읽는 식">
          <input id="c-formula" value={d.formula ?? ""} onChange={(e) => set({ formula: e.target.value })} className={FIELD} />
        </Field>
      </div>

      <p className="mb-1 mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
        속성 {attrKeys.length} <span className="font-normal normal-case tracking-normal text-slate-400">— 컬럼 이름 · 모델에게 보일 라벨 · filter 허용 · 가리키는 개념</span>
      </p>
      <div className="rounded-lg border border-slate-200">
        {attrKeys.length === 0 ? (
          <p className="px-3 py-3 text-[12px] text-slate-500">미리보기를 돌린 뒤 「컬럼을 속성에 채우기」를 누르거나 아래에서 직접 더해요.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {attrKeys.map((k) => (
              <li key={k} className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_52px_minmax(0,1fr)_28px] items-center gap-2 px-2 py-1.5 text-[12px]">
                <span className="truncate font-mono text-slate-900">{k}</span>
                <input value={d.attrs[k]} onChange={(e) => setAttr(k, e.target.value)} placeholder="라벨" aria-label={`${k} 라벨`} className={`${FIELD} h-7 px-2 py-0 text-[12px]`} />
                <label className="flex items-center gap-1 text-[11px] text-slate-500">
                  <input type="checkbox" checked={d.filterColumns.includes(k)} onChange={() => toggleFilter(k)} aria-label={`${k} filter 허용`} />
                  filter
                </label>
                <select value={d.relations.find((r) => r.attr === k)?.to ?? ""} onChange={(e) => setRelation(k, e.target.value)} aria-label={`${k} 가 가리키는 개념`} className={`${FIELD} h-7 cursor-pointer px-2 py-0 text-[12px]`}>
                  <option value="">—</option>
                  {conceptIds.filter((id) => id !== d.conceptId).map((id) => (
                    <option key={id} value={id}>
                      → {id}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => removeAttr(k)} aria-label={`${k} 삭제`} className="text-slate-400 hover:text-slate-700">
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <NewAttrRow onAdd={(k) => !(k in d.attrs) && setAttr(k, "")} />
      </div>
    </EditModal>
  );
}

function NewAttrRow({ onAdd }: { onAdd: (key: string) => void }) {
  const [v, setV] = useState("");
  const ok = /^[a-z_][a-z0-9_]*$/.test(v);
  return (
    <div className="flex items-center gap-2 border-t border-slate-100 px-2 py-1.5">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && ok) {
            e.preventDefault();
            onAdd(v);
            setV("");
          }
        }}
        placeholder="컬럼 이름 직접 추가"
        aria-label="컬럼 이름 직접 추가"
        className={`${FIELD} h-7 max-w-[220px] px-2 py-0 font-mono text-[12px]`}
      />
      <Button size="sm" variant="ghost" disabled={!ok} onClick={() => { onAdd(v); setV(""); }}>
        추가
      </Button>
    </div>
  );
}
