"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { RankTabsPreview } from "@/components/settings/company/rank-perms";
import { Button, FIELD } from "@/components/ui";
import { DEPARTMENTS, ROLES } from "@/data/org";

/** 직급은 부서 안에 있다 — 부서를 고르면 그 부서 직급만 보인다 */
function ranksOf(dept: string): string[] {
  return ROLES.filter((r) => r.dept === dept).map((r) => r.name);
}

/**
 * 구성원의 부서·직급 바꾸기.
 *
 * **표 안에서 바로 고치지 않는다.** 예전에는 직급 열이 `select`였는데, 부서까지 열에 넣으면
 * 한 줄에 드롭다운이 둘이 되어 표가 폼처럼 보인다. 그리고 부서를 바꾸면 직급이 따라
 * 바뀌어야 하는데 — 표 안에서 두 칸이 서로를 다시 그리면 어느 쪽을 먼저 눌렀는지에 따라
 * 값이 달라진다. 계정 페이지의 「값 + 수정 버튼 → 팝업」과 같은 모양으로 맞춘다.
 *
 * 바꾼 직급이 어떤 탭을 여는지 **읽기 전용**으로 함께 보여준다 — 권한 자체는 권한 관리에서
 * 정한다.
 *
 * **BE 연동 seam**: `onSave`가 구성원 소속·직급 변경 API를 부른다.
 */
export function MemberEditModal({
  name,
  dept: initialDept,
  rank: initialRank,
  onClose,
  onSave,
}: {
  name: string;
  dept: string;
  rank: string;
  onClose: () => void;
  onSave: (next: { dept: string; rank: string }) => void;
}) {
  const [dept, setDept] = useState(initialDept);
  const [rank, setRank] = useState(initialRank);

  const rankList = ranksOf(dept);
  const role = ROLES.find((r) => r.dept === dept && r.name === rank) ?? null;
  const changed = dept !== initialDept || rank !== initialRank;

  function changeDept(next: string) {
    setDept(next);
    // 부서를 바꾸면 직급도 그 부서 것으로 옮긴다 — 안 하면 없는 조합이 남는다
    setRank(ranksOf(next)[0] ?? "");
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={`${name} 소속 바꾸기`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button disabled={!changed || !rank} onClick={() => onSave({ dept, rank })}>
            저장하기
          </Button>
        </div>
      }
    >
      <div className="p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="me-dept" className="mb-1.5 block text-sm font-medium text-slate-700">
              부서
            </label>
            <select
              id="me-dept"
              className={FIELD}
              value={dept}
              onChange={(e) => changeDept(e.target.value)}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="me-rank" className="mb-1.5 block text-sm font-medium text-slate-700">
              직급
            </label>
            <select
              id="me-rank"
              className={FIELD}
              value={rank}
              disabled={rankList.length === 0}
              onChange={(e) => setRank(e.target.value)}
            >
              {rankList.length === 0 ? (
                <option value="">이 부서에 직급이 없어요</option>
              ) : (
                rankList.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-3 py-2">
            <span className="text-xs font-semibold text-slate-600">이 직급이 볼 수 있는 탭</span>
            <span className="text-[11px] text-slate-400">읽기 전용</span>
          </div>
          <RankTabsPreview role={role} />
        </div>
      </div>
    </Modal>
  );
}
