"use client";

import { useMemo, useState } from "react";
import { DataTable } from "@/components/settings/company/data-table";
import { grantableRanks as ranksOf } from "@/components/settings/company/link-create-modal";
import type { PeopleData } from "@/components/settings/company/people-manager";
import { IconPlus, IconSearch } from "@/components/icons";
import { Button, FIELD_SM, FIELD_SM_INLINE } from "@/components/ui";
import { josa, withJosa } from "@/data/ko";
import { ApiRequestError } from "@/lib/api";
import { updateMember, type MemberDto, type WorkspaceMeDto } from "@/lib/workspace-api";

const ALL = "__all";
const NONE = "";

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
 * 저장 전에는 `draft`에만 쓴다. 취소하면 버린다. 저장은 `PATCH /api/workspace/members/{id}` —
 * **소유자만** 바꿀 수 있고 소유자 자신의 소속은 못 바꾼다. 화면은 그 규칙에 맞지 않는 「수정」·「초대하기」 버튼을
 * 아예 그리지 않는다 — 눌러도 안 되는 버튼이 있으면 고장으로 보인다. 진짜 문은 서버다.
 *
 * **검색과 필터를 표 위에 둔다.** 지금은 몇 명이라 없어도 되지만, 60명이 되면 스크롤로 사람을
 * 찾게 된다. 셋 다 화면 안에서만 거른다 — 목록이 커지면 BE 쿼리로 올린다.
 *
 * 구성원 제거는 넣지 않는다. 되돌릴 수 없는 동작이고 BE에 해당 API도 없다.
 */
export function MemberTable({
  data,
  me,
  onSaved,
  onInvite,
  onChanged,
}: {
  data: PeopleData;
  me: WorkspaceMeDto | null;
  onSaved: (message: string, tone?: "ink" | "error") => void;
  onInvite: () => void;
  onChanged: () => Promise<void>;
}) {
  const { members, depts, roles } = data;
  // 소유자만 바꾼다 — 「수정」·「초대하기」 버튼이 소유자에게만 보인다
  const canManage = !!me?.member.owner;

  const [q, setQ] = useState("");
  const [dept, setDept] = useState<string>(ALL);
  const [role, setRole] = useState<string>(ALL);
  /** 지금 고치고 있는 행의 id. 한 번에 한 행만 연다 */
  const [editing, setEditing] = useState<number | null>(null);
  /** 저장 전 값 — 취소하면 버린다 */
  const [draft, setDraft] = useState<{ deptId: number | null; roleId: number | null }>({ deptId: null, roleId: null });
  const [saving, setSaving] = useState(false);

  function startEdit(u: MemberDto) {
    setDraft({ deptId: u.departmentId, roleId: u.roleId });
    setEditing(u.id);
  }

  /** 부서를 바꾸면 직급은 비운다 — 새 부서의 직급은 고르는 사람이 정한다(임의로 첫 직급을 주지 않는다) */
  function draftDept(next: number | null) {
    const list = ranksOf(roles, next);
    setDraft({ deptId: next, roleId: list.find((r) => r.id === draft.roleId)?.id ?? null });
  }

  async function saveEdit(u: MemberDto) {
    if (draft.roleId === null) {
      onSaved("직급을 골라 주세요", "error");
      return;
    }
    setSaving(true);
    try {
      const next = await updateMember(u.id, { roleId: draft.roleId, departmentId: draft.deptId });
      setEditing(null);
      await onChanged();
      const rankName = next.roleName ?? "";
      if (u.departmentId === next.departmentId) {
        onSaved(`${u.name}의 직급을 ${rankName}${josa(rankName, "로/으로")} 바꿨어요`);
      } else {
        const where = `${next.departmentName ?? "전사"} ${rankName}`.trim();
        onSaved(`${withJosa(u.name, "을/를")} ${where}${josa(where, "로/으로")} 옮겼어요`);
      }
    } catch (e) {
      onSaved(e instanceof ApiRequestError ? e.body.message : "저장하지 못했어요", "error");
    } finally {
      setSaving(false);
    }
  }

  /** 이 행을 고칠 수 있는가 — 소유자가, 소유자 아닌 사람을 */
  const editable = (u: MemberDto) => canManage && u.roleCode !== "owner";

  const shown = useMemo(() => {
    // 이름과 이메일 둘 다 본다 — 사람을 찾을 때 둘 중 뭐가 기억나는지는 그때그때 다르다
    const needle = q.trim().toLowerCase();
    return members.filter((u) => {
      if (needle && !`${u.name} ${u.email}`.toLowerCase().includes(needle)) return false;
      if (dept !== ALL && String(u.departmentId ?? NONE) !== dept) return false;
      if (role !== ALL && String(u.roleId ?? NONE) !== role) return false;
      return true;
    });
  }, [members, q, dept, role]);

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
          <option value={NONE}>부서 없음</option>
          {depts.map((d) => (
            <option key={d.id} value={String(d.id)}>
              {d.name}
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
          {roles.map((r) => (
            <option key={r.id} value={String(r.id)}>
              {r.name}
            </option>
          ))}
        </select>

        {canManage && (
          <Button size="sm" className="h-8" onClick={onInvite}>
            <IconPlus size={14} />
            초대하기
          </Button>
        )}
      </div>

      <DataTable
        rows={shown}
        rowKey={(u) => String(u.id)}
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
              <span className="block truncate font-mono text-[12.5px] text-slate-500">{u.email}</span>
            ),
          },
          {
            label: "부서",
            width: "20%",
            cell: (u) =>
              editing === u.id ? (
                <select
                  className={FIELD_SM_INLINE}
                  value={draft.deptId === null ? NONE : String(draft.deptId)}
                  aria-label={`${u.name} 부서`}
                  onChange={(e) => draftDept(e.target.value === NONE ? null : Number(e.target.value))}
                >
                  <option value={NONE}>부서 없음</option>
                  {depts.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-slate-600">{u.departmentName ?? "—"}</span>
              ),
          },
          {
            label: "직급",
            width: "22%",
            cell: (u) => {
              if (editing !== u.id) return <span className="text-slate-600">{u.roleName ?? "—"}</span>;
              const list = ranksOf(roles, draft.deptId);
              return (
                <select
                  className={FIELD_SM_INLINE}
                  value={draft.roleId === null ? "" : String(draft.roleId)}
                  disabled={list.length === 0}
                  aria-label={`${u.name} 직급`}
                  onChange={(e) => setDraft((d) => ({ ...d, roleId: Number(e.target.value) }))}
                >
                  {/* 그 부서에 줄 수 있는 직급이 하나도 없을 수 있다 — 권한 관리에서 다 지운 경우, 또는 내 권한 밖 */}
                  {list.length === 0 ? (
                    <option value="">줄 수 있는 직급이 없어요</option>
                  ) : (
                    <>
                      <option value="">직급을 골라 주세요</option>
                      {list.map((r) => (
                        <option key={r.id} value={String(r.id)}>
                          {r.name}
                        </option>
                      ))}
                    </>
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
              editing === u.id ? (
                <span className="inline-flex gap-1.5">
                  {/* 블루를 쓰지 않는다 — 이 화면의 주 액션은 위 「초대하기」다
                      (DESIGN.md 「한 화면에 primary 버튼을 여러 개 두지 않는다」).
                      옆의 「취소」가 ghost라 이것만 테두리를 가져도 무엇이 확정인지 읽힌다 */}
                  <Button variant="secondary" size="sm" className="h-8" disabled={saving} onClick={() => void saveEdit(u)}>
                    {saving ? "저장 중…" : "저장"}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8" onClick={() => setEditing(null)}>
                    취소
                  </Button>
                </span>
              ) : editable(u) ? (
                <Button variant="secondary" size="sm" className="h-8" onClick={() => startEdit(u)}>
                  수정
                </Button>
              ) : null,
          },
        ]}
      />
    </>
  );
}
