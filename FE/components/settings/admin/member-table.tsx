"use client";

import { useState } from "react";
import { IconDownload, IconPlus } from "@/components/icons";
import { Badge, Button, FIELD } from "@/components/ui";
import { ROLES, USERS_ROLES } from "@/data/org";
import { downloadCsv } from "@/lib/download";

/**
 * 관리 기능을 쓸 수 있는지. **보안 경계가 아니다** — 실제 차단은 BE 세션의 역할 검사에서 한다.
 *
 * **BE 연동 seam**: 지금은 더미라 항상 true다. 세션이 붙으면 이 값을 세션 역할에서 읽고,
 * false일 때 내비의 `관리` 그룹도 함께 감춘다 (`data/settings-nav.ts`).
 */
const canManage: boolean = true;

/**
 * 초대 관리 › 구성원 탭.
 *
 * 표는 `ui.tsx`의 `DataTable`(셀이 `string | number | badge`뿐)로 부족해서 직접 그린다 —
 * 역할 열에 select가 들어간다.
 *
 * 참고 화면은 이름·이메일·역할 셋뿐이지만 `부서`·`최근 활동`·`상태`를 더 둔다.
 * `USERS_ROLES`에 그 값이 실제로 있고, **부서는 역할의 데이터 접근 범위(`dept`)가 쓰는
 * 값이다.** 참고 화면이 셋인 건 그 제품에 그 데이터가 없어서다.
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

  function exportCsv() {
    // `downloadCsv(filename, rows)` — 헤더도 rows의 첫 줄이다 (`lib/download.ts`)
    downloadCsv("구성원.csv", [
      ["이름", "이메일", "부서", "역할", "최근 활동", "상태"],
      ...users.map((u) => [u.name, u.email, u.dept, u.role, u.lastActive, u.status.badge]),
    ]);
    onSaved("구성원 목록을 내보냈어요");
  }

  return (
    <>
      {/* 참고 화면처럼 표 위 오른쪽에 초대 버튼을 둔다 */}
      <div className="flex items-center justify-between gap-3 pt-4">
        <Button variant="secondary" size="sm" onClick={exportCsv}>
          <IconDownload size={14} />
          CSV로 내보내기
        </Button>
        <Button size="sm" disabled={!canManage} onClick={onInvite}>
          <IconPlus size={14} />
          구성원 초대하기
        </Button>
      </div>

      <div className="thin-scroll mt-3 overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-medium text-slate-400">
              <th scope="col" className="py-2.5 pr-3">이름</th>
              <th scope="col" className="px-3 py-2.5">이메일</th>
              <th scope="col" className="px-3 py-2.5">부서</th>
              <th scope="col" className="px-3 py-2.5">역할</th>
              <th scope="col" className="px-3 py-2.5">최근 활동</th>
              <th scope="col" className="py-2.5 pl-3">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.email} className="transition-colors hover:bg-slate-50/70">
                <td className="py-3 pr-3 font-medium text-slate-900">{u.name}</td>
                <td className="px-3 py-3 text-slate-500">{u.email}</td>
                <td className="px-3 py-3 text-slate-600">{u.dept}</td>
                <td className="px-3 py-3">
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
                </td>
                <td className="px-3 py-3 text-slate-500">{u.lastActive}</td>
                <td className="py-3 pl-3">
                  <Badge tone={u.status.tone}>{u.status.badge}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
