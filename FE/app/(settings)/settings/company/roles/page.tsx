"use client";

import { RoleEditor } from "@/components/settings/company/role-editor";
import { RolesDenied } from "@/components/settings/company/roles-denied";
import { canManageRoles, useWorkspaceMe } from "@/lib/workspace-me";

/**
 * 회사 › 권한 관리 — **소유자 · 관리자 전용**.
 *
 * 내비에서도 감추지만(`settings-nav.tsx`) 주소로 직접 들어올 수 있어서 여기서도 막는다.
 * 판정은 서버가 준 내 자격(`GET /api/workspace/me`)으로 한다. **보안 경계는 아니다** — 실제 차단은
 * BE 가 요청마다 직급으로 한다(`TenantContext`). 화면만 믿으면 요청을 직접 만들어 보내는 것을 못 막는다.
 *
 * 자격을 받기 전에는 거부 화면을 보이지 않는다 — 소유자가 들어왔는데 잠깐 「볼 수 없는 화면」이 스치면
 * 고장으로 보인다. 제목만 두고 기다린다.
 */
export default function Page() {
  const { me, status } = useWorkspaceMe();

  if (status === "idle" || status === "loading") {
    return <h1 className="text-xl font-bold tracking-tight text-slate-900">권한 관리</h1>;
  }
  if (!canManageRoles(me)) return <RolesDenied />;

  return (
    <>
      <h1 className="text-xl font-bold tracking-tight text-slate-900">권한 관리</h1>
      <RoleEditor />
    </>
  );
}
