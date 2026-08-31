"use client";

import { useState } from "react";
import { AdminTable, TD, TD_KEY, TD_WRAP, TR } from "@/components/admin/admin-table";
import { EditActions, SiteFields } from "@/components/admin/form-parts";
import { EditHeader, type Save } from "./shared";
import { Card } from "@/components/ui";
import type { AdminWorkspace, Site } from "@/data/admin";

/* ── 종사업장 ── */

export function SitesCard({ ws, onSave }: { ws: AdminWorkspace; onSave: Save }) {
  const [editing, setEditing] = useState(false);
  const [d, setD] = useState<Site[]>(ws.sites);

  function open() {
    setD(ws.sites);
    setEditing(true);
  }

  return (
    <Card>
      <EditHeader title={`종사업장 ${ws.sites.length}곳`} editing={editing} onEdit={open} />

      {!editing ? (
        ws.sites.length === 0 ? (
          <p className="text-sm text-slate-400">등록된 종사업장이 없어요.</p>
        ) : (
          <AdminTable columns={["사업장명", "사업자등록번호", "주소", "업태 / 업종"]} minWidth={440}>
            {ws.sites.map((s, i) => (
              <tr key={`${s.name}-${i}`} className={TR}>
                <td className={TD_KEY}>{s.name}</td>
                <td className={`${TD} tabular-nums`}>{s.bizNumber}</td>
                <td className={TD_WRAP}>{s.address}</td>
                <td className={TD}>
                  {s.bizType} / {s.bizItem}
                </td>
              </tr>
            ))}
          </AdminTable>
        )
      ) : (
        <>
          <SiteFields sites={d} onChange={setD} idPrefix="edit-site" />
          <EditActions
            canSave={d.every((s) => s.name.trim())}
            onCancel={() => setEditing(false)}
            onSave={() => {
              onSave({ sites: d.filter((s) => s.name.trim()) });
              setEditing(false);
            }}
          />
        </>
      )}
    </Card>
  );
}
