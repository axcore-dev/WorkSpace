"use client";

import { useState } from "react";
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
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconDownload,
  IconFilter,
  IconInfo,
  IconPencil,
  IconPlus,
  IconSearch,
} from "@/components/icons";
import { Modal } from "@/components/modal";
import { useModules } from "@/components/module-provider";
import { MembersModal, RecordModal } from "@/components/record-modal";
import { ReportAutomation } from "@/components/report-automation";
import { AiBadge, Badge, Button, Card, DataTable, EmptyState, FIELD, SectionHeader, Stat } from "@/components/ui";
import { HR_MEMBERS, ROW_DETAILS } from "@/data/module-details";
import { downloadCsv } from "@/lib/download";
import type { Cell, DetailRecord, Member, ModuleDef, ModulePageData, TabAction, TreeNode } from "@/data/types";

/** 탭별 액션 버튼 정의 — data의 tab.actions로 필요한 곳에만 노출 */
const TAB_ACTIONS: Record<TabAction, { label: string; icon: typeof IconFilter; primary?: boolean }> = {
  filter: { label: "필터", icon: IconFilter },
  export: { label: "내보내기", icon: IconDownload },
  create: { label: "신규 등록", icon: IconPlus, primary: true },
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
      desc="입력한 내용은 목록 맨 위에 추가됩니다. (데모 — 새로고침 시 초기화)"
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
      desc="등록 즉시 해당 팀의 구성원 목록에 추가됩니다. (데모 — 새로고침 시 초기화)"
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
  const [members, setMembers] = useState<Record<string, Member[]>>(HR_MEMBERS);

  function switchTab(id: string) {
    setActiveId(id);
    setFilterOpen(false);
    setFilterQuery("");
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
        ...active.table.rows.map((cells, i) => ({ cells, origIdx: i as number | null })),
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
    // create → 팝업
    setCreateOpen(true);
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
        <p className="mt-0.5 text-sm text-slate-500">{mod.action}</p>
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
              const enabled = modState.subs[tab.id] !== false;
              if (!enabled) {
                return (
                  <span key={tab.id} className="px-4 py-2.5 text-sm text-slate-300" title="세부 기능이 OFF 상태입니다">
                    {tab.label} <span className="text-[10px]">(OFF)</span>
                  </span>
                );
              }
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
                {def.label}
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
                onRowClick={
                  rowDetails
                    ? (i) => {
                        const orig = visibleRows[i]?.origIdx;
                        if (orig != null) setRecord(rowDetails[orig] ?? null);
                      }
                    : undefined
                }
              />
              {q && (
                <p className="mt-3 text-xs text-slate-400">
                  &lsquo;{filterQuery}&rsquo; 필터 적용 중 · {visibleRows.length}건
                </p>
              )}
            </Card>
          )}

          {active.note && (
            <p className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              <IconInfo size={16} className="mt-0.5 shrink-0 text-slate-400" />
              {active.note}
            </p>
          )}
        </div>
      ) : (
        <EmptyState title="활성화된 세부 기능이 없습니다" desc="설정 > 기능 활성화 설정에서 세부 기능을 켜 주세요." />
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
