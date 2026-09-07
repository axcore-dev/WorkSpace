/**
 * 「내가 남에게 무엇을 줄 수 있는가」 — 위임 범위 판정.
 *
 * 이 파일은 **import를 갖지 않는다** — `node --test`가 타입 스트립으로 그대로 실행한다.
 *
 * **이 판정은 보안 경계가 아니다.** 화면에서 고를 수 없게 할 뿐이고, 실제 차단은 BE가
 * 세션의 직급으로 한다. 화면만 믿으면 요청을 직접 만들어 보내는 것을 못 막는다.
 */

import type { DataScope, RoleDef } from "./roles.ts";

/** 넓은 것부터 — 자기보다 넓은 범위는 남에게 줄 수 없다 */
const SCOPE_RANK: Record<DataScope, number> = { all: 2, dept: 1, own: 0 };

/**
 * 권한 관리를 열 수 있는가 — **소유자 전용**이다.
 *
 * 직급과 권한을 정하는 자리라, 그걸 고칠 수 있는 사람은 자기 권한도 마음대로 올릴 수 있다.
 * 회사를 대표하는 한 자리에만 둔다.
 */
export function canManageRoles(me: RoleDef | null): boolean {
  return !!me && me.system && me.dept === null;
}

/**
 * 이 직급을 남에게 줄 수 있는가.
 *
 * 넷을 다 통과해야 한다:
 * 1. 내가 위임 권한을 갖고 있어야 한다 (`canDelegateInvite`)
 * 2. **시스템 직급은 못 준다** — 소유자는 회사에 하나다
 * 3. 대상의 권한이 **내 권한 안에** 있어야 한다. 내가 못 보는 탭을 남에게 열어 줄 수 없다
 * 4. 대상의 데이터 범위가 내 범위보다 넓으면 안 된다 — 부서 것만 보는 사람이
 *    전체를 보는 직급을 만들어 낼 수는 없다
 */
export function canGrantRank(me: RoleDef | null, target: RoleDef): boolean {
  if (!me) return false;
  if (!me.canDelegateInvite) return false;
  if (target.system) return false;
  if (SCOPE_RANK[target.scope] > SCOPE_RANK[me.scope]) return false;
  // 금액 열은 따로 본다 — 권한 목록에 없는 별개 스위치라 3번에 안 걸린다
  if (target.showAmounts && !me.showAmounts) return false;
  return target.perms.every((p) => me.perms.includes(p));
}

/** 초대할 때 고를 수 있는 직급 */
export function grantableRanks(me: RoleDef | null, all: RoleDef[]): RoleDef[] {
  return all.filter((r) => canGrantRank(me, r));
}

/**
 * 부서를 고를 수 있는가.
 *
 * **전체 범위(`all`)일 때만 고를 수 있다.** 부서 범위인 사람이 남의 부서로 사람을 부르면
 * 자기가 볼 수 없는 곳에 구성원을 만드는 셈이라, 부른 뒤에 확인도 못 한다.
 * 고를 수 없으면 자기 부서로 고정된다.
 */
export function canChooseDept(me: RoleDef | null): boolean {
  return me?.scope === "all";
}

/**
 * 초대 화면에서 쓸 부서 목록.
 *
 * 고를 수 있으면 전부, 아니면 **자기 부서 하나**다. 하나뿐이면 화면은 그걸 고정으로 보인다.
 */
export function invitableDepts(
  me: RoleDef | null,
  all: readonly string[],
): string[] {
  if (canChooseDept(me)) return [...all];
  return me?.dept ? [me.dept] : [];
}
