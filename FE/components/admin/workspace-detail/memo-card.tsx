"use client";

import { useState } from "react";
import { EditActions } from "@/components/admin/form-parts";
import { EditHeader, type Save } from "./shared";
import { Card, FIELD } from "@/components/ui";
import type { AdminWorkspace } from "@/data/admin";

/* ── 내부 메모 ── */

export function MemoCard({ ws, onSave }: { ws: AdminWorkspace; onSave: Save }) {
  const [editing, setEditing] = useState(false);
  const [d, setD] = useState(ws.memo);

  function open() {
    setD(ws.memo);
    setEditing(true);
  }

  return (
    <Card>
      <EditHeader title="내부 메모" editing={editing} onEdit={open} />

      {!editing ? (
        ws.memo ? (
          <p className="whitespace-pre-wrap text-sm text-slate-700">{ws.memo}</p>
        ) : (
          <p className="text-sm text-slate-400">메모가 없어요.</p>
        )
      ) : (
        <>
          <textarea
            value={d}
            onChange={(e) => setD(e.target.value)}
            rows={4}
            aria-label="내부 메모"
            placeholder="계약 특이사항, 후속 처리 등"
            className={FIELD}
          />
          <EditActions
            onCancel={() => setEditing(false)}
            onSave={() => {
              onSave({ memo: d });
              setEditing(false);
            }}
          />
        </>
      )}
    </Card>
  );
}
