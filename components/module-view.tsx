"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChartFromSpec } from "@/components/charts";
import {
  ICON_MAP,
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconDownload,
  IconFilter,
  IconPencil,
  IconPlus,
  IconUpload,
  IconSearch,
} from "@/components/icons";
import { Modal } from "@/components/modal";
import { useModules } from "@/components/module-provider";
import { MembersModal, RecordModal } from "@/components/record-modal";
import { DrawingManager } from "@/components/drawing-manager";
import { PurchaseOrder } from "@/components/purchase-order";
import { ReceivingInspection } from "@/components/receiving-inspection";
import { ReportAutomation } from "@/components/report-automation";
import { AiBadge, Badge, Button, Card, DataTable, EmptyState, FIELD, SectionHeader, Stat , WizardSteps } from "@/components/ui";
import { HR_MEMBERS, ROW_DETAILS } from "@/data/module-details";
import { downloadCsv } from "@/lib/download";
import type { Cell, DetailRecord, Member, ModuleDef, ModulePageData, TabAction, TreeNode } from "@/data/types";

/** 탭별 액션 버튼 정의 — data의 tab.actions로 필요한 곳에만 노출 */
const TAB_ACTIONS: Record<TabAction, { label: string; icon: typeof IconFilter; primary?: boolean }> = {
  filter: { label: "필터", icon: IconFilter },
  export: { label: "내보내기", icon: IconDownload },
  create: { label: "신규 등록", icon: IconPlus, primary: true },
  upload: { label: "엑셀 업로드", icon: IconUpload },
};

const cellText = (c: Cell) => (typeof c === "object" ? c.badge : String(c));

/** 편집 모드에서 드래그(마우스·터치)와 키보드(Space+방향키)로 순서를 바꿀 수 있는 탭 */
function SortableTab({
  tab,
  index,
  editing,
  isActive,
  onSelect,
}: {
  tab: { id: string; label: string; ai?: boolean };
  index: number;
  editing: boolean;
  isActive: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
    disabled: !editing,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...(editing ? { ...attributes, ...listeners } : {})}
      role="tab"
      aria-selected={isActive}
      onClick={() => {
        if (!editing) onSelect();
      }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150 ${
        isDragging ? "z-10" : ""
      } ${
        editing
          ? "cursor-grab touch-none rounded-t-lg border-dashed border-slate-300 bg-slate-50 text-slate-600 active:cursor-grabbing"
          : isActive
            ? "cursor-pointer border-slate-900 text-slate-900"
            : "cursor-pointer border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
      }`}
    >
      {/* 흔들림은 안쪽 요소에 — dnd 이동 transform과 충돌하지 않게 분리 */}
      <span
        className={`inline-flex items-center gap-1.5 ${editing && !isDragging ? "tab-wiggle" : ""}`}
        style={editing && !isDragging ? { animationDelay: `${index * 60}ms` } : undefined}
      >
        {tab.label}
        {tab.ai && <AiBadge />}
      </span>
    </button>
  );
}

function TreeItem({
  node,
  depth = 0,
  selectable,
  onSelect,
}: {
  node: TreeNode;
  depth?: number;
  selectable?: (name: string) => boolean;
  onSelect?: (name: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isSelectable = !!selectable?.(node.name);
  return (
    <li>
      <div className="flex items-center gap-2 rounded-lg py-1.5 pr-2" style={{ paddingLeft: `${depth * 20}px` }}>
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${node.name} ${open ? "접기" : "펼치기"}`}
            onClick={() => setOpen(!open)}
            className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </button>
        ) : (
          <span className="h-5 w-5 shrink-0 text-center text-slate-300">·</span>
        )}
        {isSelectable ? (
          <button
            type="button"
            onClick={() => onSelect?.(node.name)}
            className="group flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-0.5 text-left transition-colors hover:bg-slate-100"
          >
            <span className="text-sm font-medium text-slate-800">{node.name}</span>
            {node.meta && <span className="text-xs text-slate-400">{node.meta}</span>}
            {node.badge && <Badge tone={node.badge.tone}>{node.badge.text}</Badge>}
            <IconChevronRight size={13} className="text-slate-300 transition-colors group-hover:text-slate-500" />
          </button>
        ) : (
          <>
            <span className="text-sm font-medium text-slate-800">{node.name}</span>
            {node.meta && <span className="text-xs text-slate-400">{node.meta}</span>}
            {node.badge && <Badge tone={node.badge.tone}>{node.badge.text}</Badge>}
          </>
        )}
      </div>
      {hasChildren && open && (
        <ul>
          {node.children!.map((c) => (
            <TreeItem key={c.name} node={c} depth={depth + 1} selectable={selectable} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** 신규 등록 팝업 — 테이블 컬럼 기반 공용 폼 */
/**
 * 엑셀 업로드 — 파일 선택 → 정제 결과 확인·수정 → 승인(FR-IV-06, HITL).
 * 데모라 실제 파싱은 하지 않고, 선택한 파일명으로 정제된 것처럼 미리보기를 만든다.
 */
function UploadReviewModal({
  open,
  title,
  columns,
  onApprove,
  onClose,
}: {
  open: boolean;
  title: string;
  columns: string[];
  onApprove: (rows: Cell[][]) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<string[][]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile(name: string) {
    setFileName(name);
    // 데모: 정제 결과 2행을 생성한다. 실제로는 서버 파싱 결과가 들어온다.
    setRows([
      columns.map((c, j) => (j === 0 ? "(신규) 업로드 항목 1" : `${c} 값`)),
      columns.map((c, j) => (j === 0 ? "(신규) 업로드 항목 2" : `${c} 값`)),
    ]);
    setStep(2);
  }

  function close() {
    setStep(1);
    setFileName("");
    setRows([]);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="xl"
      title={`${title} 엑셀 업로드`}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400">{fileName && `${fileName} · ${rows.length}건`}</span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={close}>
              취소
            </Button>
            <Button
              disabled={step !== 2 || rows.length === 0}
              onClick={() => {
                onApprove(rows.map((r) => r as Cell[]));
                close();
              }}
            >
              승인하고 반영
            </Button>
          </div>
        </div>
      }
    >
      <WizardSteps steps={["파일 선택", "정제 결과 확인", "승인"]} current={step} />
      {step === 1 ? (
        <div className="p-5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-6 py-12 text-slate-400 transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-600"
          >
            <IconUpload size={22} />
            <span className="text-sm font-medium">엑셀 파일을 선택하세요</span>
            <span className="text-xs">.xlsx · .csv</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickFile(f.name);
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        <div className="space-y-3 p-5">
          <p className="text-sm text-slate-500">
            아래 내용이 등록됩니다. 값을 눌러 수정할 수 있습니다.
          </p>
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-400">
                  {columns.map((c) => (
                    <th key={c} scope="col" className="px-3 py-2.5">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((v, j) => (
                      <td key={j} className="px-2 py-1.5">
                        <input
                          aria-label={`${i + 1}행 ${columns[j]}`}
                          value={v}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((row, ri) =>
                                ri === i ? row.map((cv, ci) => (ci === j ? e.target.value : cv)) : row,
                              ),
                            )
                          }
                          className="w-full rounded-md border border-transparent px-2 py-1.5 text-sm text-slate-700 transition-colors hover:border-slate-200 focus:border-slate-400 focus:outline-none"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

function CreateRecordModal({
  open,
  title,
  columns,
  onSave,
  onClose,
}: {
  open: boolean;
  title: string;
  columns: string[];
  onSave: (row: string[]) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<string[]>(() => columns.map(() => ""));
  function save() {
    if (!values[0]?.trim()) return;
    onSave(values.map((v) => v.trim() || "—"));
    onClose();
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={`${title} 신규 등록`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={save} disabled={!values[0]?.trim()}>
            등록
          </Button>
        </div>
      }
    >
      <form
        className="grid gap-4 p-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {columns.map((col, i) => (
          <div key={col}>
            <label htmlFor={`cr-${i}`} className="mb-1.5 block text-sm font-medium text-slate-700">
              {col}
              {i === 0 && <span className="ml-0.5 text-red-500">*</span>}
            </label>
            <input id={`cr-${i}`} value={values[i]} onChange={(e) => setValues((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))} className={FIELD} />
          </div>
        ))}
      </form>
    </Modal>
  );
}

/** 인사 관리 전용 — 구성원 등록 팝업 */
function CreateMemberModal({
  open,
  teams,
  onSave,
  onClose,
}: {
  open: boolean;
  teams: string[];
  onSave: (team: string, member: Member) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [team, setTeam] = useState(teams[0] ?? "");
  const [rank, setRank] = useState("사원");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  function save() {
    if (!name.trim()) return;
    const now = new Date();
    const joined = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    onSave(team, {
      name: name.trim(),
      rank,
      phone: phone.trim() || "010-0000-0000",
      email: email.trim() || "new@democompany.co.kr",
      joined,
    });
    onClose();
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="구성원 등록"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={save} disabled={!name.trim()}>
            등록
          </Button>
        </div>
      }
    >
      <form
        className="grid gap-4 p-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div>
          <label htmlFor="cm-name" className="mb-1.5 block text-sm font-medium text-slate-700">
            이름 <span className="text-red-500">*</span>
          </label>
          <input id="cm-name" value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
        </div>
        <div>
          <label htmlFor="cm-team" className="mb-1.5 block text-sm font-medium text-slate-700">
            소속 팀
          </label>
          <select id="cm-team" value={team} onChange={(e) => setTeam(e.target.value)} className={`${FIELD} cursor-pointer`}>
            {teams.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cm-rank" className="mb-1.5 block text-sm font-medium text-slate-700">
            직급
          </label>
          <select id="cm-rank" value={rank} onChange={(e) => setRank(e.target.value)} className={`${FIELD} cursor-pointer`}>
            {["사원", "주임", "선임", "책임", "팀장"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cm-phone" className="mb-1.5 block text-sm font-medium text-slate-700">
            연락처
          </label>
          <input id="cm-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" className={FIELD} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="cm-email" className="mb-1.5 block text-sm font-medium text-slate-700">
            이메일
          </label>
          <input id="cm-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@democompany.co.kr" className={FIELD} />
        </div>
      </form>
    </Modal>
  );
}

export function ModuleView({ mod, page }: { mod: ModuleDef; page: ModulePageData }) {
  const { state } = useModules();
  const modState = state[mod.slug];
  const Icon = ICON_MAP[mod.icon];

  // 탭 순서 — 편집 모드에서 드래그앤드롭으로 변경 가능
  const [tabOrder, setTabOrder] = useState<string[]>(() => page.tabs.map((t) => t.id));
  const orderedTabs = tabOrder
    .map((id) => page.tabs.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => !!t);

  const enabledTabs = orderedTabs.filter((t) => modState?.subs[t.id] !== false);
  const [activeId, setActiveId] = useState(enabledTabs[0]?.id);
  const active = enabledTabs.find((t) => t.id === activeId) ?? enabledTabs[0];

  const [editingTabs, setEditingTabs] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active: dragged, over } = e;
    if (!over || dragged.id === over.id) return;
    setTabOrder((prev) => arrayMove(prev, prev.indexOf(String(dragged.id)), prev.indexOf(String(over.id))));
  }

  // 필터/내보내기/신규 등록 — 실제 동작 (탭별 로컬 상태)
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [extraRows, setExtraRows] = useState<Record<string, Cell[][]>>({});
  /** 원본 행 갱신분 — 폐기 처리·BOM 매핑 등. 원본 데이터는 건드리지 않는다 */
  const [overrideRows, setOverrideRows] = useState<Record<string, Record<number, Cell[]>>>({});
  const [uploadOpen, setUploadOpen] = useState(false);
  /** 행 액션 대상 — 원본 행 인덱스 */
  const [actionRow, setActionRow] = useState<number | null>(null);
  const [members, setMembers] = useState<Record<string, Member[]>>(HR_MEMBERS);

  function switchTab(id: string, query?: string) {
    setActiveId(id);
    setFilterOpen(!!query);
    setFilterQuery(query ?? "");
  }

  const [record, setRecord] = useState<DetailRecord | null>(null);
  const [team, setTeam] = useState<string | null>(null);

  const rowDetails = active ? ROW_DETAILS[mod.slug]?.[active.id] : undefined;
  const isHrTab = active?.id === "hr" && !!active.tree;

  // 표시할 행: [신규 등록분, ...원본] 에 검색 필터 적용. 원본 행만 상세 팝업과 연결한다.
  const q = filterQuery.trim().toLowerCase();
  const visibleRows = active?.table
    ? [
        ...(extraRows[active.id] ?? []).map((cells) => ({ cells, origIdx: null as number | null })),
        ...active.table.rows.map((cells, i) => ({
          cells: overrideRows[active.id]?.[i] ?? cells,
          origIdx: i as number | null,
        })),
      ].filter((r) => !q || r.cells.some((c) => cellText(c).toLowerCase().includes(q)))
    : [];

  function runAction(action: TabAction) {
    if (!active) return;
    if (action === "filter") {
      setFilterOpen((v) => {
        if (v) setFilterQuery("");
        return !v;
      });
      return;
    }
    if (action === "export") {
      if (active.table) {
        downloadCsv(`${mod.name}_${active.label}.csv`, [active.table.columns, ...visibleRows.map((r) => r.cells)]);
      } else if (isHrTab) {
        const columns = ["팀", "이름", "직급", "연락처", "이메일", "입사일"];
        const rows: Cell[][] = Object.entries(members).flatMap(([t, list]) =>
          list.map((m) => [t, m.name, m.rank, m.phone, m.email, m.joined] as Cell[]),
        );
        downloadCsv(`${mod.name}_구성원.csv`, [columns, ...rows]);
      }
      return;
    }
    if (action === "upload") {
      setUploadOpen(true);
      return;
    }
    // create → 팝업
    setCreateOpen(true);
  }

  /** 행 액션 확정 — 상태 배지를 바꾸고, pick 이 있으면 고른 값도 채운다 */
  function applyRowAction(origIdx: number, picked?: string) {
    const cfg = active?.rowAction;
    if (!active || !cfg || !active.table) return;
    const base = overrideRows[active.id]?.[origIdx] ?? active.table.rows[origIdx];
    const next = [...base];
    next[cfg.statusCol] = { badge: cfg.resultBadge.text, tone: cfg.resultBadge.tone };
    if (cfg.pick && picked) next[cfg.pick.targetCol] = picked;
    setOverrideRows((prev) => ({ ...prev, [active.id]: { ...(prev[active.id] ?? {}), [origIdx]: next } }));
    setActionRow(null);
  }

  /** 행 클릭 — 상세 팝업이 있으면 팝업, 없고 drilldown 설정이 있으면 대상 탭으로 이동 */
  function onRow(i: number) {
    if (!active) return;
    const orig = visibleRows[i]?.origIdx;
    if (rowDetails) {
      if (orig != null) setRecord(rowDetails[orig] ?? null);
      return;
    }
    if (active.drilldown) {
      const cell = visibleRows[i]?.cells[active.drilldown.colIndex];
      switchTab(active.drilldown.toTabId, cell != null ? cellText(cell) : undefined);
      return;
    }
    // 처리 대상 상태인 행만 액션 팝업을 연다
    const cfg = active.rowAction;
    const r = visibleRows[i];
    if (cfg && r?.origIdx != null) {
      const c = r.cells[cfg.statusCol];
      if (typeof c === "object" && c.badge === cfg.activeWhen) setActionRow(r.origIdx);
    }
  }

  if (!modState?.enabled) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-6 lg:px-8">
        <EmptyState
          icon={<Icon size={32} />}
          title={`${mod.name} 기능이 비활성화되어 있습니다`}
          desc={`외부 ${mod.externalSystem} 시스템과 결합 사용 중이거나 설정에서 OFF된 상태입니다. 데이터는 보존되며 재활성화 시 즉시 복원됩니다.`}
          action={
            <Link href="/settings/workspace">
              <Button variant="secondary">기능 활성화 설정으로 이동</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 lg:px-8">
      {/* 헤더 — 실용성 위주: 아이콘 없이 타이틀만 */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900">
          {mod.name}
          {mod.subfunctions.some((s) => s.ai) && <AiBadge />}
        </h1>
      </div>

      {/* KPI */}
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {page.stats.map((s) => (
          <Stat key={s.label} stat={s} onCta={(tabId) => switchTab(tabId)} />
        ))}
      </div>

      {/* 서브기능 탭 + 액션 버튼(동일 뎁스) — 우측 끝 편집 버튼으로 순서 변경 */}
      <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-slate-200" role="tablist">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tabOrder} strategy={horizontalListSortingStrategy}>
            {orderedTabs.map((tab, i) => {
              if (modState.subs[tab.id] === false) return null;
              return (
                <SortableTab
                  key={tab.id}
                  tab={tab}
                  index={i}
                  editing={editingTabs}
                  isActive={active?.id === tab.id}
                  onSelect={() => switchTab(tab.id)}
                />
              );
            })}
          </SortableContext>
        </DndContext>

        <div className="mb-1.5 ml-auto flex items-center gap-2">
          {filterOpen && active?.table && (
            <div className="relative">
              <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="검색어로 필터"
                aria-label="테이블 필터"
                className="w-44 rounded-lg border border-slate-300 py-1.5 pl-8 pr-2.5 text-xs text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-400 focus:outline-2 focus:outline-slate-300/60"
              />
            </div>
          )}
          {active?.actions?.map((a) => {
            const def = TAB_ACTIONS[a];
            const ActionIcon = def.icon;
            const isFilterActive = a === "filter" && filterOpen;
            return (
              <Button
                key={a}
                variant={def.primary ? "primary" : "secondary"}
                size="sm"
                onClick={() => runAction(a)}
                aria-pressed={a === "filter" ? filterOpen : undefined}
                className={isFilterActive ? "!bg-slate-100" : ""}
              >
                <ActionIcon size={14} />
                {a === "create" && active?.createLabel ? active.createLabel : def.label}
              </Button>
            );
          })}
          {(active?.actions?.length ?? 0) > 0 && <span className="h-4 w-px bg-slate-200" aria-hidden />}
          <button
            type="button"
            onClick={() => setEditingTabs((v) => !v)}
            aria-pressed={editingTabs}
            aria-label={editingTabs ? "탭 순서 편집 완료" : "탭 순서 편집"}
            title={editingTabs ? "완료" : "탭을 드래그해 순서를 바꿀 수 있어요"}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              editingTabs
                ? "bg-slate-800 text-white hover:bg-slate-700"
                : "border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            {editingTabs ? <IconCheck size={13} /> : <IconPencil size={13} />}
            {editingTabs ? "확인" : "편집"}
          </button>
        </div>
      </div>

      {active?.custom === "report-automation" ? (
        <div role="tabpanel">
          <ReportAutomation />
        </div>
      ) : active?.custom === "purchase-order" ? (
        <div role="tabpanel">
          <PurchaseOrder onOpenTab={switchTab} />
        </div>
      ) : active?.custom === "drawing-manager" ? (
        <div role="tabpanel">
          <DrawingManager />
        </div>
      ) : active?.custom === "receiving-inspection" ? (
        <div role="tabpanel">
          <ReceivingInspection query={filterQuery} />
        </div>
      ) : active ? (
        <div role="tabpanel" className="space-y-4">
          {active.chart && (
            <Card>
              <SectionHeader title={active.chart.title} />
              <ChartFromSpec spec={active.chart} />
            </Card>
          )}

          {active.tree && (
            <Card>
              <ul className="space-y-0.5">
                {active.tree.map((n) => (
                  <TreeItem key={n.name} node={n} selectable={(name) => name in members} onSelect={setTeam} />
                ))}
              </ul>
            </Card>
          )}

          {active.table && (
            <Card>
              <DataTable
                data={{ columns: active.table.columns, rows: visibleRows.map((r) => r.cells) }}
                onRowClick={rowDetails || active.drilldown || active.rowAction ? onRow : undefined}
              />
              {active.rowAction && (
                <p className="mt-3 text-xs text-slate-400">
                  {active.rowAction.activeWhen}{" "}
                  {
                    visibleRows.filter((r) => {
                      const c = r.cells[active.rowAction!.statusCol];
                      return typeof c === "object" && c.badge === active.rowAction!.activeWhen;
                    }).length
                  }
                  건 남음
                </p>
              )}
              {q && (
                <p className="mt-3 text-xs text-slate-400">
                  &lsquo;{filterQuery}&rsquo; 필터 적용 중 · {visibleRows.length}건
                </p>
              )}
            </Card>
          )}

        </div>
      ) : (
        <EmptyState title="활성화된 세부 기능이 없습니다" desc="설정 > 기능 활성화 설정에서 세부 기능을 켜 주세요." />
      )}

      {active?.table && (
        <UploadReviewModal
          key={`${active.id}-upload-${uploadOpen}`}
          open={uploadOpen}
          title={active.label}
          columns={active.table.columns}
          onApprove={(rows) => setExtraRows((prev) => ({ ...prev, [active.id]: [...rows, ...(prev[active.id] ?? [])] }))}
          onClose={() => setUploadOpen(false)}
        />
      )}

      {active?.rowAction?.pick && (
        <Modal
          open={actionRow !== null}
          onClose={() => setActionRow(null)}
          size="md"
          title={active.rowAction.pick.title}
        >
          <ul className="max-h-96 space-y-2 overflow-y-auto p-5">
            {active.rowAction.pick.options.map((opt) => (
              <li key={opt}>
                <button
                  type="button"
                  onClick={() => applyRowAction(actionRow!, opt)}
                  className="w-full cursor-pointer rounded-lg border border-slate-200 px-3.5 py-3 text-left text-sm text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  {opt}
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {active?.rowAction?.confirm && !active.rowAction.pick && (
        <Modal
          open={actionRow !== null}
          onClose={() => setActionRow(null)}
          size="sm"
          title={active.rowAction.confirm.title}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setActionRow(null)}>
                취소
              </Button>
              <Button variant="danger" onClick={() => applyRowAction(actionRow!)}>
                {active.rowAction.confirm.cta}
              </Button>
            </div>
          }
        >
          <div className="flex items-start gap-3 p-5">
            <IconAlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-500" />
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">
                {actionRow !== null && active.table ? cellText(active.table.rows[actionRow][0]) : ""}
              </span>
              {" "}
              {active.rowAction.confirm.message}
            </p>
          </div>
        </Modal>
      )}

      <RecordModal record={record} onClose={() => setRecord(null)} />
      <MembersModal team={team} members={team ? (members[team] ?? []) : []} onClose={() => setTeam(null)} />

      {/* 신규 등록 — 인사 관리는 구성원 등록, 그 외 테이블 탭은 컬럼 기반 폼 */}
      {isHrTab ? (
        <CreateMemberModal
          key={`hr-${createOpen}`}
          open={createOpen}
          teams={Object.keys(members)}
          onSave={(t, m) => setMembers((prev) => ({ ...prev, [t]: [...(prev[t] ?? []), m] }))}
          onClose={() => setCreateOpen(false)}
        />
      ) : (
        active?.table && (
          <CreateRecordModal
            key={`${active.id}-${createOpen}`}
            open={createOpen}
            title={active.label}
            columns={active.table.columns}
            onSave={(row) => setExtraRows((prev) => ({ ...prev, [active.id]: [row, ...(prev[active.id] ?? [])] }))}
            onClose={() => setCreateOpen(false)}
          />
        )
      )}
    </div>
  );
}
