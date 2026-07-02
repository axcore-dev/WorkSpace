"use client";

import { Modal } from "@/components/modal";
import { Badge, DataTable } from "@/components/ui";
import type { DetailRecord, Member, Tone } from "@/data/types";

const TONE_TEXT: Record<Tone, string> = {
  green: "text-emerald-600",
  amber: "text-amber-600",
  red: "text-red-600",
  violet: "text-slate-600",
  blue: "text-slate-600",
  slate: "text-slate-700",
};

/** 테이블 행 상세 팝업 */
export function RecordModal({ record, onClose }: { record: DetailRecord | null; onClose: () => void }) {
  return (
    <Modal
      open={!!record}
      onClose={onClose}
      size="md"
      title={record?.title}
      desc={record?.subtitle}
      headerAccessory={record?.status ? <Badge tone={record.status.tone}>{record.status.label}</Badge> : undefined}
    >
      {record && (
        <div className="space-y-5 p-5">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {record.fields.map((f) => (
              <div key={f.label} className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-2">
                <dt className="text-sm text-slate-500">{f.label}</dt>
                <dd className={`text-sm font-medium ${f.tone ? TONE_TEXT[f.tone] : "text-slate-900"}`}>{f.value}</dd>
              </div>
            ))}
          </dl>
          {record.table && (
            <div>
              {record.tableTitle && (
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{record.tableTitle}</p>
              )}
              <DataTable data={record.table} dense />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/** 조직도 팀 구성원 팝업 */
export function MembersModal({
  team,
  members,
  onClose,
}: {
  team: string | null;
  members: Member[];
  onClose: () => void;
}) {
  return (
    <Modal open={!!team} onClose={onClose} size="lg" title={team ?? ""} desc={`구성원 ${members.length}명`}>
      <div className="p-5">
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-400">
                <th className="py-2.5 pr-3">이름</th>
                <th className="px-3 py-2.5">직급</th>
                <th className="px-3 py-2.5">연락처</th>
                <th className="px-3 py-2.5">이메일</th>
                <th className="px-3 py-2.5">입사일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => (
                <tr key={m.email} className="transition-colors hover:bg-slate-50/70">
                  <td className="py-3 pr-3">
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                        {m.name.slice(0, 1)}
                      </span>
                      <span className="font-medium text-slate-900">{m.name}</span>
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{m.rank}</td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-500">{m.phone}</td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-500">{m.email}</td>
                  <td className="px-3 py-3 text-slate-500">{m.joined}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
