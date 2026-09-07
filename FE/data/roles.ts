/**
 * 직급 순수 로직 — 부서별 묶기, 요약 문자열, 삭제 가능 판정, 구성원 수.
 *
 * 이 파일은 **import를 갖지 않는다.** `node --test`가 타입 스트립으로 `.ts`를 그대로
 * 실행하는데 `@/` 경로 별칭을 해석하지 못한다. 데이터는 `data/org.ts`가 갖고, 이 파일은
 * 그 데이터를 받아 계산만 한다.
 *
 * **이 로직은 보안 경계가 아니다.** 화면 표시용이고, 실제 접근 차단은 BE 세션의
 * 직급 검사에서 한다.
 */

export type DataScope = "all" | "dept" | "own";

/**
 * 워크스페이스 단위 권한 — 기능(모듈 서브기능)과 별개로 회사 자체를 다루는 것들.
 *
 * 기능 권한은 `data/modules.ts`의 서브기능 27개에서 나온다. 둘을 합쳐 한 목록으로 보인다.
 * id에 `ws:` 접두어를 붙여 서브기능 id와 섞이지 않게 한다.
 */
export const WORKSPACE_PERMS: { id: string; name: string }[] = [
  { id: "ws:info", name: "회사 정보 관리" },
  { id: "ws:members", name: "구성원 정보 관리" },
  { id: "ws:integrations", name: "데이터 연동" },
  { id: "ws:delete", name: "회사 삭제" },
];

export type RoleDef = {
  id: string;
  name: string;
  /** 시스템 직급 — 권한을 바꾸거나 지울 수 없다 */
  system: boolean;
  /**
   * 소속 부서. `null`이면 어느 부서에도 속하지 않는다.
   *
   * 소유자가 그렇다 — 회사 전체를 갖는 자리라 부서로 묶이지 않는다. 대신 누구나 소유자가
   * 될 수 있다(수정요청 v12).
   */
  dept: string | null;
  /** 목록에 한 줄로 붙는 설명 */
  desc?: string;
  /** 켜진 권한 id — 서브기능 id 또는 `ws:*` */
  perms: string[];
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
 * 직급 목록에 한 줄로 보일 요약.
 *
 * 설명이 있으면 그걸 쓴다 — 사람이 쓴 문장이 세어 놓은 숫자보다 낫다.
 * 없으면 켜진 권한 수와 데이터 범위를 적는다.
 */
export function summarizeRole(role: RoleDef, total: number): string {
  if (role.desc) return role.desc;
  const scope = SCOPE_LABEL[role.scope];
  if (role.perms.length === 0) return `권한 없음 · ${scope}`;
  if (role.perms.length >= total) return `모든 권한 · ${scope}`;
  return `권한 ${role.perms.length}/${total} · ${scope}`;
}

/** 시스템 직급과 마지막 남은 직급은 지울 수 없다 */
export function canDeleteRole(role: RoleDef, all: RoleDef[]): boolean {
  if (role.system) return false;
  if (all.length <= 1) return false;
  return true;
}

/** 직급 이름으로 구성원 수를 센다 — `USERS_ROLES[].role`이 문자열이라 이름으로 맞춘다 */
export function roleMemberCount(roleName: string, users: { role: string }[]): number {
  return users.filter((u) => u.role === roleName).length;
}

/**
 * 부서별로 직급을 묶는다 — 화면 왼쪽 목록이 이 순서로 그린다.
 *
 * 부서가 없는 직급(소유자)이 **맨 위**에 온다. 그 다음이 `depts` 순서고, 직급이 없는
 * 부서도 남긴다 — 부서를 만들고 직급을 아직 안 만든 상태가 보여야 「직급 만들기」를
 * 어디에 눌러야 하는지 안다.
 *
 * `depts`에 없는 부서에 붙은 직급은 목록 끝에 따로 모은다. 버리면 화면에서 사라져서
 * 지울 수도 고칠 수도 없는 직급이 된다.
 */
export function groupRolesByDept(
  roles: RoleDef[],
  depts: readonly string[],
): { dept: string | null; roles: RoleDef[] }[] {
  const out: { dept: string | null; roles: RoleDef[] }[] = [];

  const loose = roles.filter((r) => r.dept === null);
  if (loose.length > 0) out.push({ dept: null, roles: loose });

  for (const d of depts) {
    out.push({ dept: d, roles: roles.filter((r) => r.dept === d) });
  }

  const known = new Set(depts);
  for (const orphan of new Set(
    roles.map((r) => r.dept).filter((d): d is string => d !== null && !known.has(d)),
  )) {
    out.push({ dept: orphan, roles: roles.filter((r) => r.dept === orphan) });
  }

  return out;
}
