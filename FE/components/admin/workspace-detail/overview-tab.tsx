"use client";

import { Card, SectionHeader } from "@/components/ui";
import type { AdminWorkspace } from "@/data/admin";
import { BizInfoCard } from "./biz-info-card";
import { ContactsCard } from "./contacts-card";
import { MemoCard } from "./memo-card";
import { SitesCard } from "./sites-card";
import type { Save } from "./shared";

export function OverviewTab({ ws, onSave }: { ws: AdminWorkspace; onSave: Save }) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <BizInfoCard ws={ws} onSave={onSave} />
        <SitesCard ws={ws} onSave={onSave} />
        <MemoCard ws={ws} onSave={onSave} />
      </div>

      <div className="space-y-4">
        <ContactsCard ws={ws} onSave={onSave} />

        <Card>
          <SectionHeader title="현황" />
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "멤버", value: `${ws.members.length}명` },
              { label: "연결된 시스템", value: `${ws.systems.length}개` },
              { label: "이번 달 사용량", value: `${ws.usage.storageGb} GB` },
              { label: "최근 활동", value: ws.lastActive },
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
