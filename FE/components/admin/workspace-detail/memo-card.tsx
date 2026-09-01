"use client";

import { useState } from "react";
import { EditHeader, EditModal, type Save } from "./shared";
import { Card, FIELD } from "@/components/ui";
import type { AdminWorkspace } from "@/data/admin";

/* ── 운영자 메모 ── */

export function MemoCard({ ws, onSave }: { ws: AdminWorkspace; onSave: Save }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(ws.memo);

  return (
    <Card>
      <EditHeader
        title="운영자 메모"
        onEdit={() => {
          setD(ws.memo);
          setOpen(true);
        }}
      />

      {ws.memo ? (
        <p className="whitespace-pre-wrap text-sm text-slate-700">{ws.memo}</p>
      ) : (
        <p className="text-sm text-slate-400">메모가 없어요.</p>
      )}

      <EditModal
        open={open}
        onClose={() => setOpen(false)}
        title="운영자 메모 수정"
        onSave={() => {
          onSave({ memo: d });
          setOpen(false);
        }}
      >
        <textarea
          value={d}
          onChange={(e) => setD(e.target.value)}
          rows={6}
          aria-label="운영자 메모"
          placeholder="계약 특이사항, 후속 처리 등"
          className={FIELD}
        />
      </EditModal>
    </Card>
  );
}
