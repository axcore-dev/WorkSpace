"use client";

import { useState } from "react";
import { IconClipboardCheck, IconSettings } from "@/components/icons";
import { Tab } from "@/components/module-view";
import { Button, EmptyState, Segmented } from "@/components/ui";
import type { InventorySub } from "@/data/inventory";
import type { ModuleDef } from "@/data/types";
import { InventoryProvider, useInventory } from "./inventory-provider";
import { MovementsTab } from "./movements-tab";
import { OrdersTab } from "./orders-tab";
import { ItemsTab } from "./settings/items-tab";
import { RulesTab } from "./settings/rules-tab";
import { StandardTab } from "./settings/standard-tab";
import { VendorsTab } from "./settings/vendors-tab";
import { StockTab } from "./stock-tab";

/**
 * 재고·물류 = 헤더 토글 [처리 | 설정] 이 탭 세트를 통째로 갈아끼우는 한 페이지.
 * 처리(매일 쓰는 것) 와 설정(처리하기 위해 미리 정하는 것) 을 한 층에 섞지 않는다. 숨은 모드가 되지 않게 제목도 바뀐다.
 *
 * 탭은 서브기능 권한(`can`)으로 걸러진다 — 발주·입고 탭은 `purchasing` 또는 `receiving` 중 하나만 있어도 보인다
 * (없는 구역은 그 탭 안에서 읽기 전용). 처리 탭이 하나도 없고 설정만 있으면 설정으로 열린다.
 */
type View = "process" | "settings";

interface TabDef {
  id: string;
  label: string;
  /** 이 중 하나라도 쓸 수 있으면 탭이 보인다 */
  subs: InventorySub[];
  render: () => React.ReactNode;
}

const PROCESS_TABS: TabDef[] = [
  { id: "orders", label: "발주·입고", subs: ["purchasing", "receiving"], render: () => <OrdersTab /> },
  { id: "movements", label: "입출고 이력", subs: ["movements"], render: () => <MovementsTab /> },
  { id: "stock", label: "현재 재고", subs: ["stock"], render: () => <StockTab /> },
];

const SETTINGS_TABS: TabDef[] = [
  { id: "items", label: "품목 마스터", subs: ["items"], render: () => <ItemsTab /> },
  { id: "vendors", label: "거래처", subs: ["vendors"], render: () => <VendorsTab /> },
  { id: "safety", label: "안전 재고 기준", subs: ["safety"], render: () => <StandardTab /> },
  { id: "docrules", label: "문서 규칙", subs: ["docrules"], render: () => <RulesTab /> },
];

const VIEW_OPTIONS: { value: View; label: React.ReactNode }[] = [
  {
    value: "process",
    label: (
      <span className="inline-flex items-center gap-1.5">
        <IconClipboardCheck size={13} />
        처리
      </span>
    ),
  },
  {
    value: "settings",
    label: (
      <span className="inline-flex items-center gap-1.5">
        <IconSettings size={13} />
        설정
      </span>
    ),
  },
];

export function InventoryModule({ mod }: { mod: ModuleDef }) {
  return (
    <InventoryProvider>
      <InventoryScreen mod={mod} />
    </InventoryProvider>
  );
}

function InventoryScreen({ mod }: { mod: ModuleDef }) {
  const { can, status, reload } = useInventory();
  const processTabs = PROCESS_TABS.filter((t) => t.subs.some(can));
  const settingsTabs = SETTINGS_TABS.filter((t) => t.subs.some(can));

  const [view, setView] = useState<View>("process");
  // 처리 탭이 전부 꺼져 있으면 설정으로 — 권한 · 기능 상태가 나중에 도착해도 따라간다
  const effectiveView: View = view === "process" && processTabs.length === 0 && settingsTabs.length > 0 ? "settings" : view;
  const tabs = effectiveView === "process" ? processTabs : settingsTabs;

  const [activeId, setActiveId] = useState<string | null>(null);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  function switchView(v: View) {
    setView(v);
    setActiveId(null);
  }

  return (
    <div className="px-6 py-6 lg:px-8">
      {/* 헤더 — 부제 없음. 토글은 설정 권한이 하나라도 있을 때만 */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{effectiveView === "settings" ? `${mod.name} 설정` : mod.name}</h1>
        {settingsTabs.length > 0 && (
          <Segmented options={VIEW_OPTIONS} value={effectiveView} onChange={switchView} label="화면 전환" disabled={processTabs.length === 0} />
        )}
      </div>

      {/* 탭 줄 — 오른쪽은 비운다. 도구는 카드 헤더 안에 */}
      <div className="thin-scroll mb-4 flex items-center gap-1 overflow-x-auto border-b border-slate-200 pb-px" role="tablist">
        {tabs.map((t) => (
          <Tab key={t.id} tab={{ id: t.id, label: t.label }} isActive={active?.id === t.id} onSelect={() => setActiveId(t.id)} />
        ))}
      </div>

      <div role="tabpanel">
        {status === "loading" ? (
          <p className="text-sm text-slate-500">불러오는 중이에요</p>
        ) : status === "error" ? (
          <EmptyState
            title="불러오지 못했어요"
            action={
              <Button variant="secondary" size="sm" onClick={reload}>
                다시 시도
              </Button>
            }
          />
        ) : active ? (
          active.render()
        ) : (
          <EmptyState title="쓸 수 있는 탭이 없어요" />
        )}
      </div>
    </div>
  );
}
