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
  /** **지금 로그인한 사람이** 이 직급을 남에게 줄 수 있는가(초대 · 소속 변경). 소유자 직급은 아무도 못 준다 */
  assignable: boolean;
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

/* ─────────────────────── 구성원 · 초대 · 초대 링크 (초대 관리) ─────────────────────── */

export type MemberDto = {
  id: number;
  name: string;
  email: string;
  roleId: number | null;
  /** `owner` 면 소속을 바꿀 수 없다 */
  roleCode: string | null;
  roleName: string | null;
  departmentId: number | null;
  departmentName: string | null;
};

export type PendingInvitationDto = {
  id: string;
  email: string;
  roleId: number | null;
  roleName: string | null;
  departmentId: number | null;
  departmentName: string | null;
  createdAt: string;
  expiresAt: string;
};

export type InviteResultDto = {
  results: { email: string; status: "sent" | "skipped"; reason: string | null }[];
};

export type InviteLinkDto = {
  id: string;
  /** 만든 직후의 응답에만 있다. 목록에서는 null — 서버는 해시만 저장한다 */
  url: string | null;
  roleId: number;
  roleName: string | null;
  departmentId: number | null;
  departmentName: string | null;
  maxUses: number;
  useCount: number;
  expiresAt: string;
  revokedAt: string | null;
  active: boolean;
};

export const getMembers = async () => (await apiGet<MemberDto[]>(`${BASE}/members`)) ?? [];

export const updateMember = async (id: number, input: { roleId: number; departmentId: number | null }) =>
  must(await apiPatch<MemberDto>(`${BASE}/members/${id}`, input));

export const getInvitations = async () =>
  (await apiGet<PendingInvitationDto[]>(`${BASE}/invitations`)) ?? [];

/** 여러 명을 같은 직급·부서로. 건너뛴 주소는 이유와 함께 돌아온다 */
export const inviteMembers = async (input: { emails: string[]; roleId: number; departmentId: number | null }) =>
  must(await apiPostAuthed<InviteResultDto>(`${BASE}/invitations`, input));

export const resendInvitation = async (id: string) =>
  must(await apiPostAuthed<PendingInvitationDto>(`${BASE}/invitations/${id}/resend`));

export const revokeInvitation = (id: string) => apiDelete<void>(`${BASE}/invitations/${id}`);

export const getInviteLinks = async () => (await apiGet<InviteLinkDto[]>(`${BASE}/invite-links`)) ?? [];

export const createInviteLink = async (input: {
  roleId: number;
  departmentId: number | null;
  maxUses: number;
  expiresInDays: number;
}) => must(await apiPostAuthed<InviteLinkDto>(`${BASE}/invite-links`, input));

export const revokeInviteLink = (id: string) => apiDelete<void>(`${BASE}/invite-links/${id}`);

/* ─────────────────────────────── 연동 ─────────────────────────────── */

/** 외부 시스템 한 줄 — 운영팀이 등록한다. 화면에서는 읽기만 한다 */
export type ExternalSystemDto = {
  id: number;
  name: string;
  vendor: string;
  kind: string;
  status: "ok" | "delayed" | "down";
};

/** 연결된 제공자 계정. 토큰은 절대 오지 않는다 — 이름과 상태만 */
export type ConnectorAccountDto = {
  provider: "google" | "slack" | "notion";
  /** 구글은 이메일, 슬랙은 팀 이름. 못 받았으면 null */
  externalAccount: string | null;
  /** 토큰 갱신이 거절됐다. 다시 연결해야 한다 */
  needsReconnect: boolean;
  connectedAt: string;
};

/** 한 번 연결해 둔 앱. 꺼도 목록에 남는다 — 다시 켤 때 재인증이 없다 */
export type ConnectorRegisteredDto = { slug: string; enabled: boolean };

export type ConnectorsDto = {
  systems: ExternalSystemDto[];
  /** 지금 켜져 있어 쓸 수 있는 외부 서비스 slug. AI 대화의 앱 칩이 본다. 카탈로그 순서 */
  services: string[];
  /** 등록된 앱 전부와 켜짐 여부. 연동 화면의 목록이 본다 */
  registered: ConnectorRegisteredDto[];
  accounts: ConnectorAccountDto[];
  /** 내가 연결·해제할 수 있는가 (`can_manage_integrations`) */
  editable: boolean;
};

export const getConnectors = async () => must(await apiGet<ConnectorsDto>(`${BASE}/connectors`));

/**
 * 연결 1단계 — 제공자 동의 화면 주소. 브라우저를 이 주소로 보낸다. 돌아오는 곳은 소셜 로그인과 같은 콜백이고
 * state 의 `cn.` 접두어로 갈린다(`app/(auth)/oauth/callback/[provider]`).
 */
export const startConnectorAuth = async (slug: string) =>
  must(
    await apiPostAuthed<{ url: string }>(
      `${BASE}/connectors/services/${encodeURIComponent(slug)}/authorize`,
    ),
  );

/** 연결 2단계 — 제공자가 돌려준 code·state 를 서버에 넘긴다. 바뀐 전체가 돌아온다 */
export const completeConnectorAuth = async (slug: string, code: string, state: string) =>
  must(
    await apiPostAuthed<ConnectorsDto>(
      `${BASE}/connectors/services/${encodeURIComponent(slug)}/callback`,
      { code, state },
    ),
  );

/** 켜기/끄기 — 등록은 그대로, 깃발만. 켤 수 없으면(계정 없음 · 권한 부족) 409 라 화면이 OAuth 로 넘어간다 */
export const setConnectorEnabled = async (slug: string, enabled: boolean) =>
  must(
    await apiPut<ConnectorsDto>(`${BASE}/connectors/services/${encodeURIComponent(slug)}`, { enabled }),
  );

/** 연결 해제 — 목록에서 지운다. 같은 계정을 쓰는 앱이 하나도 남지 않으면 제공자 쪽 토큰도 회수된다 */
export const disconnectConnector = async (slug: string) =>
  must(await apiDelete<ConnectorsDto>(`${BASE}/connectors/services/${encodeURIComponent(slug)}`));
