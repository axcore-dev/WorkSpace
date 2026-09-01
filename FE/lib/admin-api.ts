/**
 * 운영자 콘솔 ↔ BE 연결.
 *
 * BE 의 이름과 화면의 이름이 다르다(`name`↔`company`, `operatorName`↔`operator`). 그 차이를
 * 화면 곳곳에서 흡수하면 같은 변환이 여러 벌 생기고 한쪽만 고쳐진다. 변환을 여기 한 곳에 모아
 * 두고, 화면은 `data/admin.ts` 의 타입만 알면 되게 한다.
 *
 * 상태 어휘는 BE 가 이미 화면 쪽으로 맞춰 준다(`pending`·`active`·`suspended`). 해지된 회사는
 * 기본 목록에서 빠지고 `status=terminated` 로만 조회된다.
 */
import { apiDelete, apiGet, apiPostAuthed, apiPut } from "./api";
import type { AdminWorkspace, AuditEntry, Contacts, Plan, WsStatus } from "@/data/admin";

/* ────────────────────────── BE 응답 형태 ────────────────────────── */

/** Spring `Page<T>` 중 화면이 쓰는 부분만 */
export type Page<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

export type WorkspaceSummaryDto = {
  id: number;
  name: string;
  bizNumber: string;
  plan: string;
  status: string;
  schemaName: string | null;
  operatorName: string | null;
  linkSentAt: string | null;
  linkOpened: boolean;
  memberCount: number;
  systemCount: number;
  lastActiveAt: string | null;
  createdAt: string;
};

export type WorkspaceMemberDto = {
  name: string | null;
  email: string;
  role: string | null;
  status: string;
  invitedAt: string | null;
  lastActiveAt: string | null;
};

export type WorkspaceDto = {
  id: number;
  name: string;
  bizNumber: string;
  corpNumber: string | null;
  ceoName: string | null;
  bizType: string | null;
  bizItem: string | null;
  address: string | null;
  website: string | null;
  taxEmail: string | null;
  plan: string;
  status: string;
  schemaName: string | null;
  schemaVersion: string | null;
  operatorName: string | null;
  memo: string | null;
  contacts: {
    linkName: string | null;
    linkEmail: string | null;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    ccEmails: string[];
  };
  sites: unknown[];
  members: WorkspaceMemberDto[];
  usage: {
    storageGb: number;
    storageLimitGb: number;
    queries: number;
    queryLimit: number;
    syncs: number;
    syncLimit: number | null;
  };
  invoices: unknown[];
  systems: unknown[];
  lastActiveAt: string | null;
  linkSentAt: string | null;
  linkOpenedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InvitationDto = {
  id: string;
  email: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  openedAt: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

/** 발급 응답. `link` 는 이때만 나온다 — 목록에는 없다 */
export type InvitationIssuedDto = { link: string; invitation: InvitationDto };

export type AuditLogDto = {
  id: number;
  occurredAt: string;
  actorName: string;
  action: string;
  targetSchema: string | null;
  targetName: string | null;
  detail: string | null;
};

/* ────────────────────────── 표시용 변환 ────────────────────────── */

/** "2026-09-01" — 보는 사람의 시간대로 맞춘다. 서버가 문자열로 만들면 시차가 어긋난다 */
export function toDateText(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("sv-SE");
}

/** "2026-09-01 14:20" — 감사 목록이 문자열 비교로 정렬하므로 고정 폭이어야 한다 */
export function toDateTimeText(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("sv-SE")} ${d.toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/** "2시간 전" — 목록의 마지막 활동 칸 */
export function toRelativeText(iso: string | null): string {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";
  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return `${Math.floor(days / 30)}개월 전`;
}

/** BE 는 하이픈 없이 10자리로 들고 있고 화면은 000-00-00000 으로 보여 준다 */
export function withBizHyphen(digits: string): string {
  const d = (digits ?? "").replace(/\D/g, "");
  if (d.length !== 10) return digits ?? "";
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

/** 법인등록번호 000000-0000000 */
export function withCorpHyphen(digits: string | null): string {
  const d = (digits ?? "").replace(/\D/g, "");
  if (d.length !== 13) return digits ?? "";
  return `${d.slice(0, 6)}-${d.slice(6)}`;
}

/**
 * 상태 어휘.
 *
 * BE 가 이미 화면 값으로 내보내지만, 모르는 값이 오면 「대기중」으로 떨어뜨린다. 화면이
 * `WS_STATUS_LABEL[status]` 로 바로 인덱싱하기 때문에 없는 키가 들어오면 라벨이 undefined 가
 * 되고 배지가 빈칸으로 렌더된다.
 */
export function toWsStatus(raw: string): WsStatus {
  return raw === "active" || raw === "suspended" || raw === "pending" ? raw : "pending";
}

/**
 * 요금제.
 *
 * BE 는 자유 문자열이라 화면이 모르는 값이 올 수 있다. 그대로 넘기면 `estimateAmount` 의
 * 기본료 표에서 undefined 가 나와 예상 금액이 NaN 이 된다. 모르는 값은 가장 낮은 등급으로
 * 떨어뜨리고, 표시 자체는 원래 값을 쓰고 싶다면 이 함수를 거치지 않은 값을 따로 들면 된다.
 */
export function toPlan(raw: string): Plan {
  return raw === "Enterprise" || raw === "Growth" || raw === "Starter" ? raw : "Starter";
}

function toContacts(dto: WorkspaceDto["contacts"]): Contacts {
  return {
    contact: {
      // 접속 링크 담당과 연락 담당을 한 명으로 합쳤다(v10). BE 는 두 칸을 아직 들고 있어
      // 채워진 쪽을 쓴다 — 옛 데이터가 linkEmail 에만 있는 경우가 있다.
      name: dto.contactName ?? dto.linkName ?? "",
      email: dto.contactEmail ?? dto.linkEmail ?? "",
      phone: dto.contactPhone ?? "",
    },
    cc: dto.ccEmails ?? [],
  };
}

/** 목록 한 줄. 화면이 쓰는 것만 담는다 — 상세를 부르지 않고도 표를 그릴 수 있어야 한다 */
export type AdminWorkspaceRow = {
  schemaName: string;
  company: string;
  bizNumber: string;
  status: WsStatus;
  plan: Plan;
  memberCount: number;
  systemCount: number;
  lastActive: string;
  createdAt: string;
};

export function toRow(dto: WorkspaceSummaryDto): AdminWorkspaceRow {
  return {
    // 개설 전이면 스키마가 없다. 목록 링크가 깨지지 않게 id 로 대신한다.
    schemaName: dto.schemaName ?? `#${dto.id}`,
    company: dto.name,
    bizNumber: withBizHyphen(dto.bizNumber),
    status: toWsStatus(dto.status),
    plan: toPlan(dto.plan),
    memberCount: dto.memberCount,
    systemCount: dto.systemCount,
    lastActive: toRelativeText(dto.lastActiveAt),
    createdAt: toDateText(dto.createdAt),
  };
}

/** 상세. `data/admin.ts` 의 `AdminWorkspace` 를 그대로 채운다 */
export function toAdminWorkspace(dto: WorkspaceDto): AdminWorkspace {
  return {
    schemaName: dto.schemaName ?? `#${dto.id}`,
    company: dto.name,
    bizNumber: withBizHyphen(dto.bizNumber),
    corpNumber: withCorpHyphen(dto.corpNumber),
    bizType: dto.bizType ?? "",
    bizItem: dto.bizItem ?? "",
    address: dto.address ?? "",
    website: dto.website ?? "",
    status: toWsStatus(dto.status),
    plan: toPlan(dto.plan),
    createdAt: toDateText(dto.createdAt),
    operator: dto.operatorName ?? "—",
    lastActive: toRelativeText(dto.lastActiveAt),
    taxEmail: dto.taxEmail ?? "",
    memo: dto.memo ?? "",
    contacts: toContacts(dto.contacts),
    // 연동·매핑·청구는 아직 만드는 곳이 없다. BE 도 빈 배열을 준다 — 화면은 「미연결」과
    // 「아직 청구 내역이 없어요」로 정상 동작한다.
    systems: [],
    mappings: [],
    members: dto.members.map((m) => ({
      name: m.name,
      email: m.email,
      role: m.role ?? "—",
      state: m.status === "active" ? "active" : "pending",
      invitedAt: toDateText(m.invitedAt),
      lastSeen: toRelativeText(m.lastActiveAt),
    })),
    usage: {
      storageGb: dto.usage.storageGb,
      storageLimitGb: dto.usage.storageLimitGb,
      queries: dto.usage.queries,
      queryLimit: dto.usage.queryLimit,
      syncs: dto.usage.syncs,
      syncLimit: dto.usage.syncLimit,
    },
    invoices: [],
  };
}

export function toAuditEntry(dto: AuditLogDto): AuditEntry {
  return {
    at: toDateTimeText(dto.occurredAt),
    operator: dto.actorName,
    action: dto.action as AuditEntry["action"],
    targetSchema: dto.targetSchema ?? "—",
    targetName: dto.targetName ?? "—",
    detail: dto.detail ?? "—",
  };
}

/* ────────────────────────── 호출 ────────────────────────── */

const BASE = "/api/admin/workspaces";

function query(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export type ListParams = {
  keyword?: string;
  /** 비우면 해지를 뺀 전부. `terminated` 를 주면 해지된 회사만 */
  status?: WsStatus | "terminated";
  page?: number;
  size?: number;
};

export async function listWorkspaces(params: ListParams = {}) {
  const page = await apiGet<Page<WorkspaceSummaryDto>>(BASE + query(params));
  return {
    rows: (page?.content ?? []).map(toRow),
    total: page?.totalElements ?? 0,
    totalPages: page?.totalPages ?? 0,
  };
}

export async function getWorkspace(id: number) {
  const dto = await apiGet<WorkspaceDto>(`${BASE}/${id}`);
  return dto ? toAdminWorkspace(dto) : null;
}

/** 개설 폼이 보내는 값. BE 는 사업자번호를 하이픈 없이 받는다 */
export type CreateWorkspaceInput = {
  name: string;
  bizNumber: string;
  corpNumber?: string;
  bizType?: string;
  bizItem?: string;
  address?: string;
  website?: string;
  taxEmail?: string;
  plan?: string;
  operatorName?: string;
  memo?: string;
  contacts?: {
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    ccEmails?: string[];
  };
};

const digitsOnly = (v: string | undefined) => (v ? v.replace(/\D/g, "") : undefined);

export async function createWorkspace(input: CreateWorkspaceInput) {
  const dto = await apiPostAuthed<WorkspaceDto>(BASE, {
    ...input,
    bizNumber: digitsOnly(input.bizNumber),
    corpNumber: digitsOnly(input.corpNumber),
  });
  return dto ? toAdminWorkspace(dto) : null;
}

/** 수정은 전체 교체다. 화면이 상세 폼 전체를 들고 저장을 누르므로 PUT 이다 */
export async function updateWorkspace(id: number, input: Omit<CreateWorkspaceInput, "bizNumber">) {
  const dto = await apiPut<WorkspaceDto>(`${BASE}/${id}`, {
    ...input,
    corpNumber: digitsOnly(input.corpNumber),
  });
  return dto ? toAdminWorkspace(dto) : null;
}

export const deactivateWorkspace = (id: number) =>
  apiPostAuthed<WorkspaceDto>(`${BASE}/${id}/suspend`);

export const activateWorkspace = (id: number) =>
  apiPostAuthed<WorkspaceDto>(`${BASE}/${id}/resume`);

/**
 * 접속 링크 발급.
 *
 * 누를 때마다 새 링크가 나가고 이전 링크는 그 자리에서 죽는다. 응답의 `link` 를 복사해
 * 담당자에게 보내면 된다 — 시스템은 메일을 보내지 않는다.
 */
export const issueInviteLink = (id: number, email?: string) =>
  apiPostAuthed<InvitationIssuedDto>(`${BASE}/${id}/invitations`, email ? { email } : {});

export const listInvitations = (id: number) =>
  apiGet<InvitationDto[]>(`${BASE}/${id}/invitations`);

export const revokeInvitation = (id: number, invitationId: string) =>
  apiDelete<InvitationDto>(`${BASE}/${id}/invitations/${invitationId}`);

/** 링크를 다른 경로로 보냈다는 기록. 발급과 별개다 */
export const markLinkSent = (id: number) => apiPostAuthed<WorkspaceDto>(`${BASE}/${id}/link-sent`);

export async function listAuditLogs(params: { workspaceId?: number; page?: number; size?: number } = {}) {
  const page = await apiGet<Page<AuditLogDto>>("/api/admin/audit-logs" + query(params));
  return {
    entries: (page?.content ?? []).map(toAuditEntry),
    total: page?.totalElements ?? 0,
    totalPages: page?.totalPages ?? 0,
  };
}

/** 운영자가 고객 워크스페이스 안으로 들어간다. 소속 없이도 열리고, 감사에 남는다 */
export const enterWorkspace = (id: number) =>
  apiPostAuthed<{ next: string; accessToken: string; accessTokenExpiresAt: string }>(
    `/api/auth/workspaces/${id}/select`,
  );
