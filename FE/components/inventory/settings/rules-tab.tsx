"use client";

import { ActionRow, SettingsRow, SettingsRows, SettingsSection } from "@/components/settings/settings-section";
import type { CodeSegment } from "@/data/inventory";
import { previewCode } from "@/lib/inventory-state";
import { useInventory } from "../inventory-provider";

export const SEGMENT_LABEL: Record<CodeSegment, string> = {
  year: "연도",
  vendorInitial: "거래처 이니셜",
  model: "차종·모델",
  team: "팀·공정",
  seq: "순번",
};

/** 무채색 칩 — 문서 규칙의 조각 · 태그. 색 알약은 쓰지 않는다 */
function Chips({ items }: { items: string[] }) {
  return (
    <span className="flex flex-wrap justify-end gap-1.5">
      {items.map((t) => (
        <span key={t} className="rounded px-2 py-0.5 text-xs text-slate-600 ring-1 ring-inset ring-slate-200">
          {t}
        </span>
      ))}
    </span>
  );
}

/** 문서 규칙 — 관리번호 · 발주서 서식 · 가공 요청 태그. 값만 읽는다. 편집은 Phase 4 */
export function RulesTab() {
  const { state } = useInventory();
  const r = state.docRules;
  return (
    <div className="max-w-3xl">
      <SettingsSection title="관리번호">
        <SettingsRows>
          <SettingsRow>
            <ActionRow name="조각 순서">
              <Chips items={r.codeSegments.map((s) => SEGMENT_LABEL[s])} />
            </ActionRow>
          </SettingsRow>
          <SettingsRow>
            <ActionRow name="구분자">
              <span className="text-sm text-slate-600">
                팀 앞 <code className="rounded bg-slate-100 px-1">{r.separators.beforeTeam}</code> · 공정 앞 <code className="rounded bg-slate-100 px-1">{r.separators.beforeOp === " " ? "공백" : r.separators.beforeOp}</code>
              </span>
            </ActionRow>
          </SettingsRow>
          <SettingsRow>
            <ActionRow name="미리보기">
              <span className="font-mono text-sm text-slate-900">{previewCode(r)}</span>
            </ActionRow>
          </SettingsRow>
        </SettingsRows>
      </SettingsSection>

      <SettingsSection title="발주서 서식">
        <SettingsRows>
          <SettingsRow>
            <ActionRow name="자재 발주서">
              <Chips items={r.formats.material} />
            </ActionRow>
          </SettingsRow>
          <SettingsRow>
            <ActionRow name="부품 발주서">
              <Chips items={r.formats.parts} />
            </ActionRow>
          </SettingsRow>
        </SettingsRows>
      </SettingsSection>

      <SettingsSection title="가공 요청 태그" aside={<span className="text-xs text-slate-500">{r.processTags.length}개</span>}>
        <SettingsRows>
          <SettingsRow>
            <Chips items={r.processTags} />
          </SettingsRow>
        </SettingsRows>
      </SettingsSection>
    </div>
  );
}
