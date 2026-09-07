"use client";

import { useMemo, useState } from "react";
import { DataTable } from "@/components/settings/company/data-table";
import { MemberEditModal } from "@/components/settings/company/member-edit-modal";
import { IconPlus, IconSearch } from "@/components/icons";
// `FIELD`는 `w-full`이라 필터 셋을 한 줄에 못 놓는다 — `FIELD_INLINE`이 그 용도다
import { Button, FIELD, FIELD_INLINE } from "@/components/ui";
import { josa, withJosa } from "@/data/ko";
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
 * 열은 **이름 · 이메일 · 부서 · 직급**이다. 이름과 이메일은 각자 열을 갖는다 —
 * 한 칸에 겹치면 이름으로 훑을 때 눈이 두 줄씩 건너뛴다.
 *
 * **표 안에서 고치지 않는다.** 직급 열이 `select`였는데 부서까지 넣으면 한 줄에 드롭다운이
 * 둘이 되어 표가 폼처럼 보인다. 게다가 직급은 부서 안에 있어서 부서를 바꾸면 직급이 따라
 * 바뀌어야 하는데, 표 안에서 두 칸이 서로를 다시 그리면 값이 엉킨다.
 * 값은 읽기만 하고 고치는 건 「수정」 팝업이 맡는다 — 계정 페이지와 같은 모양이다.
 *
 * **검색과 필터를 표 위에 둔다.** 지금은 6명이라 없어도 되지만, 60명이 되면 스크롤로 사람을
 * 찾게 된다. 셋 다 화면 안에서만 거른다 — 목록이 커지면 BE 쿼리로 올린다.
 *
 * 구성원 제거는 넣지 않는다. 되돌릴 수 없는 동작이고 BE에 해당 API도 없다.
 *
 * **BE 연동 seam**: `saveMember`가 구성원 소속·직급 변경 API를 부른다.
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
  /** 지금 고치고 있는 구성원의 이메일. `null`이면 팝업이 닫혀 있다 */
  const [editing, setEditing] = useState<string | null>(null);

  const target = users.find((u) => u.email === editing) ?? null;

  function saveMember(email: string, next: { dept: string; rank: string }) {
    const who = users.find((u) => u.email === email);
    if (!who) return;
    setUsers((prev) =>
      prev.map((u) => (u.email === email ? { ...u, dept: next.dept, role: next.rank } : u)),
    );
    setEditing(null);
    onSaved(
      who.dept === next.dept
        ? `${who.name}의 직급을 ${next.rank}${josa(next.rank, "로/으로")} 바꿨어요`
        : `${withJosa(who.name, "을/를")} ${next.dept} ${next.rank}${josa(next.rank, "로/으로")} 옮겼어요`,
    );
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
          className={`${FIELD_INLINE} py-1.5 text-[13px]`}
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
          className={`${FIELD_INLINE} py-1.5 text-[13px]`}
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
          { label: "직급", cell: (u) => <span className="text-slate-600">{u.role}</span> },
          {
            label: "",
            right: true,
            cell: (u) => (
              <Button
                variant="secondary"
                size="sm"
                disabled={!canManage}
                onClick={() => setEditing(u.email)}
              >
                수정
              </Button>
            ),
          },
        ]}
      />

      {/* 열 때만 마운트한다 — 닫으면 고르던 값이 사라지고, 지우는 effect가 필요 없어진다 */}
      {target && (
        <MemberEditModal
          name={target.name}
          dept={target.dept}
          rank={target.role}
          onClose={() => setEditing(null)}
          onSave={(next) => saveMember(target.email, next)}
        />
      )}
    </>
  );
}
