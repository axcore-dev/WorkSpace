/**
 * 역할 순수 로직 — 요약 문자열, 삭제 가능 판정, 구성원 수.
 *
 * 이 파일은 **import를 갖지 않는다.** `node --test`가 타입 스트립으로 `.ts`를 그대로
 * 실행하는데 `@/` 경로 별칭을 해석하지 못한다. 데이터는 `data/org.ts`가 갖고, 이 파일은
 * 그 데이터를 받아 계산만 한다.
 *
 * **이 로직은 보안 경계가 아니다.** 화면 표시용 요약이고, 실제 접근 차단은 BE 세션의
 * 역할 검사에서 한다.
 */

export type ModulePerm = "none" | "read" | "write";
export type DataScope = "all" | "dept" | "own";

export type RoleDef = {
  id: string;
  name: string;
  /** 시스템 역할 — 권한을 바꾸거나 지울 수 없다 */
  system: boolean;
  /** 모듈 슬러그 → 권한 */
  perms: Record<string, ModulePerm>;
  scope: DataScope;
  /** 단가·원가·매출 열을 볼 수 있는지 */
  showAmounts: boolean;
  /** 자기 권한 안에서 다른 사람을 초대할 수 있는지 */
  canDelegateInvite: boolean;
};

const SCOPE_LABEL: Record<DataScope, string> = {
  all: "전체 데이터",
  dept: "부서 데이터",
  own: "본인 데이터",
};

/**
 * 역할 목록에 한 줄로 보일 요약.
 *
 * 쓰기 권한이 있는 모듈을 먼저 적고, 없으면 읽기만이라고 적는다.
 * `moduleNames`에 없는 슬러그는 건너뛴다 — 모듈이 지워졌는데 권한 맵에 남아 있을 수 있고,
 * 그대로 두면 요약에 `undefined`가 낀다.
 */
export function summarizeRole(role: RoleDef, moduleNames: Record<string, string>): string {
  const named = (slug: string) => moduleNames[slug];
  const writes = Object.entries(role.perms)
    .filter(([slug, p]) => p === "write" && named(slug))
    .map(([slug]) => named(slug));
  const reads = Object.entries(role.perms).filter(([slug, p]) => p === "read" && named(slug));

  const scope = SCOPE_LABEL[role.scope];

  if (writes.length > 0) return `${writes.join("·")} 쓰기 · ${scope}`;
  if (reads.length > 0) return `읽기만 · ${scope}`;
  return `권한 없음 · ${scope}`;
}

/** 시스템 역할과 마지막 남은 역할은 지울 수 없다 */
export function canDeleteRole(role: RoleDef, all: RoleDef[]): boolean {
  if (role.system) return false;
  if (all.length <= 1) return false;
  return true;
}

/** 역할 이름으로 구성원 수를 센다 — `USERS_ROLES[].role`이 문자열이라 이름으로 맞춘다 */
export function roleMemberCount(roleName: string, users: { role: string }[]): number {
  return users.filter((u) => u.role === roleName).length;
}
