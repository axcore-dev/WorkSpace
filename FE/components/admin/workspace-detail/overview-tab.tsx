"use client";

import { Card, SectionHeader } from "@/components/ui";
import type { AdminWorkspace } from "@/data/admin";
import type { ContactChangeDto } from "@/lib/admin-api";
import { BizInfoCard } from "./biz-info-card";
import { ContactsCard } from "./contacts-card";
import { MemoCard } from "./memo-card";
import type { Save } from "./shared";

export function OverviewTab({
  ws,
  onSave,
  contactChange,
}: {
  ws: AdminWorkspace;
  onSave: Save;
  /** 마지막 저장에서 담당자가 바뀌어 서버가 한 일. 담당자 카드가 결과(발급 링크 등)를 보여 준다 */
  contactChange?: ContactChangeDto | null;
}) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <BizInfoCard ws={ws} onSave={onSave} />
        <ContactsCard ws={ws} onSave={onSave} contactChange={contactChange} />
      </div>

      <div className="space-y-4">
        <MemoCard ws={ws} onSave={onSave} />

        <Card>
          <SectionHeader title="현황" />
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "멤버", value: `${ws.members.length}명` },
              { label: "연결된 시스템", value: `${ws.systems.length}개` },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-slate-200 px-3.5 py-3">
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="mt-0.5 text-lg font-bold text-slate-900">{s.value}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
