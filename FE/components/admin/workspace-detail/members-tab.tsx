"use client";

import { useMemo, useState } from "react";
import { AdminTable, TD, TD_KEY, TR } from "@/components/admin/admin-table";
import { IconSearch } from "@/components/icons";
import { Badge, Card, FIELD, SectionHeader } from "@/components/ui";
import type { AdminWorkspace } from "@/data/admin";

export function MembersTab({ ws }: { ws: AdminWorkspace }) {
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return ws.members;
    return ws.members.filter(
      (m) => m.email.toLowerCase().includes(needle) || (m.name ?? "").toLowerCase().includes(needle),
    );
  }, [q, ws.members]);

  return (
    <Card>
      <SectionHeader
        title={`멤버 ${ws.members.length}명`}
        desc="멤버 초대·권한 변경은 고객사 담당자가 자기 화면에서 해요."
      />

      {ws.members.length === 0 ? (
        <p className="text-sm text-slate-400">
          아직 멤버가 없어요. 접속 링크 받는 사람이 링크를 열면 첫 관리자로 등록돼요.
        </p>
      ) : (
        <>
          <div className="relative mb-4 max-w-xs">
            <IconSearch
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="이름 또는 이메일"
              aria-label="멤버 검색"
              className={`${FIELD} pl-9`}
            />
          </div>

          <AdminTable
            columns={["이름", "이메일", "권한", "상태", "초대일", "마지막 접속"]}
            minWidth={720}
          >
            {rows.map((m) => (
              <tr key={m.email} className={TR}>
                <td className={TD_KEY}>{m.name ?? "—"}</td>
                <td className={TD}>{m.email}</td>
                <td className={TD}>{m.role}</td>
                <td className={TD}>
                  {m.state === "active" ? (
                    <Badge tone="green">사용 중</Badge>
                  ) : (
                    <Badge tone="slate">초대 대기</Badge>
                  )}
                </td>
                <td className={TD}>{m.invitedAt}</td>
                <td className={TD}>{m.lastSeen}</td>
              </tr>
            ))}
          </AdminTable>

          {rows.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">
              검색 결과가 없어요. 다른 이름이나 이메일로 찾아보세요.
            </p>
          )}
        </>
      )}
    </Card>
  );
}
