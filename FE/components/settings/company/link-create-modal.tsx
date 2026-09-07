"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { RankTabsPreview } from "@/components/settings/company/rank-perms";
import { Button, FIELD } from "@/components/ui";
import { canChooseDept, grantableRanks, invitableDepts } from "@/data/grants";
import { DEPARTMENTS, ROLES, currentRole } from "@/data/org";

/** 사용 한도 — 「무제한」을 두지 않는다 (아래 주석) */
const LIMITS = [1, 5, 10, 50] as const;
/** 만료 — 「만료 없음」을 두지 않는다 */
const DAYS = [1, 7, 30] as const;

/** 이 부서에서 내가 줄 수 있는 직급 */
function ranksOf(dept: string): string[] {
  return grantableRanks(currentRole(), ROLES.filter((r) => r.dept === dept)).map((r) => r.name);
}

/** `YYYY-MM-DD HH:00` — 「7일 뒤」만으로는 그게 언제인지 모른다 */
function expiryAt(days: number): string {
  const t = new Date();
  t.setDate(t.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:00`;
}

export type NewLink = {
  role: string;
  dept: string;
  limit: number;
  expiresAt: string;
};

/**
 * 초대 링크 만들기.
 *
 * 링크는 **받은 사람 누구나 쓸 수 있다.** 메일 초대와 달리 상대를 특정하지 않으므로
 * 부서·직급을 미리 박아 두고, **한도와 만료가 유일한 안전장치**가 된다.
 *
 * **「무제한」과 「만료 없음」을 두지 않는다.** 한 번 새어 나가면 회수할 방법이 그 링크를
 * 지우는 것뿐인데, 지우기 전까지 누구나 들어온다. 길게 필요하면 30일을 고르고 다시 만든다.
 *
 * 부서·직급은 초대 팝업과 같은 규칙으로 좁힌다 — 내가 못 보는 탭을 남에게 열어 줄 수 없다
 * (`data/grants.ts`).
 *
 * **BE 연동 seam**: `onCreate`가 링크 발급 API를 부른다. 지금은 URL을 화면에서 만든다 —
 * 실제 토큰은 서버가 만들어야 한다(추측할 수 없어야 하므로).
 */
export function LinkCreateModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (link: NewLink) => void;
}) {
  const me = currentRole();
  const deptList = invitableDepts(me, DEPARTMENTS);
  const deptLocked = !canChooseDept(me);

  const [dept, setDept] = useState(deptList[0] ?? "");
  const [rank, setRank] = useState(ranksOf(deptList[0] ?? "")[0] ?? "");
  const [limit, setLimit] = useState<number>(10);
  const [days, setDays] = useState<number>(7);

  const rankList = ranksOf(dept);
  const role = ROLES.find((r) => r.dept === dept && r.name === rank) ?? null;
  const ok = !!dept && !!rank;

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
      title="초대 링크 만들기"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button
            disabled={!ok}
            onClick={() => onCreate({ dept, role: rank, limit, expiresAt: expiryAt(days) })}
          >
            링크 만들기
          </Button>
        </div>
      }
    >
      <div className="p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="lk-dept" className="mb-1.5 block text-sm font-medium text-slate-700">
              부서
            </label>
            {deptLocked ? (
              /* 고를 게 하나뿐이면 드롭다운을 두지 않는다 — 눌러도 안 바뀌는 컨트롤이
                 제일 헷갈린다 */
              <p className="flex h-[38px] items-center text-sm text-slate-600">
                {dept || "소속된 부서가 없어요"}
              </p>
            ) : (
              <select
                id="lk-dept"
                className={FIELD}
                value={dept}
                onChange={(e) => changeDept(e.target.value)}
              >
                {deptList.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label htmlFor="lk-rank" className="mb-1.5 block text-sm font-medium text-slate-700">
              직급
            </label>
            <select
              id="lk-rank"
              className={FIELD}
              value={rank}
              disabled={rankList.length === 0}
              onChange={(e) => setRank(e.target.value)}
            >
              {rankList.length === 0 ? (
                <option value="">줄 수 있는 직급이 없어요</option>
              ) : (
                rankList.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label htmlFor="lk-limit" className="mb-1.5 block text-sm font-medium text-slate-700">
              사용 한도
            </label>
            <select
              id="lk-limit"
              className={FIELD}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              {LIMITS.map((n) => (
                <option key={n} value={n}>
                  {n}명
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-400">이 수만큼 수락되면 저절로 닫혀요.</p>
          </div>

          <div>
            <label htmlFor="lk-exp" className="mb-1.5 block text-sm font-medium text-slate-700">
              만료
            </label>
            <select
              id="lk-exp"
              className={FIELD}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {DAYS.map((n) => (
                <option key={n} value={n}>
                  {n}일 뒤
                </option>
              ))}
            </select>
            {/* 「7일 뒤」만 적으면 그게 언제인지 세어 봐야 한다 */}
            <p className="mt-1.5 text-xs text-slate-400">{expiryAt(days)}에 닫혀요</p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-3 py-2">
            <span className="text-xs font-semibold text-slate-600">
              이 링크로 들어오면 볼 수 있는 탭
            </span>
            <span className="text-[11px] text-slate-400">읽기 전용</span>
          </div>
          <RankTabsPreview role={role} />
        </div>
      </div>
    </Modal>
  );
}
