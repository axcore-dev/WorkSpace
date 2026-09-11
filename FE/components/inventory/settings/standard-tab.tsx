"use client";

import { ActionRow, SettingsRow, SettingsRows, SettingsSection } from "@/components/settings/settings-section";
import type { SafetyStandard } from "@/data/inventory";
import { useInventory } from "../inventory-provider";

export const METHOD_LABEL: Record<SafetyStandard["method"], string> = {
  leadTimeAvg: "리드타임 × 일평균 소요량",
  manual: "담당자 지정",
};

/** 안전 재고 기준 — 카드 없는 설정 형식. 값만 읽는다. 인라인 편집은 Phase 4 */
export function StandardTab() {
  const { state } = useInventory();
  const s = state.standard;
  return (
    <SettingsSection title="안전 재고 기준" className="max-w-3xl">
      <SettingsRows>
        <SettingsRow>
          <ActionRow name="산정 방식">
            <span className="text-sm text-slate-600">{METHOD_LABEL[s.method]}</span>
          </ActionRow>
        </SettingsRow>
        <SettingsRow>
          <ActionRow name="일평균 산정 기간">
            <span className={`text-sm ${s.method === "manual" ? "text-slate-500" : "text-slate-600"}`}>최근 {s.avgWindowDays}일</span>
          </ActionRow>
        </SettingsRow>
      </SettingsRows>
    </SettingsSection>
  );
}
