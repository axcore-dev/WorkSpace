import { RoleEditor } from "@/components/settings/company/role-editor";
import { RolesDenied } from "@/components/settings/company/roles-denied";
import { canManageRoles } from "@/data/grants";
import { currentRole } from "@/data/org";

/**
 * 회사 › 권한 관리 — **소유자 전용**.
 *
 * 내비에서도 감추지만(`settings-nav.tsx`) 주소로 직접 들어올 수 있어서 여기서도 막는다.
 * **보안 경계는 아니다** — 실제 차단은 BE가 세션의 직급으로 한다. 화면만 믿으면 요청을
 * 직접 만들어 보내는 것을 못 막는다.
 */
export default function Page() {
  if (!canManageRoles(currentRole())) return <RolesDenied />;

  return (
    <>
      <h1 className="text-xl font-bold tracking-tight text-slate-900">권한 관리</h1>
      <RoleEditor />
    </>
  );
}
