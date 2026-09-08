"use client";

import { useEffect, useState } from "react";
import {
  ActionRow,
  SettingsRow,
  SettingsRows,
} from "@/components/settings/settings-section";
import {
  DeptDeleteModal,
  NameModal,
  RankDeleteModal,
} from "@/components/settings/company/dept-rank-modals";
import { ICON_MAP, IconLock, IconPencil, IconPlus, IconTrash } from "@/components/icons";
import { useModules } from "@/components/module-provider";
import { Badge, Button, Segmented, Toast, Toggle } from "@/components/ui";
import { useToast } from "@/components/use-toast";
import { josa } from "@/data/ko";
import { DATA_SCOPES } from "@/data/org";
import { MODULES } from "@/data/modules";
import { WORKSPACE_PERMS } from "@/data/roles";
import type { DataScope } from "@/data/roles";
import { ApiRequestError } from "@/lib/api";
import {
  createDepartment,
  createRole,
  deleteDepartment,
  deleteRole,
  getDepartments,
  getRoles,
  renameDepartment,
  updateRole,
  type DepartmentDto,
  type RoleDto,
  type RoleUpdateInput,
} from "@/lib/workspace-api";
import { refreshWorkspaceMe } from "@/lib/workspace-me";

/** 부서에 속하지 않는 직급이 사는 자리 — 소유자 하나뿐이다. `departmentId === null` */
const NONE = -1;

type Dialog =
  | { kind: "newDept" }
  | { kind: "renameDept"; dept: DepartmentDto }
  | { kind: "delDept"; dept: DepartmentDto }
  | { kind: "newRank"; dept: DepartmentDto }
  | { kind: "renameRank"; role: RoleDto }
  | { kind: "delRank"; role: RoleDto }
  | null;

/**
 * 화면이 편집하는 직급의 모양. 서버 `RoleDto` 를 그대로 쓰되 회사 권한 두 개(`ws:*`)를 탭과 같은 목록(`perms`)에
 * 합쳐 둔다 — 토글 하나가 항목 하나이고, 저장할 때 다시 컬럼으로 나눈다(`toInput`).
 */
type Draft = {
  name: string;
  departmentId: number | null;
  perms: string[];
  scope: DataScope;
  showAmounts: boolean;
  canDelegateInvite: boolean;
};

function toDraft(r: RoleDto): Draft {
  return {
    name: r.name,
    departmentId: r.departmentId,
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

function toInput(d: Draft): RoleUpdateInput {
  return {
    name: d.name,
    departmentId: d.departmentId,
    admin: d.perms.includes("ws:settings"),
    canManageIntegrations: d.perms.includes("ws:integrations"),
    canInvite: d.canDelegateInvite,
    dataScope: d.scope,
    showAmounts: d.showAmounts,
    tabs: d.perms.filter((p) => !p.startsWith("ws:")),
  };
}

/** 토글 순서는 의미가 없다 — 정렬해 비교한다 */
const sameDraft = (a: Draft, b: Draft) =>
  JSON.stringify({ ...a, perms: [...a.perms].sort() }) === JSON.stringify({ ...b, perms: [...b.perms].sort() });

/** 탭 총 개수 — 카탈로그 상수 */
const TOTAL_TABS = MODULES.reduce((n, m) => n + m.subfunctions.length, 0);

/** BE 오류 문구를 그대로 토스트에. 없으면 기본 문구 */
function errorText(e: unknown, fallback: string) {
  if (e instanceof ApiRequestError && e.body.message) return e.body.message;
  return fallback;
}

/**
 * 회사 › 권한 관리 — **부서 · 직급 · 권한 세 열**.
 *
 * 「부서 만들기 → 직급 만들기 → 권한 선택」이 세 단계라 화면도 세 열이다. 왼쪽에서 고른 것이
 * 오른쪽을 정한다. 열마다 머리글·목록·만들기 버튼이 같은 자리에 있고, 이름 바꾸기와 지우기는
 * 줄에 커서를 올리면 나온다 — 늘 띄우면 아이콘이 열여덟 개가 된다.
 *
 * **원본은 서버다** (`/api/workspace/departments` · `/api/workspace/roles`, 테넌트 `departments` · `roles` ·
 * `role_module_grants`). 부서·직급 만들기·이름 바꾸기·지우기는 그 자리에서 저장되고, 권한(오른쪽 열)은
 * 「저장하기」로 한 번에 보낸다 — 토글 하나마다 요청을 보내면 관리자의 "자기 권한 안" 검사를 절반 상태로 받게 된다.
 *
 * **권한 = 탭 접근이다.** 서브기능은 곧 모듈 화면의 탭이고, 권한을 준다는 건 그 탭을 볼 수 있게 한다는 뜻이다.
 * 그래서 체크박스가 아니라 토글이고 모양이 기능 관리와 같다 — 저기는 "이 회사가 어떤 탭을 쓰나",
 * 여기는 "이 직급이 그중 어떤 탭을 보나"다.
 *
 * **워크스페이스에서 꺼 둔 기능은 여기서도 잠긴다** — 바꿀 수 없고 지금 값만 보인다. 서버는 그 탭을 "가진" 것으로
 * 저장해 두고, 실제 접근은 회사가 켠 것과의 교집합으로 계산한다. 기능을 다시 켜면 권한이 그대로 살아난다.
 *
 * **누가 무엇을 고칠 수 있는가**는 서버가 정하고 `RoleDto.editable` 로 알려 준다 — 소유자·구성원 직급은 고정,
 * 소유자는 나머지 전부, 관리자는 자기 권한 안에서 자기 직급 빼고. 화면은 그 값으로 잠근다.
 * **이 화면은 보안 경계가 아니다.** 실제 차단은 BE 의 PUT/DELETE 검사다.
 */
export function RoleEditor() {
  const [toast, showToast] = useToast();
  const [depts, setDepts] = useState<DepartmentDto[]>([]);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selDept, setSelDept] = useState<number | null>(null);
  const [selRank, setSelRank] = useState<number | null>(null);
  /**
   * 편집 중인 초안 — **어느 직급의 것인지와 함께** 둔다. 고른 직급이 바뀌면 키가 안 맞아 저절로 버려지고
   * 서버 값으로 돌아간다. effect 에서 setState 로 동기화하지 않는 이유는 그 한 프레임 동안 이전 직급의
   * 초안이 새 직급 이름 아래 보이기 때문이다.
   */
  const [edit, setEdit] = useState<{ roleId: number; draft: Draft } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);

  const { state } = useModules();

  async function reload() {
    const [d, r] = await Promise.all([getDepartments(), getRoles()]);
    setDepts(d);
    setRoles(r);
    return { d, r };
  }

  useEffect(() => {
    // 마운트 뒤 한 번 받는다. 첫 부서와 그 부서의 첫 직급을 골라 둔다 — 빈 오른쪽 열로 시작하지 않게
    async function load() {
      try {
        const { d, r } = await reload();
        const first = d[0];
        setSelDept(first ? first.id : NONE);
        setSelRank(r.find((x) => (first ? x.departmentId === first.id : x.departmentId === null))?.id ?? null);
      } catch (e) {
        showToast(errorText(e, "부서와 직급을 불러오지 못했어요"), "error");
      } finally {
        setLoaded(true);
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 때 한 번
  }, []);

  /** 고른 부서의 직급. 「전사」는 부서가 없는 직급(소유자)을 보여준다 */
  const rankList = roles.filter((r) => (selDept === NONE ? r.departmentId === null : r.departmentId === selDept));
  const role = roles.find((r) => r.id === selRank) ?? null;
  const saved = role ? toDraft(role) : null;
  /** 지금 직급의 초안. 고친 게 없으면 서버 값 그대로다 */
  const draft = role && edit?.roleId === role.id ? edit.draft : saved;
  const setDraft = (next: Draft | null) => setEdit(role && next ? { roleId: role.id, draft: next } : null);

  const locked = !role?.editable || saving;
  const dirty = !!draft && !!saved && !sameDraft(draft, saved);
  const onTabs = draft ? draft.perms.filter((p) => !p.startsWith("ws:")).length : 0;

  function pickDept(id: number) {
    setSelDept(id);
    const first = roles.find((r) => (id === NONE ? r.departmentId === null : r.departmentId === id));
    setSelRank(first?.id ?? null);
  }

  function patch(next: Partial<Draft>) {
    if (draft) setDraft({ ...draft, ...next });
  }

  function togglePerm(id: string, on: boolean) {
    if (!draft) return;
    patch({ perms: on ? [...draft.perms, id] : draft.perms.filter((p) => p !== id) });
  }

  /** 기능 하나를 통째로 — 하위 탭을 다 켜거나 다 끈다 */
  function toggleModule(slug: string, on: boolean) {
    if (!draft) return;
    const ids = MODULES.find((m) => m.slug === slug)?.subfunctions.map((s) => s.id) ?? [];
    const rest = draft.perms.filter((p) => !ids.includes(p));
    patch({ perms: on ? [...rest, ...ids] : rest });
  }

  /* ── 부서 ── */
  async function addDept(name: string) {
    try {
      const d = await createDepartment(name);
      await reload();
      setSelDept(d.id);
      setSelRank(null);
      setDialog(null);
      showToast(`${name} 부서를 만들었어요. 이제 직급을 만들어 주세요`);
    } catch (e) {
      showToast(errorText(e, "부서를 만들지 못했어요"), "error");
    }
  }

  async function doRenameDept(dept: DepartmentDto, to: string) {
    try {
      await renameDepartment(dept.id, to);
      await reload();
      setDialog(null);
      showToast(`부서 이름을 ${to}${josa(to, "로/으로")} 바꿨어요`);
    } catch (e) {
      showToast(errorText(e, "부서 이름을 바꾸지 못했어요"), "error");
    }
  }

  async function doDeleteDept(dept: DepartmentDto, moveToName: string | null) {
    const moveTo = moveToName ? depts.find((d) => d.name === moveToName)?.id ?? null : null;
    try {
      await deleteDepartment(dept.id, moveTo);
      const { d } = await reload();
      setSelDept(d[0]?.id ?? NONE);
      setSelRank(null);
      setDialog(null);
      showToast(
        moveToName
          ? `${dept.name} 부서를 지우고 직급을 ${moveToName}${josa(moveToName, "로/으로")} 옮겼어요`
          : `${dept.name} 부서를 지웠어요`,
      );
    } catch (e) {
      showToast(errorText(e, "부서를 지우지 못했어요"), "error");
    }
  }

  /* ── 직급 ── */
  async function addRank(dept: DepartmentDto, name: string) {
    try {
      const r = await createRole(name, dept.id);
      await reload();
      setSelRank(r.id);
      setDialog(null);
      showToast(`${name} 직급을 만들었어요. 이제 볼 수 있는 탭을 골라 주세요`);
    } catch (e) {
      showToast(errorText(e, "직급을 만들지 못했어요"), "error");
    }
  }

  async function doRenameRank(target: RoleDto, to: string) {
    try {
      await updateRole(target.id, { ...toInput(toDraft(target)), name: to });
      await reload();
      setDialog(null);
      showToast(`직급 이름을 ${to}${josa(to, "로/으로")} 바꿨어요`);
    } catch (e) {
      showToast(errorText(e, "직급 이름을 바꾸지 못했어요"), "error");
    }
  }

  async function doDeleteRank(target: RoleDto, moveToName: string | null) {
    const moveTo = moveToName ? roles.find((r) => r.name === moveToName)?.id ?? null : null;
    try {
      await deleteRole(target.id, moveTo);
      const { r } = await reload();
      setSelRank(r.find((x) => x.departmentId === target.departmentId)?.id ?? null);
      setDialog(null);
      showToast(
        moveToName
          ? `${target.name} 직급을 지우고 구성원을 ${moveToName}${josa(moveToName, "로/으로")} 옮겼어요`
          : `${target.name} 직급을 지웠어요`,
      );
    } catch (e) {
      showToast(errorText(e, "직급을 지우지 못했어요"), "error");
    }
  }

  async function save() {
    if (!role || !draft) return;
    setSaving(true);
    try {
      const next = await updateRole(role.id, toInput(draft));
      setRoles((prev) => prev.map((r) => (r.id === next.id ? next : r)));
      setEdit(null);
      // 내 직급이 바뀐 것일 수도 있다 — 내비·잠금이 따라오게 다시 받는다
      void refreshWorkspaceMe();
      showToast(`${next.name} 권한을 저장했어요 · ${next.memberCount}명에게 적용됐어요`);
    } catch (e) {
      showToast(errorText(e, "권한을 저장하지 못했어요"), "error");
    } finally {
      setSaving(false);
    }
  }

  const deptOf = (id: number | null) => depts.find((d) => d.id === id)?.name ?? "전사";

  return (
    <>
      {/* **테두리를 두르지 않는다.** 상자에 담으면 페이지 위에 위젯을 얹은 것처럼 동떨어져
          보인다. 열 사이 세로 실선과 여백만으로 나눈다 — 설정 화면이 쓰는
          「제목 + 실선」 언어 그대로다.

          좁은 화면에서는 세 열이 위아래로 쌓인다. 순서가 그대로라 부서 → 직급 → 권한을
          아래로 훑으면 된다. */}
      {/* `lg:min-h-0`이 있어야 열이 남은 높이 안에서 줄어든다 — 없으면 flex 아이템의 최소
          높이가 내용 높이라 목록이 길어질 때 화면 밖으로 밀린다 */}
      <div className="mt-5 grid lg:min-h-0 lg:flex-1 lg:grid-cols-[252px_252px_minmax(0,1fr)]">
        {/* ── 1. 부서 ── */}
        <div className="thin-scroll min-w-0 border-b border-slate-100 pb-5 lg:flex lg:min-h-0 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r lg:pb-4 lg:pr-5">
          <ColHead title="부서" aside={loaded ? `${depts.length}개` : ""} />
          <ul className="mb-1.5 border-b border-slate-100 pb-1.5">
            <Row on={selDept === NONE} label="전사" aside="부서 없음" onPick={() => pickDept(NONE)} />
          </ul>
          {!loaded && <p className="px-1 py-3 text-xs text-slate-400">불러오는 중…</p>}
          <ul>
            {depts.map((d) => (
              <Row
                key={d.id}
                on={selDept === d.id}
                label={d.name}
                aside={String(d.roleCount)}
                onPick={() => pickDept(d.id)}
                onRename={() => setDialog({ kind: "renameDept", dept: d })}
                onDelete={() => setDialog({ kind: "delDept", dept: d })}
              />
            ))}
          </ul>
          {/* 만들기는 목록의 다음 줄이다 — 열 맨 아래에 못 박으면 목록과 멀어진다 */}
          <AddLine label="부서 만들기" disabled={!loaded} onClick={() => setDialog({ kind: "newDept" })} />
        </div>

        {/* ── 2. 직급 ── */}
        <div className="thin-scroll mt-5 min-w-0 border-b border-slate-100 pb-5 lg:mt-0 lg:flex lg:min-h-0 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-5 lg:pb-4">
          <ColHead title="직급" aside={selDept === NONE ? "부서 없음" : `${rankList.length}개`} />
          {loaded && rankList.length === 0 ? (
            <p className="px-1 py-3 text-xs leading-relaxed text-slate-400">
              직급이 없어요.
              <br />
              아래에서 먼저 만들어 주세요.
            </p>
          ) : (
            <ul>
              {rankList.map((r) => (
                <Row
                  key={r.id}
                  on={selRank === r.id}
                  label={r.name}
                  aside={r.system ? "고정" : `${r.memberCount}명`}
                  onPick={() => setSelRank(r.id)}
                  onRename={r.system || !r.editable ? undefined : () => setDialog({ kind: "renameRank", role: r })}
                  onDelete={r.system || !r.editable ? undefined : () => setDialog({ kind: "delRank", role: r })}
                />
              ))}
            </ul>
          )}
          <AddLine
            label="직급 만들기"
            // 「전사」에는 직급을 만들 수 없다 — 소유자 하나로 고정이다
            disabled={!loaded || selDept === NONE || selDept === null}
            onClick={() => {
              const dept = depts.find((d) => d.id === selDept);
              if (dept) setDialog({ kind: "newRank", dept });
            }}
          />
        </div>

        {/* ── 3. 권한 ── */}
        <div className="mt-5 flex min-w-0 flex-col lg:mt-0 lg:min-h-0 lg:pl-5">
          <ColHead title="권한 선택" aside={draft ? `탭 ${onTabs}/${TOTAL_TABS}` : ""} />

          {!role || !draft ? (
            <p className="py-16 text-center text-xs leading-relaxed text-slate-400">
              직급을 고르면
              <br />
              권한을 정할 수 있어요.
            </p>
          ) : (
            <>
              <div className="flex min-w-0 flex-1 flex-col lg:min-h-0">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 pt-1">
                  <h3 className="text-[15px] font-bold text-slate-900">{role.name}</h3>
                  {role.system && <Badge tone="slate">고정 직급</Badge>}
                  <span className="text-xs text-slate-400">
                    {deptOf(role.departmentId)} · {role.memberCount}명
                  </span>
                </div>

                {!role.editable && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-400">
                    <IconLock size={14} className="mt-0.5 shrink-0" />
                    {role.code === "owner"
                      ? "소유자 직급은 모든 권한을 가지며 편집할 수 없어요."
                      : role.system
                        ? "고정 직급의 권한은 소유자만 고칠 수 있어요."
                        : "이 직급은 편집할 수 없어요 — 내 권한보다 넓거나 내 직급이에요."}
                  </p>
                )}

                {/* 높이를 고정하지 않는다 — 남은 공간을 다 쓰고, 넘치면 이 안에서만 스크롤한다.
                    아래 저장 버튼이 늘 화면에 남는 게 이 구조의 목적이다 */}
                <div className="thin-scroll mt-1 min-h-0 flex-1 overflow-y-auto pr-1">
                  {/* 회사 단위 권한 — 탭이 아니라 회사 자체를 다루는 것들이라 따로 둔다 */}
                  <p className="pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    회사
                  </p>
                  <SettingsRows tight>
                    {WORKSPACE_PERMS.map((p) => (
                      <SettingsRow key={p.id}>
                        <ActionRow name={p.name}>
                          <Toggle
                            checked={draft.perms.includes(p.id)}
                            onChange={(v) => togglePerm(p.id, v)}
                            label={p.name}
                            // 고정 직급(구성원)에 회사 설정 권한을 줄 수는 없다 — 서버도 false 로 고정한다
                            disabled={locked || (role.system && p.id === "ws:settings")}
                          />
                        </ActionRow>
                      </SettingsRow>
                    ))}
                  </SettingsRows>

                  <p className="pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    기능 탭
                  </p>
                  <SettingsRows>
                    {MODULES.map((mod) => {
                      const subs = mod.subfunctions;
                      const on = subs.filter((s) => draft.perms.includes(s.id)).length;
                      const wsOff = !state[mod.slug]?.enabled;
                      const Icon = ICON_MAP[mod.icon];
                      return (
                        <SettingsRow key={mod.slug}>
                          <div className={wsOff ? "opacity-45" : ""}>
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex min-w-0 items-center gap-2.5">
                                <Icon size={16} className="shrink-0 text-slate-400" />
                                <span className="text-[13.5px] font-semibold text-slate-900">{mod.name}</span>
                                <span className="text-[11px] text-slate-400">
                                  {on}/{subs.length}
                                </span>
                                {wsOff && <Badge tone="slate">워크스페이스에서 꺼짐</Badge>}
                              </span>
                              <Toggle
                                size="sm"
                                checked={on > 0}
                                onChange={(v) => toggleModule(mod.slug, v)}
                                label={`${mod.name} 전체`}
                                disabled={locked || wsOff}
                              />
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 pl-[26px]">
                              {subs.map((sub) => {
                                // 탭 하나만 꺼진 경우도 있다 — 모듈은 켜졌지만 이 탭은 회사가 끈 것
                                const tabOff = wsOff || state[mod.slug]?.subs[sub.id] === false;
                                return (
                                  <span key={sub.id} className="inline-flex items-center gap-1.5">
                                    <Toggle
                                      size="sm"
                                      checked={draft.perms.includes(sub.id)}
                                      onChange={(v) => togglePerm(sub.id, v)}
                                      label={`${mod.name} > ${sub.name}`}
                                      disabled={locked || tabOff}
                                    />
                                    <span
                                      className={`text-[13px] ${
                                        draft.perms.includes(sub.id) ? "text-slate-600" : "text-slate-400"
                                      }`}
                                    >
                                      {sub.name}
                                    </span>
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </SettingsRow>
                      );
                    })}
                  </SettingsRows>

                  <div className="mt-4 border-t border-slate-200 pt-2">
                    <SettingsRows tight>
                      <SettingsRow>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                          <span className="min-w-0">
                            <span className="block text-[13.5px] font-semibold text-slate-900">
                              데이터 접근 범위
                            </span>
                            <span className="mt-0.5 block text-xs text-slate-400">
                              전체 = 워크스페이스 전부 · 부서 = 소속 부서 · 본인 = 자기가 만든 것
                            </span>
                          </span>
                          <Segmented<DataScope>
                            options={DATA_SCOPES}
                            value={draft.scope}
                            onChange={(v) => patch({ scope: v })}
                            label="데이터 접근 범위"
                            disabled={locked}
                          />
                        </div>
                      </SettingsRow>
                      <SettingsRow>
                        <ActionRow name="금액 정보 보기" value="단가·원가·매출 열">
                          <Toggle
                            checked={draft.showAmounts}
                            onChange={(v) => patch({ showAmounts: v })}
                            label="금액 정보 보기"
                            disabled={locked}
                          />
                        </ActionRow>
                      </SettingsRow>
                      <SettingsRow>
                        <ActionRow name="구성원 초대 위임" value="자기 권한 안에서만 초대 가능">
                          <Toggle
                            checked={draft.canDelegateInvite}
                            onChange={(v) => patch({ canDelegateInvite: v })}
                            label="구성원 초대 위임"
                            disabled={locked}
                          />
                        </ActionRow>
                      </SettingsRow>
                    </SettingsRows>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
                <Button variant="secondary" disabled={!dirty || saving} onClick={() => setEdit(null)}>
                  되돌리기
                </Button>
                <Button disabled={locked || !dirty} onClick={() => void save()}>
                  {saving ? "저장 중…" : "저장하기"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 팝업 ── */}
      {dialog?.kind === "newDept" && (
        <NameModal
          title="부서 만들기"
          label="부서 이름"
          placeholder="예: 생산기술팀"
          hint="직급이 없는 빈 부서로 시작해요. 이어서 직급을 만들어 주세요."
          taken={depts.map((d) => d.name)}
          onClose={() => setDialog(null)}
          onSubmit={(name) => void addDept(name)}
        />
      )}
      {dialog?.kind === "renameDept" && (
        <NameModal
          title="부서 이름 바꾸기"
          label="부서 이름"
          initial={dialog.dept.name}
          hint="이 부서를 쓰는 직급이 함께 따라와요."
          taken={depts.map((d) => d.name)}
          onClose={() => setDialog(null)}
          onSubmit={(to) => void doRenameDept(dialog.dept, to)}
        />
      )}
      {dialog?.kind === "delDept" && (
        <DeptDeleteModal
          dept={dialog.dept.name}
          ranks={roles.filter((r) => r.departmentId === dialog.dept.id).map((r) => r.name)}
          blocked={dialog.dept.roleCount > 0}
          others={depts.filter((d) => d.id !== dialog.dept.id).map((d) => d.name)}
          onClose={() => setDialog(null)}
          onDelete={(moveTo) => void doDeleteDept(dialog.dept, moveTo)}
        />
      )}
      {dialog?.kind === "newRank" && (
        <NameModal
          title="직급 만들기"
          label="직급 이름"
          placeholder="예: 생산 계획 담당"
          hint={`${dialog.dept.name} · 권한 없이 시작해요.`}
          taken={roles.map((r) => r.name)}
          onClose={() => setDialog(null)}
          onSubmit={(name) => void addRank(dialog.dept, name)}
        />
      )}
      {dialog?.kind === "renameRank" && (
        <NameModal
          title="직급 이름 바꾸기"
          label="직급 이름"
          initial={dialog.role.name}
          taken={roles.map((r) => r.name)}
          onClose={() => setDialog(null)}
          onSubmit={(to) => void doRenameRank(dialog.role, to)}
        />
      )}
      {dialog?.kind === "delRank" && (
        <RankDeleteModal
          rank={dialog.role.name}
          members={dialog.role.memberCount}
          // 옮길 곳은 내가 줄 수 있는 직급만 — 소유자 직급은 어디로도 옮길 수 없다
          others={roles
            .filter((r) => r.id !== dialog.role.id && r.code !== "owner" && (r.editable || r.system))
            .map((r) => ({ name: r.name, label: `${r.name} (${deptOf(r.departmentId)})` }))}
          onClose={() => setDialog(null)}
          onDelete={(moveTo) => void doDeleteRank(dialog.role, moveTo)}
        />
      )}

      <Toast toast={toast} />
    </>
  );
}

/**
 * 열 머리글 — 상자의 헤더가 아니라 **페이지의 소제목**이다.
 *
 * 회색 띠를 두르지 않고 아래 실선 한 줄만 긋는다. `SettingsSection`의 제목과 같은 모양이라
 * 계정·기능 관리 화면과 한 벌로 읽힌다.
 */
function ColHead({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2 border-b border-slate-200 pb-2">
      <span className="text-[13px] font-bold text-slate-900">{title}</span>
      {aside && <span className="text-[11px] text-slate-400">{aside}</span>}
    </div>
  );
}

/**
 * 만들기 — 목록의 마지막 줄.
 *
 * 테두리 있는 버튼을 열 맨 아래에 못 박으면 목록과 멀어지고, 열이 짧을 때 가운데가 비어
 * 보인다. 목록 줄과 같은 모양·같은 자리라 「다음 줄에 하나 더」로 읽힌다.
 */
function AddLine({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="-mx-2 mt-0.5 flex w-[calc(100%+1rem)] cursor-pointer items-center gap-1.5 rounded-lg px-2 py-2 text-left text-[12.5px] font-medium text-slate-400 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
    >
      <IconPlus size={13} className="shrink-0" />
      {label}
    </button>
  );
}

/**
 * 목록 한 줄 — 고르기 + (호버 시) 이름 바꾸기·지우기.
 *
 * 손잡이를 늘 띄우지 않는다. 부서가 여섯이면 아이콘이 열여덟 개가 되어 목록이 공구함처럼
 * 보인다. 키보드로도 닿아야 하므로 `focus-within`으로도 나타난다.
 */
function Row({
  on,
  label,
  aside,
  onPick,
  onRename,
  onDelete,
}: {
  on: boolean;
  label: string;
  aside?: string;
  onPick: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  return (
    <li className={`group flex items-center rounded-lg ${on ? "bg-slate-100" : "hover:bg-slate-50"}`}>
      <button
        type="button"
        aria-current={on ? "true" : undefined}
        onClick={onPick}
        className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
          on ? "font-semibold text-slate-900" : "font-medium text-slate-600"
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {aside && <span className="shrink-0 text-[11px] font-normal text-slate-400">{aside}</span>}
      </button>

      {(onRename || onDelete) && (
        <span className="flex shrink-0 gap-0.5 pr-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
          {onRename && (
            <IconButton label={`${label} 이름 바꾸기`} onClick={onRename}>
              <IconPencil size={12} />
            </IconButton>
          )}
          {onDelete && (
            <IconButton label={`${label} 지우기`} onClick={onDelete} danger>
              <IconTrash size={12} />
            </IconButton>
          )}
        </span>
      )}
    </li>
  );
}

function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded text-slate-400 transition-colors duration-150 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-400 ${
        danger ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-slate-200 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
