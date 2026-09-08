/**
 * 고객 워크스페이스 설정 API (`/api/workspace/**`) 의 클라이언트 절반.
 *
 * 운영자 콘솔의 `lib/admin-api.ts` 와 같은 역할이다 — BE 응답 모양을 한 곳에서 받아 화면 타입으로
 * 바꾼다. 대상은 항상 **지금 고른 회사**(access 토큰의 `wsid`)라 회사 id 를 넘기지 않는다.
 *
 * 응답의 `member.admin` 같은 값은 화면이 무엇을 잠글지 정하는 데만 쓴다. **보안 경계는 아니다** —
 * 잠근 버튼을 우회해 요청을 보내면 BE 의 `TenantContext` 가 403 으로 막는다.
 */
import { apiGet, apiPut } from "./api";

const BASE = "/api/workspace";

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
  /** 회사가 켠 기능 탭 전부 */
  features: FeatureModuleDto[];
};

export async function getWorkspaceMe(): Promise<WorkspaceMeDto> {
  const dto = await apiGet<WorkspaceMeDto>(`${BASE}/me`);
  if (!dto) throw new Error("빈 응답");
  return dto;
}

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
  const dto = await apiPut<FeatureModuleDto>(`${BASE}/features/${encodeURIComponent(module)}`, {
    tabs,
  });
  if (!dto) throw new Error("빈 응답");
  return dto;
}
