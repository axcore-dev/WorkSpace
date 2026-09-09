"use client";

import { ModuleView } from "@/components/module-view";
import { ManagementProvider, useManagement } from "@/components/management/management-provider";
import type { ModuleDef, ModulePageData } from "@/data/types";

/** 경영지원 = 공유 상태 + ModuleView(부제는 대기 건수에서 파생) */
export function ManagementModule({ mod, page }: { mod: ModuleDef; page: ModulePageData }) {
  return (
    <ManagementProvider>
      <ModuleView mod={mod} page={page} subtitle={<PendingSubtitle />} />
    </ManagementProvider>
  );
}

function PendingSubtitle() {
  const { pending } = useManagement();
  const total = pending.payroll + pending.accounting;
  return (
    <p className="text-sm text-slate-500">
      {total === 0 ? "처리를 기다리는 일이 없어요" : `처리를 기다리는 일 ${total}건 — 급여 ${pending.payroll} · 회계 ${pending.accounting}`}
    </p>
  );
}
