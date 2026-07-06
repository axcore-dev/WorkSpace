"use client";

import { useState } from "react";
import { IconPlus, IconUsers } from "@/components/icons";
import { InviteModal } from "@/components/settings/invite-modal";
import { Badge, Button, Card, SectionHeader } from "@/components/ui";
import { USERS_ROLES } from "@/data/org";

export function AdminSettings() {
  const [inviteOpen, setInviteOpen] = useState(false);
  return (
    <div className="space-y-5">
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        이 영역은 <strong className="font-semibold text-slate-800">관리자 전용</strong>입니다. 역할·부서에
        따라 기능(모듈·메뉴·버튼)과 데이터 접근 범위가 제어됩니다.
      </p>

      <Card>
        <SectionHeader
          title={
            <span className="flex items-center gap-2">
              <IconUsers size={16} className="text-slate-400" /> 사용자 및 역할 관리 (RBAC)
            </span>
          }
          desc="역할을 정의하고 사용자별로 부여합니다. 워크스페이스 첫 생성자는 관리자 권한이 자동 부여됩니다."
          action={
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <IconPlus size={14} />
              구성원 초대
            </Button>
          }
        />
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-400">
                <th scope="col" className="py-2.5 pr-3">구성원</th>
                <th scope="col" className="px-3 py-2.5">부서</th>
                <th scope="col" className="px-3 py-2.5">역할</th>
                <th scope="col" className="px-3 py-2.5">최근 활동</th>
                <th scope="col" className="px-3 py-2.5">상태</th>
                <th scope="col" className="py-2.5 pl-3 text-right">동작</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {USERS_ROLES.map((u) => (
                <tr key={u.email} className="transition-colors hover:bg-slate-50/70">
                  <td className="py-3 pr-3">
                    <p className="font-medium text-slate-900">{u.name}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{u.dept}</td>
                  <td className="px-3 py-3 text-slate-600">{u.role}</td>
                  <td className="px-3 py-3 text-slate-500">{u.lastActive}</td>
                  <td className="px-3 py-3">
                    <Badge tone={u.status.tone}>{u.status.badge}</Badge>
                  </td>
                  <td className="py-3 pl-3 text-right">
                    <Button variant="ghost" size="sm">
                      역할 변경
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
