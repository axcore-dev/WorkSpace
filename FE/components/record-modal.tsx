"use client";

import { Modal } from "@/components/modal";
import { Badge, DataTable, TONE_TEXT } from "@/components/ui";
import type { DetailRecord } from "@/data/types";

/** 테이블 행 상세 팝업 — 상태는 급여 관리 팝업과 동일하게 본문 하단 중앙에 표시 */
export function RecordModal({ record, onClose }: { record: DetailRecord | null; onClose: () => void }) {
  return (
    <Modal
      open={!!record}
      onClose={onClose}
      // 검수 상세처럼 열이 많은 표는 넓게 — 기본은 lg 유지
      size={(record?.table?.columns.length ?? 0) > 6 ? "xl" : "lg"}
      title={record?.title}
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
          {record.status && (
            <p className="flex items-center justify-center gap-1.5 border-t border-slate-100 pt-4 text-center text-sm">
              <span className="text-slate-400">{record.statusLabel ?? "상태"}</span>
              <Badge tone={record.status.tone} className="!text-sm">
                {record.status.label}
              </Badge>
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
