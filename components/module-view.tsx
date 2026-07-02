"use client";

import { useState } from "react";
import Link from "next/link";
import { ChartFromSpec } from "@/components/charts";
import {
  ICON_MAP,
  IconChevronDown,
  IconChevronRight,
  IconDownload,
  IconFilter,
  IconInfo,
  IconPlus,
} from "@/components/icons";
import { useModules } from "@/components/module-provider";
import { MembersModal, RecordModal } from "@/components/record-modal";
import { AiBadge, Badge, Button, Card, DataTable, EmptyState, SectionHeader, Stat } from "@/components/ui";
import { HR_MEMBERS, ROW_DETAILS } from "@/data/module-details";
import type { DetailRecord, ModuleDef, ModulePageData, TreeNode } from "@/data/types";

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

export function ModuleView({ mod, page }: { mod: ModuleDef; page: ModulePageData }) {
  const { state } = useModules();
  const modState = state[mod.slug];
  const Icon = ICON_MAP[mod.icon];

  const enabledTabs = page.tabs.filter((t) => modState?.subs[t.id] !== false);
  const [activeId, setActiveId] = useState(enabledTabs[0]?.id);
  const active = enabledTabs.find((t) => t.id === activeId) ?? enabledTabs[0];

  const [record, setRecord] = useState<DetailRecord | null>(null);
  const [team, setTeam] = useState<string | null>(null);

  const rowDetails = active ? ROW_DETAILS[mod.slug]?.[active.id] : undefined;

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
      {/* 헤더 */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <Icon size={26} className="text-slate-700" />
          <div className="flex items-center gap-2">
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900">
              {mod.name}
              {mod.subfunctions.some((s) => s.ai) && <AiBadge />}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">{mod.action}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm">
            <IconFilter size={14} />
            필터
          </Button>
          <Button variant="secondary" size="sm">
            <IconDownload size={14} />
            내보내기
          </Button>
          <Button size="sm">
            <IconPlus size={14} />
            신규 등록
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {page.stats.map((s) => (
          <Stat key={s.label} stat={s} />
        ))}
      </div>

      {/* 서브기능 탭 */}
      <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-slate-200" role="tablist">
        {page.tabs.map((tab) => {
          const enabled = modState.subs[tab.id] !== false;
          const isActive = active?.id === tab.id;
          if (!enabled) {
            return (
              <span key={tab.id} className="px-4 py-2.5 text-sm text-slate-300" title="세부 기능이 OFF 상태입니다">
                {tab.label} <span className="text-[10px]">(OFF)</span>
              </span>
            );
          }
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveId(tab.id)}
              className={`-mb-px inline-flex cursor-pointer items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              {tab.label}
              {tab.ai && <AiBadge />}
            </button>
          );
        })}
      </div>

      {active ? (
        <div role="tabpanel" className="space-y-4">
          <p className="text-sm text-slate-500">{active.description}</p>

          {active.chart && (
            <Card>
              <SectionHeader title={active.chart.title} />
              <ChartFromSpec spec={active.chart} />
            </Card>
          )}

          {active.tree && (
            <Card>
              <p className="mb-2 text-xs text-slate-400">팀을 클릭하면 구성원 상세를 볼 수 있어요.</p>
              <ul className="space-y-0.5">
                {active.tree.map((n) => (
                  <TreeItem key={n.name} node={n} selectable={(name) => name in HR_MEMBERS} onSelect={setTeam} />
                ))}
              </ul>
            </Card>
          )}

          {active.table && (
            <Card>
              {rowDetails && (
                <p className="mb-2 text-xs text-slate-400">행을 클릭하면 상세 정보를 볼 수 있어요.</p>
              )}
              <DataTable
                data={active.table}
                onRowClick={rowDetails ? (i) => setRecord(rowDetails[i] ?? null) : undefined}
              />
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
      <MembersModal team={team} members={team ? (HR_MEMBERS[team] ?? []) : []} onClose={() => setTeam(null)} />
    </div>
  );
}
