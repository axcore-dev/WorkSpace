"use client";

import { MODULES } from "@/data/modules";
import type { RoleDef } from "@/data/roles";
import type { RoleDto } from "@/lib/workspace-api";

/** 서버 직급 → 화면 직급 모양. 회사 권한 두 개는 탭과 같은 목록(`perms`)에 `ws:*` 로 들어간다 */
export function roleDefOf(r: RoleDto): RoleDef {
  return {
    id: String(r.id),
    name: r.name,
    system: r.system,
    dept: r.departmentName,
    perms: [
      ...(r.admin ? ["ws:settings"] : []),
      ...(r.canManageIntegrations ? ["ws:integrations"] : []),
      ...r.tabs,
    ],
    scope: r.dataScope,
    showAmounts: r.showAmounts,
    canDelegateInvite: r.canInvite,
  };
}

/** 이 직급이 볼 수 있는 서브기능 탭 id — 여러 화면이 같은 계산을 쓴다 */
export function grantedTabs(role: RoleDef, slug: string): string[] {
  const mod = MODULES.find((m) => m.slug === slug);
  if (!mod) return [];
  return mod.subfunctions.filter((s) => role.perms.includes(s.id)).map((s) => s.id);
}

/** 켜진 탭 수 / 전체 탭 수 */
export function tabCount(role: RoleDef): { on: number; total: number } {
  let on = 0;
  let total = 0;
  for (const m of MODULES) {
    total += m.subfunctions.length;
    on += m.subfunctions.filter((s) => role.perms.includes(s.id)).length;
  }
  return { on, total };
}

/**
 * 직급이 여는 기능 탭 — **읽기 전용**.
 *
 * 초대 팝업이 쓴다. 권한은 권한 관리에서 정하고 여기서는 확인만 한다 — 초대하는 사람이
 * 우회로 권한을 만들 수 있으면 권한 관리를 소유자 전용으로 둔 뜻이 없어진다.
 *
 * 열리지 않는 탭도 함께 보여준다. 열린 것만 보이면 "이게 전부인가, 나머지는 없는 건가"를
 * 알 수 없다.
 */
export function RankTabsPreview({ role }: { role: RoleDef | null }) {
  if (!role) {
    return (
      <p className="px-3 py-4 text-center text-xs text-slate-400">
        직급을 고르면 볼 수 있는 탭이 나와요.
      </p>
    );
  }

  const shown = MODULES.filter((m) => grantedTabs(role, m.slug).length > 0);

  if (shown.length === 0) {
    return (
      <p className="px-3 py-4 text-center text-xs text-slate-400">
        이 직급으로는 열리는 탭이 없어요.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {shown.map((m) => {
        const on = grantedTabs(role, m.slug);
        return (
          <li key={m.slug} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-3 py-2">
            <span className="w-[68px] shrink-0 text-xs font-semibold text-slate-600">
              {m.name}
            </span>
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {m.subfunctions.flatMap((s, i) => [
                // 묶음이 바뀌는 자리(처리 | 설정)에 세로 구분선
                ...(i > 0 && s.group && s.group !== m.subfunctions[i - 1].group ? [<span key={`sep-${s.id}`} aria-hidden className="mx-0.5 h-3.5 w-px bg-slate-300" />] : []),
                <span
                  key={s.id}
                  className={`rounded-md border px-1.5 py-0.5 text-[11px] ${
                    on.includes(s.id)
                      ? "border-slate-300 text-slate-600"
                      : "border-slate-200 text-slate-300"
                  }`}
                >
                  {s.name}
                </span>,
              ])}
            </span>
            <span className="shrink-0 text-[11px] text-slate-400">
              {on.length}/{m.subfunctions.length}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
