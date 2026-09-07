"use client";

import { useMemo, useState } from "react";
import {
  ActionRow,
  SettingsRow,
  SettingsRows,
} from "@/components/settings/settings-section";
import { RoleCreateModal } from "@/components/settings/company/role-create-modal";
import { ICON_MAP, IconLock, IconPlus } from "@/components/icons";
import { useModules } from "@/components/module-provider";
import { Badge, Button, Segmented, Toast, Toggle } from "@/components/ui";
import { useToast } from "@/components/use-toast";
import { DATA_SCOPES, DEPARTMENTS, ROLES, USERS_ROLES } from "@/data/org";
import { MODULES } from "@/data/modules";
import {
  WORKSPACE_PERMS,
  canDeleteRole,
  groupRolesByDept,
  roleMemberCount,
  summarizeRole,
} from "@/data/roles";
import type { DataScope, RoleDef } from "@/data/roles";

type PaneTab = "perms" | "members";

/**
 * 회사 › 권한 관리 — 부서 → 직급 → 권한 3단.
 *
 * **좌우 2단이다.** 왼쪽에서 직급을 고르고 오른쪽에서 그 권한을 고친다. 예전에는 위아래
 * 섹션이라 직급을 바꿀 때마다 스크롤이 튀었다 (수정요청 v12).
 *
 * **권한 = 탭 접근이다.** 서브기능은 곧 모듈 화면의 탭이고(`components/module-view.tsx`의
 * 「서브기능 탭」), 권한을 준다는 건 그 탭을 볼 수 있게 한다는 뜻이다. 그래서 체크박스가
 * 아니라 **토글**이고, 모양이 기능 관리와 같다 — 저기는 "이 회사가 어떤 탭을 쓰나",
 * 여기는 "이 직급이 그중 어떤 탭을 보나"다.
 *
 * **워크스페이스에서 꺼 둔 기능은 여기서도 잠긴다.** 아무도 못 보는 탭에 권한을 줘 봐야
 * 소용이 없고, 켜 두면 기능을 다시 켰을 때 의도치 않게 열린다.
 *
 * 회사 단위 권한 4개(회사 정보 관리·구성원 정보 관리·데이터 연동·회사 삭제)는 탭이 아니라
 * 따로 둔다.
 *
 * **데이터 접근 범위와 토글 두 개는 남겼다.** 체크박스만으로는 "자기 부서 것만"을 표현할 수
 * 없고, 금액 열을 누가 보느냐는 제조·유통에서 실제 요구였다.
 *
 * **이 화면은 보안 경계가 아니다.** 실제 접근 차단은 BE 세션의 직급 검사에서 한다.
 * `showAmounts`도 열을 가리는 표시일 뿐 — 값을 안 내려주는 건 BE가 해야 한다.
 *
 * **BE 연동 seam**: `save()`가 직급 upsert API를 부르고, 성공하면 그 직급을 가진 사용자에게
 * 즉시 적용된다. 실패하면 `showToast(문구, "error")`.
 */
export function RoleEditor() {
  const [toast, showToast] = useToast();
  const [roles, setRoles] = useState<RoleDef[]>(ROLES);
  /** 저장 전 값 — 「변경사항 되돌리기」가 여기로 돌아간다 */
  const [saved, setSaved] = useState<RoleDef[]>(ROLES);
  // 처음에는 시스템이 아닌 첫 직급을 고른다 — 소유자를 열면 전부 잠겨 있어 화면이 죽어 보인다
  const [selectedId, setSelectedId] = useState(
    ROLES.find((r) => !r.system)?.id ?? ROLES[0].id,
  );
  const [tab, setTab] = useState<PaneTab>("perms");
  const [creating, setCreating] = useState(false);

  /**
   * 만든 직급을 바로 고르고 `권한` 탭을 연다 — 만든 직후 할 일이 권한 고르기다.
   * `saved`에도 같이 넣는다. 안 넣으면 새 직급이 처음부터 「변경됨」으로 보인다.
   */
  function create(role: RoleDef) {
    setRoles((prev) => [...prev, role]);
    setSaved((prev) => [...prev, role]);
    setSelectedId(role.id);
    setTab("perms");
    setCreating(false);
    showToast(`${role.name} 권한을 만들었어요. 이제 권한을 골라 주세요`);
  }

  /** 워크스페이스가 지금 켜 둔 기능 — 꺼진 기능의 탭은 아무도 못 보니 여기서도 잠근다 */
  const { state } = useModules();

  /** 기능 탭 전체 개수 (서브기능 27개) */
  const totalTabs = useMemo(
    () => MODULES.reduce((n, m) => n + m.subfunctions.length, 0),
    [],
  );
  /** 권한 요약이 세는 전체 = 기능 탭 + 회사 권한 */
  const totalPerms = totalTabs + WORKSPACE_PERMS.length;

  const role = roles.find((r) => r.id === selectedId) ?? roles[0];
  const locked = role.system;
  const dirty = JSON.stringify(role) !== JSON.stringify(saved.find((r) => r.id === role.id));

  const onTabs = MODULES.reduce(
    (n, m) => n + m.subfunctions.filter((s) => role.perms.includes(s.id)).length,
    0,
  );

  const members = USERS_ROLES.filter((u) => u.role === role.name);

  function patch(next: Partial<RoleDef>) {
    setRoles((prev) => prev.map((r) => (r.id === role.id ? { ...r, ...next } : r)));
  }

  function togglePerm(id: string, on: boolean) {
    patch({
      perms: on ? [...role.perms, id] : role.perms.filter((p) => p !== id),
    });
  }

  /**
   * 기능 하나를 통째로 — 하위 탭을 다 켜거나 다 끈다.
   *
   * `feature-settings.tsx`의 `setModule`과 같은 규칙이다. 반대 방향(하위를 다 끄면 기능도
   * 꺼진 것으로 보인다)은 따로 저장하지 않는다 — `on > 0`으로 파생하면 상태가 한 벌로 남는다.
   */
  function toggleModule(slug: string, on: boolean) {
    const ids = MODULES.find((m) => m.slug === slug)?.subfunctions.map((s) => s.id) ?? [];
    const rest = role.perms.filter((p) => !ids.includes(p));
    patch({ perms: on ? [...rest, ...ids] : rest });
  }

  function save() {
    setSaved(roles);
    showToast(`${role.name} 권한을 저장했어요 · ${members.length}명에게 적용됐어요`);
  }

  function revert() {
    setRoles(saved);
    showToast("변경사항을 되돌렸어요");
  }

  function remove() {
    if (!canDeleteRole(role, roles)) return;
    const gone = role.name;
    const rest = roles.filter((r) => r.id !== role.id);
    setRoles(rest);
    setSaved(rest);
    setSelectedId(rest[0].id);
    showToast(`${gone} 권한을 지웠어요`);
  }

  return (
    <>
      <div className="mt-5 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* ── 왼쪽: 부서별 직급 ── */}
        <nav aria-label="권한 목록" className="min-w-0">
          {groupRolesByDept(roles, DEPARTMENTS).map((g) => (
            <div key={g.dept ?? "__none"} className="mb-4 last:mb-0">
              {/* 소유자는 어느 부서에도 속하지 않아 머리글 없이 맨 위에 온다 */}
              {g.dept && (
                <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {g.dept}
                </p>
              )}
              {g.roles.length === 0 ? (
                <p className="px-1 pb-1 text-xs text-slate-300">직급 없음</p>
              ) : (
                <ul className="space-y-0.5">
                  {g.roles.map((r) => {
                    const on = r.id === role.id;
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          aria-current={on ? "true" : undefined}
                          onClick={() => setSelectedId(r.id)}
                          className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
                            on
                              ? "bg-white font-semibold text-slate-900 ring-1 ring-slate-200"
                              : "font-medium text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate">{r.name}</span>
                          {r.system && (
                            <span className="shrink-0 text-[11px] font-normal text-slate-400">
                              시스템
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}

          <Button
            variant="secondary"
            size="sm"
            className="mt-1 w-full"
            onClick={() => setCreating(true)}
          >
            <IconPlus size={14} />
            권한 만들기
          </Button>
        </nav>

        {/* ── 오른쪽: 고른 직급 ── */}
        {/* 오른쪽은 폭을 묶는다 — 페이지가 꽉 찬 폭이라(`wide`) 그대로 두면 「인사 관리」
            네 글자짜리 행의 구분선이 900px를 가로지른다. 왼쪽 목록은 그 폭이 필요하지만
            (부서 머리글 + 직급 이름) 체크박스 목록은 아니다. */}
        <section aria-label={`${role.name} 권한`} className="min-w-0 max-w-2xl">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b border-slate-200 pb-2.5">
            <h2 className="text-[15px] font-bold text-slate-900">{role.name}</h2>
            {role.system && <Badge tone="slate">시스템 직급</Badge>}
            <span className="text-xs text-slate-400">
              {summarizeRole(role, totalPerms)} · {roleMemberCount(role.name, USERS_ROLES)}명
            </span>
          </div>

          <div role="tablist" aria-label="권한 상세" className="mt-3 flex gap-1">
            {(
              [
                { id: "perms", label: "권한" },
                { id: "members", label: "구성원" },
              ] as const
            ).map((t) => {
              const on = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(t.id)}
                  className={`cursor-pointer rounded-lg px-3 py-1.5 text-[13px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
                    on
                      ? "bg-slate-100 font-semibold text-slate-900"
                      : "font-medium text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {tab === "perms" ? (
            <>
              {locked && (
                <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-400">
                  <IconLock size={14} className="mt-0.5 shrink-0" />
                  시스템 직급의 설정은 편집할 수 없어요.
                </p>
              )}

              {/* 회사 단위 권한 — 탭이 아니라 회사 자체를 다루는 것들이라 따로 둔다 */}
              <div className="mt-4">
                <p className="pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  회사
                </p>
                <SettingsRows tight>
                  {WORKSPACE_PERMS.map((p) => (
                    <SettingsRow key={p.id}>
                      <ActionRow name={p.name}>
                        <Toggle
                          checked={role.perms.includes(p.id)}
                          onChange={(v) => togglePerm(p.id, v)}
                          label={p.name}
                          disabled={locked}
                        />
                      </ActionRow>
                    </SettingsRow>
                  ))}
                </SettingsRows>
              </div>

              {/* 기능 탭 — 기능 관리와 같은 모양이다. 저기는 "이 회사가 어떤 탭을 쓰나",
                  여기는 "이 직급이 그중 어떤 탭을 보나"라서 같은 것을 두 번 묻지 않는다. */}
              <div className="mt-6">
                <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 pb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    기능 탭
                  </p>
                  <span className="text-[11px] text-slate-400">
                    켜진 탭 {onTabs}/{totalTabs}
                  </span>
                </div>

                <div className="thin-scroll mt-1 max-h-[420px] overflow-y-auto pr-1">
                  <SettingsRows>
                    {MODULES.map((mod) => {
                      const subs = mod.subfunctions;
                      const on = subs.filter((s) => role.perms.includes(s.id)).length;
                      // 워크스페이스에서 꺼 둔 기능은 아무도 못 본다 — 여기서 켜 봐야 소용없다
                      const wsOff = !state[mod.slug]?.enabled;
                      const Icon = ICON_MAP[mod.icon];
                      return (
                        <SettingsRow key={mod.slug}>
                          <div className={wsOff ? "opacity-45" : ""}>
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex min-w-0 items-center gap-2.5">
                                <Icon size={16} className="shrink-0 text-slate-400" />
                                <span className="text-[13.5px] font-semibold text-slate-900">
                                  {mod.name}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {on}/{subs.length}
                                </span>
                                {wsOff && (
                                  <Badge tone="slate">워크스페이스에서 꺼짐</Badge>
                                )}
                              </span>
                              {/* 기능 전체를 한 번에 — 하위 탭을 다 켜거나 다 끈다 */}
                              <Toggle
                                size="sm"
                                checked={on > 0}
                                onChange={(v) => toggleModule(mod.slug, v)}
                                label={`${mod.name} 전체`}
                                disabled={locked || wsOff}
                              />
                            </div>

                            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 pl-[26px]">
                              {subs.map((sub) => (
                                <span key={sub.id} className="inline-flex items-center gap-1.5">
                                  <Toggle
                                    size="sm"
                                    checked={role.perms.includes(sub.id)}
                                    onChange={(v) => togglePerm(sub.id, v)}
                                    label={`${mod.name} > ${sub.name}`}
                                    disabled={locked || wsOff}
                                  />
                                  <span
                                    className={`text-[13px] ${
                                      role.perms.includes(sub.id)
                                        ? "text-slate-600"
                                        : "text-slate-400"
                                    }`}
                                  >
                                    {sub.name}
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>
                        </SettingsRow>
                      );
                    })}
                  </SettingsRows>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-200 pt-3">
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
                        value={role.scope}
                        onChange={(v) => patch({ scope: v })}
                        label="데이터 접근 범위"
                        disabled={locked}
                      />
                    </div>
                  </SettingsRow>
                  <SettingsRow>
                    <ActionRow name="금액 정보 보기" value="단가·원가·매출 열">
                      <Toggle
                        checked={role.showAmounts}
                        onChange={(v) => patch({ showAmounts: v })}
                        label="금액 정보 보기"
                        disabled={locked}
                      />
                    </ActionRow>
                  </SettingsRow>
                  <SettingsRow>
                    <ActionRow name="구성원 초대 위임" value="자기 권한 안에서만 초대 가능">
                      <Toggle
                        checked={role.canDelegateInvite}
                        onChange={(v) => patch({ canDelegateInvite: v })}
                        label="구성원 초대 위임"
                        disabled={locked}
                      />
                    </ActionRow>
                  </SettingsRow>
                </SettingsRows>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!canDeleteRole(role, roles)}
                  onClick={remove}
                >
                  권한 삭제
                </Button>
                <span className="flex gap-2">
                  <Button variant="secondary" disabled={!dirty} onClick={revert}>
                    변경사항 되돌리기
                  </Button>
                  <Button disabled={locked || !dirty} onClick={save}>
                    저장하기
                  </Button>
                </span>
              </div>
            </>
          ) : (
            <div className="mt-3">
              {members.length === 0 ? (
                <p className="py-12 text-center text-[13.5px] text-slate-400">
                  데이터가 없습니다
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {members.map((m) => (
                    <li key={m.email} className="flex items-center gap-3 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-medium text-slate-900">
                          {m.name}
                        </span>
                        <span className="block truncate text-xs text-slate-500">{m.email}</span>
                      </span>
                      <span className="shrink-0 text-xs text-slate-500">{m.dept}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>

      {/* 열 때만 마운트한다 — 닫으면 입력이 사라지고, 지우는 effect가 필요 없어진다 */}
      {creating && (
        <RoleCreateModal
          onClose={() => setCreating(false)}
          onCreate={create}
          depts={DEPARTMENTS}
          taken={roles.map((r) => r.name)}
        />
      )}
      <Toast toast={toast} />
    </>
  );
}
