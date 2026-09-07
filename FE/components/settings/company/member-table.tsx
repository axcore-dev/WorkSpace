"use client";

import { useMemo, useState } from "react";
import { DataTable } from "@/components/settings/company/data-table";
import { IconPlus, IconSearch } from "@/components/icons";
import { Button, FIELD_SM, FIELD_SM_INLINE } from "@/components/ui";
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

/** 직급은 부서 안에 있다 — 부서를 고르면 그 부서 직급만 보인다 */
function ranksOf(dept: string): string[] {
  return ROLES.filter((r) => r.dept === dept).map((r) => r.name);
}

/**
 * 초대 관리 › 구성원 탭.
 *
 * 열은 **이름 · 이메일 · 부서 · 직급**이다. 이름과 이메일은 각자 열을 갖는다 —
 * 한 칸에 겹치면 이름으로 훑을 때 눈이 두 줄씩 건너뛴다.
 *
 * 부서·직급은 **그 행에서 바로 고친다** — 「수정」을 누른 행만 드롭다운이 되고 나머지는 값이다.
 * 모든 행에 늘 드롭다운을 두면 표가 폼처럼 보이고, 스크롤하다 잘못 건드리기도 쉽다.
 * 팝업을 띄우지 않는 이유는 반대다 — 값 두 개 고치자고 화면을 덮을 일이 아니다.
 *
 * 직급은 부서 안에 있으므로 부서를 바꾸면 그 부서의 첫 직급으로 함께 옮긴다 — 두 값을 각각
 * 두면 「생산본부 · 품질 관리자」처럼 없는 조합이 화면에 남는다.
 *
 * 저장 전에는 `draft`에만 쓴다. 취소하면 버린다.
 *
 * **검색과 필터를 표 위에 둔다.** 지금은 6명이라 없어도 되지만, 60명이 되면 스크롤로 사람을
 * 찾게 된다. 셋 다 화면 안에서만 거른다 — 목록이 커지면 BE 쿼리로 올린다.
 *
 * 구성원 제거는 넣지 않는다. 되돌릴 수 없는 동작이고 BE에 해당 API도 없다.
 *
 * **BE 연동 seam**: `saveEdit`이 구성원 소속·직급 변경 API를 부른다.
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
  /** 지금 고치고 있는 행의 이메일. 한 번에 한 행만 연다 */
  const [editing, setEditing] = useState<string | null>(null);
  /** 저장 전 값 — 취소하면 버린다 */
  const [draft, setDraft] = useState<{ dept: string; rank: string }>({ dept: "", rank: "" });

  function startEdit(u: { email: string; dept: string; role: string }) {
    setDraft({ dept: u.dept, rank: u.role });
    setEditing(u.email);
  }

  /**
   * 부서를 바꾸면 직급도 그 부서 것으로 함께 옮긴다.
   * 두 값을 각각 두면 「생산본부 · 품질 관리자」처럼 없는 조합이 화면에 남는다.
   */
  function draftDept(nextDept: string) {
    setDraft({ dept: nextDept, rank: ranksOf(nextDept)[0] ?? "" });
  }

  function saveEdit(email: string) {
    const who = users.find((u) => u.email === email);
    if (!who) return;
    setUsers((prev) =>
      prev.map((u) => (u.email === email ? { ...u, dept: draft.dept, role: draft.rank } : u)),
    );
    setEditing(null);
    if (who.dept === draft.dept) {
      onSaved(`${who.name}의 직급을 ${draft.rank}${josa(draft.rank, "로/으로")} 바꿨어요`);
      return;
    }
    const where = draft.rank ? `${draft.dept} ${draft.rank}` : draft.dept;
    onSaved(`${withJosa(who.name, "을/를")} ${where}${josa(where, "로/으로")} 옮겼어요`);
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
      {/* 필터 줄 — 검색·부서·직급·버튼 넷의 높이를 `h-8`로 맞춘다 (`FIELD_SM`).
          패딩으로 맞추면 글자 크기가 다른 요소끼리 1~2px씩 어긋난다. */}
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
            className={`${FIELD_SM} pl-9`}
          />
        </span>

        <select
          className={FIELD_SM_INLINE}
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
          className={FIELD_SM_INLINE}
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

        <Button size="sm" className="h-8" disabled={!canManage} onClick={onInvite}>
          <IconPlus size={14} />
          초대하기
        </Button>
      </div>

      <DataTable
        rows={shown}
        rowKey={(u) => u.email}
        // 거른 결과가 빈 것과 애초에 아무도 없는 것은 다음에 할 일이 다르다
        empty={filtered ? "찾는 구성원이 없어요" : "데이터가 없습니다"}
        columns={[
          // 열 너비를 못 박는다 — 셀이 값에서 드롭다운으로 바뀔 때 열이 다시 계산되면
          // 누른 「수정」 버튼이 옆으로 밀린다
          {
            label: "이름",
            width: "14%",
            cell: (u) => <span className="font-medium text-slate-900">{u.name}</span>,
          },
          {
            label: "이메일",
            width: "30%",
            cell: (u) => (
              <span className="block truncate font-mono text-[12.5px] text-slate-500">
                {u.email}
              </span>
            ),
          },
          {
            label: "부서",
            width: "20%",
            cell: (u) =>
              editing === u.email ? (
                <select
                  className={FIELD_SM_INLINE}
                  value={draft.dept}
                  aria-label={`${u.name} 부서`}
                  onChange={(e) => draftDept(e.target.value)}
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-slate-600">{u.dept}</span>
              ),
          },
          {
            label: "직급",
            width: "22%",
            cell: (u) => {
              if (editing !== u.email) return <span className="text-slate-600">{u.role}</span>;
              const list = ranksOf(draft.dept);
              return (
                <select
                  className={FIELD_SM_INLINE}
                  value={draft.rank}
                  disabled={list.length === 0}
                  aria-label={`${u.name} 직급`}
                  onChange={(e) => setDraft((d) => ({ ...d, rank: e.target.value }))}
                >
                  {/* 그 부서에 직급이 하나도 없을 수 있다 — 권한 관리에서 다 지운 경우 */}
                  {list.length === 0 ? (
                    <option value="">직급 없음</option>
                  ) : (
                    list.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))
                  )}
                </select>
              );
            },
          },
          {
            label: "",
            right: true,
            width: "132px",
            cell: (u) =>
              editing === u.email ? (
                <span className="inline-flex gap-1.5">
                  <Button size="sm" className="h-8" onClick={() => saveEdit(u.email)}>
                    저장
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => setEditing(null)}
                  >
                    취소
                  </Button>
                </span>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8"
                  disabled={!canManage}
                  onClick={() => startEdit(u)}
                >
                  수정
                </Button>
              ),
          },
        ]}
      />
    </>
  );
}