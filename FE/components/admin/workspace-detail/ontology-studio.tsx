"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconPlus, IconSearch } from "@/components/icons";
import { Modal } from "@/components/modal";
import { Button, Card, FIELD_SM, SectionHeader, Toast } from "@/components/ui";
import { useToast } from "@/components/use-toast";
import { withJosa } from "@/data/ko";
import { MODULES } from "@/data/modules";
import { BUILTIN, type Concept } from "@/lib/ai/ontology";
import { ApiRequestError } from "@/lib/api";
import {
  deleteConcept,
  deleteConcepts,
  listConcepts,
  listConceptTemplates,
  type ConceptTemplateDto,
  type ExternalConceptAdminDto,
  type ExternalSystemAdminDto,
} from "@/lib/admin-api";
import { isDraft } from "@/lib/ai/refine-types";
import { useRefineJobFor } from "@/lib/admin/refine-job";
import { routeEdges, type Route } from "@/lib/ontology-route";
import { ConceptForm } from "./concept-form";
import { DraftModal } from "./draft-modal";
import { RefinePanel } from "./refine-panel";
import { TemplateModal } from "./template-modal";

/**
 * 온톨로지 스튜디오 — 이 회사의 개념을 표(캔버스)로 보고 외부 개념을 고친다.
 *
 * 세 칸이다. 왼쪽 탐색기(시스템별 개념 · 관계), 가운데 캔버스(개념 카드 + 관계 선), 오른쪽 속성 패널(속성 · 원천 컬럼 · 관계).
 * 내장 개념(AXPoint, `BUILTIN`)은 읽기 전용으로 같이 그린다 — `mes_work_order → drawing` 같은 관계가 보여야 한다.
 * 외부 개념은 운영 콘솔의 행이라 여기서 등록 · 수정 · 삭제 · 템플릿 적용 · SQL 미리보기를 한다.
 *
 * 캔버스는 시스템마다 한 띠, 카드는 고정 크기다. 카드는 끌어 옮길 수 있고 위치는 브라우저에 남는다. 관계 선은 `lib/ontology-route`
 * 가 격자 위 A* 로 직교 경로를 잡아 다른 카드를 관통하지 않는다(#116 5번). 끄는 동안은 곧은 점선으로 미리 보이고 놓으면 다시 계산한다.
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
  return <span className="shrink-0 rounded border border-dashed border-amber-700 px-1 font-sans text-[11px] font-medium leading-4 text-amber-700">초안</span>;
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
  /** 모달 밖에서 도는 「AI 로 다듬기」 작업 — 헤더 버튼이 진행 · 완료를 보이고, 끝나는 순간 토스트로 알린다 */
  const refineJob = useRefineJobFor(workspaceId);
  const refineStatusSeen = useRef<string | null>(null);
  useEffect(() => {
    const status = refineJob?.status ?? null;
    if (refineStatusSeen.current === "running" && status === "done" && refineJob) {
      showToast("AI 다듬기가 끝났어요. 검토해 주세요", "ink", { label: "검토", onClick: () => setRefining(refineJob.targets) });
    }
    if (refineStatusSeen.current === "running" && status === "failed" && refineJob) {
      showToast(refineJob.error ?? "AI 다듬기가 멈췄어요", "error", { label: "보기", onClick: () => setRefining(refineJob.targets) });
    }
    refineStatusSeen.current = status;
  }, [refineJob, showToast]);
  /** 끌어 옮긴 카드들. 자동 배치 위에 더한다 — 끄는 동안 매 포인터 이동마다 바뀐다 */
  const [offsets, setOffsets] = useState<Offsets>({});
  /** 놓았을 때의 위치. 관계 선 경로는 이것으로만 계산한다 — 끄는 동안 A* 를 매번 돌리지 않으려고 */
  const [committedOffsets, setCommittedOffsets] = useState<Offsets>({});
  /** 탐색기 검색어 — 이름 · id · 동의어에 맞춘다 */
  const [query, setQuery] = useState("");
  /** 선택한 개념의 관계만 보기. 개념이 스물을 넘으면 기본으로 켠다 — 선 스물여덟 개가 한 캔버스에 겹치면 뭉치가 된다 */
  const [onlySelected, setOnlySelected] = useState<boolean | null>(null);
  const storageKey = layoutKey(workspaceId);
  // localStorage 는 서버에 없다. 마운트 뒤 마이크로태스크로 읽어야 프리렌더 결과와 어긋나지 않는다
  useEffect(() => {
    queueMicrotask(() => {
      const o = readOffsets(storageKey);
      setOffsets(o);
      setCommittedOffsets(o);
    });
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

  /** 놓은 위치 기준 배치 — 선 경로의 입력. 끄는 동안 카드만 움직이고 이건 그대로다 */
  const placedCommitted = useMemo(() => {
    const pos = new Map<string, { x: number; y: number; w: number; h: number }>();
    let width = layout.width;
    let height = layout.height;
    for (const [id, p] of layout.pos) {
      const o = committedOffsets[id];
      const q = o ? { ...p, x: Math.max(PAD, p.x + o.x), y: Math.max(PAD, p.y + o.y) } : p;
      pos.set(id, q);
      width = Math.max(width, q.x + q.w + PAD);
      height = Math.max(height, q.y + q.h + PAD);
    }
    return { pos, width, height };
  }, [layout, committedOffsets]);

  const routes = useMemo<Map<string, Route>>(
    () => routeEdges(edges.map((e) => ({ key: e.key, from: e.from, to: e.to })), placedCommitted.pos, { width: placedCommitted.width, height: placedCommitted.height }),
    [edges, placedCommitted],
  );

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
        // 놓았을 때만 선 경로를 다시 계산한다
        setCommittedOffsets(next);
        return next;
      });
    }
    setDraggingId(null);
    // 클릭 핸들러가 이 뒤에 온다 — 끌었으면 선택으로 치지 않게 moved 를 남겨 둔다
    setTimeout(() => (drag.current = null), 0);
  }
  function resetLayout() {
    setOffsets({});
    setCommittedOffsets({});
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
      showToast(`${withJosa(d.name, "을/를")} 삭제했어요`);
      setRemoving(null);
      if (selected === d.conceptId) setSelected(null);
      await reload();
    } catch (e) {
      fail(e, "삭제하지 못했어요");
    }
  }

  /** 방금 넣은 묶음(템플릿 · DB 초안)을 토스트의 「되돌리기」 로 한 번에 지운다 */
  async function undoInsert(ids: number[]) {
    try {
      const n = await deleteConcepts(workspaceId, ids);
      showToast(`개념 ${n}개를 되돌렸어요`);
      if (selected && (external ?? []).some((d) => ids.includes(d.id) && d.conceptId === selected)) setSelected(null);
      await reload();
    } catch (e) {
      fail(e, "되돌리지 못했어요");
    }
  }

  const linkedSystems = systems.filter((s) => s.host);
  const externalCount = external?.length ?? 0;
  /** 외부 개념이 없고 장애도 아닌 첫 사용 — 「DB 에서 초안 만들기」 를 primary 로 올린다 */
  const firstUse = external !== null && externalCount === 0 && !loadError;
  const conceptOptions = nodes.map((n) => ({ id: n.id, name: n.name, system: n.system }));
  const showOnlySelected = onlySelected ?? nodes.length > 20;
  /** 캔버스에 그릴 선. 「선택한 개념의 관계만」 이 켜져 있고 선택이 있으면 그 카드에 닿는 선만 */
  const visibleEdges = showOnlySelected && selected ? edges.filter((e) => e.from === selected || e.to === selected) : edges;
  const q = query.trim().toLowerCase();
  const matches = (n: Node) => !q || n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q) || n.synonyms.some((s) => s.toLowerCase().includes(q));

  return (
    <Card padding={false} className="mt-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <SectionHeader
          title="온톨로지"
          desc="AI 가 읽는 개념. AXPoint 내장 개념은 읽기 전용이고, 외부 시스템 개념은 여기서 고쳐요."
        />
        <div className="flex gap-2">
          {refineJob ? (
            <Button size="sm" variant={refineJob.status === "done" ? "primary" : "secondary"} onClick={() => setRefining(refineJob.targets)}>
              {refineJob.status === "done"
                ? "다듬기 완료 · 검토하기"
                : refineJob.status === "failed"
                  ? "다듬기 실패 · 보기"
                  : `다듬는 중 ${refineJob.done} / ${refineJob.targets.length}`}
            </Button>
          ) : (
            drafts.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setRefining(asTargets(drafts))}>
                AI 로 다듬기 (초안 {drafts.length})
              </Button>
            )
          )}
          {linkedSystems.length > 0 && (
            <Button size="sm" variant={firstUse ? "primary" : "secondary"} onClick={() => setDrafting(true)}>
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
          <label className="relative mb-3 block">
            <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="ont-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름 · id · 동의어"
              aria-label="개념 검색"
              className={`${FIELD_SM} bg-white pl-8`}
            />
          </label>
          {groupsInOrder.map((system) => {
            const inGroup = nodes.filter((n) => n.system === system);
            const shown = inGroup.filter(matches);
            const draftCount = inGroup.filter((n) => n.draft).length;
            if (q && shown.length === 0) return null;
            return (
              <div key={system} className="mb-4">
                <p className="mb-1 flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                  {system}
                  <span className="text-slate-500">· {q ? `${shown.length}/${inGroup.length}` : inGroup.length}</span>
                  {draftCount > 0 && <span className="text-amber-700">· 다듬을 초안 {draftCount}</span>}
                </p>
                <ul className="space-y-0.5">
                  {shown.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => focus(n.id)}
                        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors duration-150 ${
                          selected === n.id ? "bg-white text-slate-900 ring-1 ring-slate-200" : "text-slate-700 hover:bg-white/70"
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          <span className="text-[12px]">{n.name}</span>
                          <span className="ml-1.5 font-mono text-[11px] text-slate-500">{n.id}</span>
                        </span>
                        {n.draft && <DraftTag />}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {q && !nodes.some(matches) && <p className="text-[12px] text-slate-500">「{query.trim()}」 에 맞는 개념이 없어요.</p>}
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
          {firstUse && (
            <div className="sticky left-0 top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-200 bg-white/95 px-4 py-2 text-[13px] text-slate-700">
              <span>
                {linkedSystems.length === 0
                  ? // 접속 정보가 있는 시스템이 없으면 머리의 버튼 세 개가 아예 없다 — 없는 버튼을 누르라고 하지 않는다
                    "외부 개념이 아직 없어요. 위 「외부 시스템」 에 MES 접속 정보를 먼저 등록하면 그 DB 를 읽어 개념을 만들 수 있어요 — 아래는 AXPoint 내장 개념이에요."
                  : "외부 개념이 아직 없어요. 위의 「DB 에서 초안 만들기」 로 표를 읽어 시작해요 — 아래는 AXPoint 내장 개념이에요."}
              </span>
            </div>
          )}
          <div className="relative" style={{ width: placed.width, height: placed.height }}>
            {layout.rows.map((r) => {
              const draftCount = nodes.filter((n) => n.system === r.system && n.draft).length;
              return (
                <span key={r.system} className="absolute whitespace-nowrap font-mono text-[11px] text-slate-500" style={{ left: PAD, top: r.y - 18 }}>
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
                <marker id="ont-arrow-hot" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L8,4 L0,8 z" fill="#0f172a" />
                </marker>
              </defs>
              {visibleEdges.map((e) => {
                const hot = selected === e.from || selected === e.to;
                const live = draggingId !== null && (e.from === draggingId || e.to === draggingId);
                const route = routes.get(e.key);
                let d: string;
                let dashed = false;
                if (live || !route) {
                  // 끄는 동안(또는 경로를 못 잡은 선)은 지금 위치의 가운데를 곧게 잇는 점선 — 놓으면 직교 경로로 돌아온다
                  const a = placed.pos.get(e.from)!;
                  const b = placed.pos.get(e.to)!;
                  d = `M${a.x + a.w / 2},${a.y + a.h / 2} L${b.x + b.w / 2},${b.y + b.h / 2}`;
                  dashed = true;
                } else {
                  d = route.d;
                  dashed = route.fallback;
                }
                return (
                  <path
                    key={e.key}
                    d={d}
                    fill="none"
                    stroke={hot ? "#0f172a" : "#94a3b8"}
                    strokeWidth={hot ? 1.5 : 1}
                    strokeDasharray={dashed ? "4 3" : undefined}
                    markerEnd={live ? undefined : hot ? "url(#ont-arrow-hot)" : "url(#ont-arrow)"}
                  />
                );
              })}
            </svg>
            {/* 관계 라벨 — 선택한 카드에 닿는 선에만, SVG 가 아니라 카드 위 HTML 층의 칩으로(카드에 가려지지 않게). 카디널리티는 속성 정의에 없어 적지 않는다 */}
            {selected !== null && draggingId === null &&
              visibleEdges
                .filter((e) => (e.from === selected || e.to === selected) && routes.get(e.key))
                .map((e) => {
                  const at = routes.get(e.key)!.labelAt;
                  return (
                    <span
                      key={`lbl-${e.key}`}
                      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded border border-slate-900 bg-white px-1.5 font-mono text-[11px] leading-4 text-slate-900"
                      style={{ left: at.x, top: at.y }}
                    >
                      {e.attr} → {e.to}
                    </span>
                  );
                })}
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
                      <span className="rounded border border-slate-200 px-1.5 font-mono text-[11px] text-slate-500">{n.kind}</span>
                    </span>
                  </div>
                  <ul className="mt-1.5 px-3 font-mono text-[11px] leading-[18px] text-slate-600">
                    {keys.slice(0, ATTRS_SHOWN).map((k) => (
                      <li key={k} className="flex justify-between gap-2">
                        <span className="truncate">{k}</span>
                        <span className="shrink-0 text-slate-500">{n.relations.some((r) => r.attr === k) ? "FK" : ""}</span>
                      </li>
                    ))}
                    {keys.length > ATTRS_SHOWN && <li className="text-slate-500">+{keys.length - ATTRS_SHOWN}</li>}
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
              <h3 className="mt-1 flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                {current.name}
                {current.draft && <DraftTag />}
              </h3>
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
                        <span className="flex gap-1 text-[11px] text-slate-500">
                          {filterable && <span className="rounded border border-slate-200 px-1">조건</span>}
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
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={showOnlySelected} onChange={(e) => setOnlySelected(e.target.checked)} className="accent-slate-900" />
          선택한 개념의 관계만 보기
        </label>
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
          conceptOptions={conceptOptions}
          onClose={() => setEditing(null)}
          onSaved={async (d) => {
            setEditing(null);
            showToast(`${d.name}을 저장했어요`);
            await reload();
            focus(d.conceptId);
          }}
        />
      )}

      {drafting && (
        <DraftModal
          workspaceId={workspaceId}
          systems={linkedSystems}
          existing={external ?? []}
          onClose={() => setDrafting(false)}
          onDone={async (added, ids) => {
            setDrafting(false);
            const list = await reload();
            if (list === null) {
              // 넣긴 했는데 목록을 못 읽었다 — 캔버스의 「다시 불러오기」 로 보낸다. 조용히 「초안 0」 으로 보이지 않게
              showToast(added > 0 ? `초안 ${added}개를 넣었지만 목록을 다시 불러오지 못했어요` : "목록을 다시 불러오지 못했어요", "error");
            } else if (added > 0) {
              // 방금 넣은 초안을 바로 다듬기로 넘긴다 — 초안 표시가 남은 것 전부. 토스트의 「되돌리기」 는 이번에 넣은 것만 지운다
              showToast(`개념 초안 ${added}개를 넣었어요`, "ink", { label: "되돌리기", onClick: () => void undoInsert(ids) });
              setRefining(asTargets(list.filter((d) => isDraft(d.description))));
            } else {
              showToast("새로 넣은 개념이 없어요 — 전부 이미 있어요");
            }
          }}
        />
      )}

      {templateFor !== null && (
        <TemplateModal
          workspaceId={workspaceId}
          systems={linkedSystems}
          templates={templates}
          existing={external ?? []}
          initialSystemId={templateFor}
          onClose={() => setTemplateFor(null)}
          onDone={async (inserted) => {
            setTemplateFor(null);
            const list = await reload();
            if (list === null) showToast("템플릿은 넣었지만 목록을 다시 불러오지 못했어요", "error");
            else if (inserted.length === 0) showToast("새로 넣은 개념이 없어요 — 전부 이미 있어요");
            else {
              showToast(`개념 ${inserted.length}개를 넣었어요`, "ink", { label: "되돌리기", onClick: () => void undoInsert(inserted.map((c) => c.id)) });
              focus(inserted[0].conceptId);
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
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="개념을 삭제하시겠습니까?"
        desc={removing ? `${removing.name}(${removing.conceptId}) 개념을 지우면 AI 가 더는 이 자료를 읽지 못합니다.` : undefined}
        size="sm"
        closeButton={false}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              유지
            </Button>
            <Button variant="danger" onClick={() => removing && void remove(removing)}>
              삭제
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-500">다른 개념이 이 개념을 가리키는 관계는 그대로 남습니다. 필요하면 그쪽도 고쳐 주세요.</p>
      </Modal>

      <Toast toast={toast} />
    </Card>
  );
}
