"use client";

import { useState } from "react";
import { IconDownload, IconFilter } from "@/components/icons";
import { Tab } from "@/components/module-view";
import { Button, EmptyState, FIELD_SM } from "@/components/ui";
import type { ModuleDef } from "@/data/types";
import { BOM_EXPORT_COLUMNS, bomExportRows, bomTree } from "@/lib/design-state";
import { downloadCsv } from "@/lib/download";
import { BomTab } from "./bom-tab";
import { DesignProvider, useDesign, type DesignSub } from "./design-provider";
import { DrawingManager } from "./drawing-manager";

/**
 * 제품설계 = 도면 관리 · BOM 관리 두 탭. 재고·물류처럼 자기 상태(`DesignProvider`)로 그린다 — 공용 `ModuleView` 의
 * 더미 표가 아니라 `/api/workspace/design/*` 에서 읽는다.
 *
 * 흐름: 도면 등록(정제 엑셀에서 부품 추출) → 도면 관리(리비전 · 파생) → BOM 관리(부품 ↔ 품목 마스터 매핑) →
 * 재고·물류의 발주서가 이 도면의 BOM 으로 소요를 뽑는다. 설계 관리(ECO) 탭은 2026-09-14 에 뺐다.
 * BOM 관리의 필터 · 내보내기는 탭 줄 오른쪽에 둔다(옛 공용 화면과 같은 자리).
 */
const TABS: { id: DesignSub; label: string }[] = [
  { id: "drawings", label: "도면 관리" },
  { id: "bom", label: "BOM 관리" },
];

export function DesignModule({ mod }: { mod: ModuleDef }) {
  return (
    <DesignProvider>
      <DesignScreen mod={mod} />
    </DesignProvider>
  );
}

function DesignScreen({ mod }: { mod: ModuleDef }) {
  const { state, can, status, mode, reload, notify } = useDesign();
  const tabs = TABS.filter((t) => can(t.id));
  const [activeId, setActiveId] = useState<DesignSub | null>(null);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const [filterOpen, setFilterOpen] = useState(false);
  const [query, setQuery] = useState("");

  function exportBom() {
    const rows = bomExportRows(bomTree(state.drawings, query));
    downloadCsv("제품설계_BOM.csv", [BOM_EXPORT_COLUMNS, ...rows]);
    notify(`BOM ${rows.length}줄을 내보냈어요`);
  }

  return (
    <div className="px-6 py-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{mod.name}</h1>
        {mode === "demo" && (
          <span className="rounded px-1.5 py-0.5 text-xs text-amber-700 ring-1 ring-inset ring-amber-200">데모 데이터 · 서버에 저장되지 않아요</span>
        )}
      </div>

      <div className="mb-4 flex items-center gap-1 border-b border-slate-200">
        <div className="thin-scroll flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pb-px" role="tablist">
          {tabs.map((t) => (
            <Tab key={t.id} tab={{ id: t.id, label: t.label }} isActive={active?.id === t.id} onSelect={() => setActiveId(t.id)} />
          ))}
        </div>
        {active?.id === "bom" && status === "ready" && (
          <div className="flex shrink-0 items-center gap-1.5 pb-1.5">
            {filterOpen && (
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setQuery("");
                    setFilterOpen(false);
                  }
                }}
                placeholder="도면번호 · 품명 · 호칭 · 규격 · 품목 코드"
                aria-label="BOM 필터"
                autoFocus
                className={`${FIELD_SM} w-64`}
              />
            )}
            <Button
              size="sm"
              variant="secondary"
              aria-pressed={filterOpen}
              onClick={() => {
                if (filterOpen) setQuery("");
                setFilterOpen(!filterOpen);
              }}
            >
              <IconFilter size={14} />
              필터
            </Button>
            <Button size="sm" variant="secondary" onClick={exportBom}>
              <IconDownload size={14} />
              내보내기
            </Button>
          </div>
        )}
      </div>

      <div role="tabpanel" key={active?.id ?? ""} className="fade-in">
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
        ) : active?.id === "bom" ? (
          <BomTab query={query} />
        ) : active ? (
          <DrawingManager />
        ) : (
          <EmptyState title="쓸 수 있는 탭이 없어요" />
        )}
      </div>
    </div>
  );
}
