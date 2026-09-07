"use client";

import { useMemo, useState } from "react";
import { DataTable } from "@/components/settings/company/data-table";
import { IconPlus, IconSearch } from "@/components/icons";
import { Button, FIELD } from "@/components/ui";
import { DEPARTMENTS, ROLES, USERS_ROLES } from "@/data/org";

/**
 * 관리 기능을 쓸 수 있는지. **보안 경계가 아니다** — 실제 차단은 BE 세션의 직급 검사에서 한다.
 *
 * **BE 연동 seam**: 지금은 더미라 항상 true다. 세션이 붙으면 이 값을 세션 직급에서 읽고,
 * false일 때 내비의 `회사` 그룹도 함께 감춘다 (`data/settings-nav.ts`).
 */
const canManage: boolean = true;

const ALL = "__all";

/**
 * 초대 관리 › 구성원 탭.
 *
 * 열은 **이름 · 이메일 · 부서 · 직급** 넷이다. 이름과 이메일은 각자 열을 갖는다 —
 * 한 칸에 겹치면 이름으로 훑을 때 눈이 두 줄씩 건너뛴다.
 *
 * **검색과 필터를 표 위에 둔다.** 지금은 6명이라 없어도 되지만, 60명이 되면 스크롤로 사람을
 * 찾게 된다. 셋 다 화면 안에서만 거른다 — 목록이 커지면 BE 쿼리로 올린다.
 *
 * 구성원 제거는 넣지 않는다. 되돌릴 수 없는 동작이고 BE에 해당 API도 없다.
 *
 * **BE 연동 seam**: `changeRole`이 구성원 직급 변경 API를 부른다.
 */
export function MemberTable({
  onSaved,
  onInvite,
}: {
  onSaved: (message: string) => void;
  onInvite: () => void;
}) {
  const [users, setUsers] = useState(USERS_ROLES);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState<string>(ALL);
  const [role, setRole] = useState<string>(ALL);

  function changeRole(email: string, next: string) {
    const name = users.find((u) => u.email === email)?.name ?? "구성원";
    setUsers((prev) => prev.map((u) => (u.email === email ? { ...u, role: next } : u)));
    onSaved(`${name}의 직급을 ${next}로 바꿨어요`);
  }

  const shown = useMemo(() => {
    // 이름과 이메일 둘 다 본다 — 사람을 찾을 때 둘 중 뭐가 기억나는지는 그때그때 다르다
    const needle = q.trim().toLowerCase();
    return users.filter((u) => {
      if (needle && !`${u.name} ${u.email}`.toLowerCase().includes(needle)) return false;
      if (dept !== ALL && u.dept !== dept) return false;
      if (role !== ALL && u.role !== role) return false;
      return true;
    });
  }, [users, q, dept, role]);

  const filtered = q.trim() !== "" || dept !== ALL || role !== ALL;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 pt-4">
        <span className="relative min-w-[180px] flex-1">
          <IconSearch
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이름 또는 이메일로 찾기"
            aria-label="구성원 검색"
            className={`${FIELD} py-1.5 pl-9 text-[13px]`}
          />
        </span>

        <select
          className={`${FIELD} w-auto py-1.5 text-[13px]`}
          value={dept}
          aria-label="부서로 거르기"
          onChange={(e) => setDept(e.target.value)}
        >
          <option value={ALL}>부서 전체</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <select
          className={`${FIELD} w-auto py-1.5 text-[13px]`}
          value={role}
          aria-label="직급으로 거르기"
          onChange={(e) => setRole(e.target.value)}
        >
          <option value={ALL}>직급 전체</option>
          {ROLES.map((r) => (
            <option key={r.id} value={r.name}>
              {r.name}
            </option>
          ))}
        </select>

        <Button size="sm" disabled={!canManage} onClick={onInvite}>
          <IconPlus size={14} />
          구성원 초대하기
        </Button>
      </div>

      <DataTable
        rows={shown}
        rowKey={(u) => u.email}
        // 거른 결과가 빈 것과 애초에 아무도 없는 것은 다음에 할 일이 다르다
        empty={filtered ? "찾는 구성원이 없어요" : "데이터가 없습니다"}
        columns={[
          { label: "이름", cell: (u) => <span className="font-medium text-slate-900">{u.name}</span> },
          {
            label: "이메일",
            cell: (u) => <span className="font-mono text-[12.5px] text-slate-500">{u.email}</span>,
          },
          { label: "부서", cell: (u) => <span className="text-slate-600">{u.dept}</span> },
          {
            label: "직급",
            cell: (u) => (
              // 폭은 감싸는 쪽이 정한다. `FIELD`에 `w-[30%]`를 덧붙이는 걸로는 안 된다 —
              // 클래스 문자열 순서가 CSS 우선순위를 정하지 않아 `w-full`이 이긴다
              // (`ui.tsx`의 `FIELD_INLINE` 주석이 같은 함정을 적어뒀다).
              // 직급 이름이 길어도 읽히도록 최소 폭은 준다.
              <span className="block w-[30%] min-w-[132px]">
                <select
                  className={`${FIELD} py-1.5 text-[13px]`}
                  value={u.role}
                  disabled={!canManage}
                  aria-label={`${u.name} 직급`}
                  onChange={(e) => changeRole(u.email, e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </span>
            ),
          },
        ]}
      />
    </>
  );
}
