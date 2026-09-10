"use client";

import { ModuleView } from "@/components/module-view";
import { ManagementProvider } from "@/components/management/management-provider";
import type { ModuleDef, ModulePageData } from "@/data/types";

/** 경영지원 = 공유 상태 + ModuleView */
export function ManagementModule({ mod, page }: { mod: ModuleDef; page: ModulePageData }) {
  return (
    <ManagementProvider>
      <ModuleView mod={mod} page={page} />
    </ManagementProvider>
  );
}
