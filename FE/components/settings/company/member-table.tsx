"use client";

import { useState } from "react";
import { DataTable } from "@/components/settings/company/data-table";
import { IconPlus } from "@/components/icons";
import { Button, FIELD } from "@/components/ui";
import { ROLES, USERS_ROLES } from "@/data/org";

/**
 * 관리 기능을 쓸 수 있는지. **보안 경계가 아니다** — 실제 차단은 BE 세션의 역할 검사에서 한다.
 *
 * **BE 연동 seam**: 지금은 더미라 항상 true다. 세션이 붙으면 이 값을 세션 역할에서 읽고,
 * false일 때 내비의 `회사` 그룹도 함께 감춘다 (`data/settings-nav.ts`).
 */
const canManage: boolean = true;

/**
 * 초대 관리 › 구성원 탭.
 *
 * 열은 **이름 · 이메일 · 부서 · 역할** 넷이다 (수정요청 v12). `최근 활동`·`상태` 열과
 * CSV 내보내기를 뺐다 — 이 화면은 "누가 있고 무슨 권한인가"만 본다. 마지막 접속을 보는 건
 * 감사 로그의 일이다.
 *
 * **BE 연동 seam**: `changeRole`이 구성원 역할 변경 API를 부른다.
 */
export function MemberTable({
  onSaved,
  onInvite,
}: {
  onSaved: (message: string) => void;
  onInvite: () => void;
}) {
  const [users, setUsers] = useState(USERS_ROLES);

  function changeRole(email: string, role: string) {
    const name = users.find((u) => u.email === email)?.name ?? "구성원";
    setUsers((prev) => prev.map((u) => (u.email === email ? { ...u, role } : u)));
    onSaved(`${name}의 역할을 ${role}로 바꿨어요`);
  }

  return (
    <>
      <div className="flex items-center justify-end pt-4">
        <Button size="sm" disabled={!canManage} onClick={onInvite}>
          <IconPlus size={14} />
          구성원 초대하기
        </Button>
      </div>

      <DataTable
        rows={users}
        rowKey={(u) => u.email}
        columns={[
          { label: "이름", cell: (u) => <span className="font-medium text-slate-900">{u.name}</span> },
          { label: "이메일", cell: (u) => <span className="text-slate-500">{u.email}</span> },
          { label: "부서", cell: (u) => <span className="text-slate-600">{u.dept}</span> },
          {
            label: "역할",
            cell: (u) => (
              <select
                className={`${FIELD} py-1.5 text-[13px]`}
                value={u.role}
                disabled={!canManage}
                aria-label={`${u.name} 역할`}
                onChange={(e) => changeRole(u.email, e.target.value)}
              >
                {ROLES.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            ),
          },
        ]}
      />
    </>
  );
}
