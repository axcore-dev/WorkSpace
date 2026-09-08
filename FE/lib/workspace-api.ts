/**
 * 고객 워크스페이스 설정 API (`/api/workspace/**`) 의 클라이언트 절반.
 *
 * 운영자 콘솔의 `lib/admin-api.ts` 와 같은 역할이다 — BE 응답 모양을 한 곳에서 받아 화면 타입으로
 * 바꾼다. 대상은 항상 **지금 고른 회사**(access 토큰의 `wsid`)라 회사 id 를 넘기지 않는다.
 *
 * 응답의 `member.admin` 같은 값은 화면이 무엇을 잠글지 정하는 데만 쓴다. **보안 경계는 아니다** —
 * 잠근 버튼을 우회해 요청을 보내면 BE 의 `TenantContext` 가 403 으로 막는다.
 */
import { apiDelete, apiGet, apiPatch, apiPostAuthed, apiPut } from "./api";

const BASE = "/api/workspace";

/** 이 API 들은 204 를 내지 않는다 — null 은 오지 않으므로 타입만 좁힌다 */
const must = <T,>(v: T | null) => v as T;

export type DataScope = "all" | "dept" | "own";

/** 직급 하나의 권한 묶음. `tabs` 는 회사가 끈 기능의 탭도 담는다 — "가졌나" 의 값이다. */
export type PermissionsDto = {
  tabs: string[];
  admin: boolean;
  canInvite: boolean;
  canManageIntegrations: boolean;
  dataScope: DataScope;
  showAmounts: boolean;
};

/** 기능 관리의 모듈 한 칸. `enabled` 는 탭이 하나라도 켜져 있는지에서 파생된 값이다. */
export type FeatureModuleDto = {
  module: string;
  enabled: boolean;
  tabs: Record<string, boolean>;
};

export type WorkspaceMeDto = {
  workspaceId: number;
  workspaceName: string;
  member: {
    id: number | null;
    roleCode: string;
    roleName: string;
    admin: boolean;
    owner: boolean;
    canInvite: boolean;
    departmentId: number | null;
    departmentName: string | null;
    title: string | null;
    internalAdmin: boolean;
  };
  /** 내가 쓸 수 있는 모듈 slug — 회사가 켠 것 ∩ 직급·개인 권한 */
  modules: string[];
  /** 내 직급의 권한. 관리자가 다른 직급을 고칠 때 "내 권한 안인가" 를 미리 보여 주는 데 쓴다 */
  permissions: PermissionsDto;
  /** 회사가 켠 기능 탭 전부 */
  features: FeatureModuleDto[];
};

export const getWorkspaceMe = async () => must(await apiGet<WorkspaceMeDto>(`${BASE}/me`));

export async function getFeatures(): Promise<FeatureModuleDto[]> {
  return (await apiGet<FeatureModuleDto[]>(`${BASE}/features`)) ?? [];
}

/**
 * 한 모듈의 탭 상태 저장. 보낸 탭만 바뀐다 — 모듈 전체를 켜고 끄려면 그 모듈의 탭을 전부 같은 값으로 보낸다.
 * 관리자가 아니면 403 (`FORBIDDEN`).
 */
export async function putModuleFeatures(
  module: string,
  tabs: Record<string, boolean>,
): Promise<FeatureModuleDto> {
  return must(await apiPut<FeatureModuleDto>(`${BASE}/features/${encodeURIComponent(module)}`, { tabs }));
}

/* ─────────────────────── 부서 · 직급 (권한 관리) ─────────────────────── */

export type DepartmentDto = {
  id: number;
  name: string;
  /** 이 부서에 속한 직급 수. 0 이어야 지울 수 있다 */
  roleCount: number;
};

export type RoleDto = {
  id: number;
  code: string;
  name: string;
  /** 고정 직급(owner · member). 이름·부서를 바꾸거나 지울 수 없다 */
  system: boolean;
  /** 소유자는 null(「전사」) */
  departmentId: number | null;
  departmentName: string | null;
  admin: boolean;
  canInvite: boolean;
  canManageIntegrations: boolean;
  dataScope: DataScope;
  showAmounts: boolean;
  /** 볼 수 있는 기능 탭 id. 소유자는 카탈로그 전부 */
  tabs: string[];
  memberCount: number;
  /**
   * **지금 로그인한 사람이** 이 직급을 고칠 수 있는가. 서버가 규칙(소유자 직급 불가 · 관리자는 자기 권한 안 ·
   * 자기 직급 불가)을 미리 계산해 준다. 화면은 이 값으로 잠근다 — 보안 경계는 서버의 PUT 검사다.
   */
  editable: boolean;
};

/** 직급 전체 저장 본문 — 화면의 「저장하기」 한 번 */
export type RoleUpdateInput = {
  name: string;
  departmentId: number | null;
  admin: boolean;
  canInvite: boolean;
  canManageIntegrations: boolean;
  dataScope: DataScope;
  showAmounts: boolean;
  tabs: string[];
};

export const getDepartments = async () => (await apiGet<DepartmentDto[]>(`${BASE}/departments`)) ?? [];

export const createDepartment = async (name: string) =>
  must(await apiPostAuthed<DepartmentDto>(`${BASE}/departments`, { name }));

export const renameDepartment = async (id: number, name: string) =>
  must(await apiPatch<DepartmentDto>(`${BASE}/departments/${id}`, { name }));

/** 직급이 남아 있으면 `moveRolesTo` 가 필요하다. 없으면 409 `DEPARTMENT_NOT_EMPTY` */
export const deleteDepartment = (id: number, moveRolesTo?: number | null) =>
  apiDelete<void>(`${BASE}/departments/${id}${moveRolesTo ? `?moveRolesTo=${moveRolesTo}` : ""}`);

export const getRoles = async () => (await apiGet<RoleDto[]>(`${BASE}/roles`)) ?? [];

export const createRole = async (name: string, departmentId: number) =>
  must(await apiPostAuthed<RoleDto>(`${BASE}/roles`, { name, departmentId }));

export const updateRole = async (id: number, input: RoleUpdateInput) =>
  must(await apiPut<RoleDto>(`${BASE}/roles/${id}`, input));

/** 구성원이 있으면 `moveMembersTo` 가 필요하다. 없으면 409 `ROLE_HAS_MEMBERS` */
export const deleteRole = (id: number, moveMembersTo?: number | null) =>
  apiDelete<void>(`${BASE}/roles/${id}${moveMembersTo ? `?moveMembersTo=${moveMembersTo}` : ""}`);
