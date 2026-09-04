"use client";

import { useMemo, useState } from "react";
import {
  ActionRow,
  SectionActions,
  SettingsRow,
  SettingsRows,
  SettingsSection,
} from "@/components/settings/settings-section";
import { IconLock, IconPlus } from "@/components/icons";
import { Badge, Button, Segmented, Toast, Toggle } from "@/components/ui";
import { useToast } from "@/components/use-toast";
import { DATA_SCOPES, MODULE_PERMS, ROLES, USERS_ROLES } from "@/data/org";
import { MODULES } from "@/data/modules";
import { canDeleteRole, roleMemberCount, summarizeRole } from "@/data/roles";
import type { DataScope, ModulePerm, RoleDef } from "@/data/roles";

/**
 * 관리 › 역할·권한.
 *
 * 권한은 두 축이다 — 기능 접근(모듈 8개 × 없음/읽기/쓰기)과 데이터 접근 범위
 * (전체/부서/본인). 이 두 축은 `admin-settings.tsx`가 이미 화면에 써둔 문장이다:
 * "역할·부서에 따라 기능(모듈·메뉴·버튼)과 데이터 접근 범위가 제어됩니다."
 *
 * **권한 단위는 모듈 8개다.** 서브기능 27개까지 내리지 않는다 — 격자가 27행이 되고
 * 역할마다 그걸 다 정해야 한다. 필요해지면 접었다 펴는 구조로 바꾼다.
 *
 * **이 화면은 보안 경계가 아니다.** 실제 접근 차단은 BE 세션의 역할 검사에서 한다.
 * `showAmounts`도 열을 가리는 표시일 뿐이다 — 값을 안 내려주는 건 BE가 해야 한다.
 *
 * **BE 연동 seam**: `save()`가 역할 upsert API를 부르고, 성공하면 그 역할을 가진 사용자에게
 * 즉시 적용된다. 실패하면 `showToast(문구, "error")`.
 */
export function RoleEditor() {
  const [toast, showToast] = useToast();
  const [roles, setRoles] = useState<RoleDef[]>(ROLES);
  // 처음에는 시스템 역할이 아닌 첫 역할을 고른다 — 관리자를 열면 전부 잠겨 있어 화면이 죽어 보인다
  const [selectedId, setSelectedId] = useState(
    ROLES.find((r) => !r.system)?.id ?? ROLES[0].id,
  );

  const moduleNames = useMemo(
    () => Object.fromEntries(MODULES.map((m) => [m.slug, m.name])),
    [],
  );

  const role = roles.find((r) => r.id === selectedId) ?? roles[0];
  const locked = role.system;

  function patch(next: Partial<RoleDef>) {
    setRoles((prev) => prev.map((r) => (r.id === role.id ? { ...r, ...next } : r)));
  }

  function setPerm(slug: string, perm: ModulePerm) {
    patch({ perms: { ...role.perms, [slug]: perm } });
  }

  function save() {
    const n = roleMemberCount(role.name, USERS_ROLES);
    showToast(`${role.name} 역할을 저장했어요 · ${n}명에게 적용됐어요`);
  }

  function remove() {
    if (!canDeleteRole(role, roles)) return;
    const gone = role.name;
    const rest = roles.filter((r) => r.id !== role.id);
    setRoles(rest);
    setSelectedId(rest[0].id);
    showToast(`${gone} 역할을 지웠어요`);
  }

  return (
    <>
      <SettingsSection
        title="역할"
        aside={<span className="text-xs text-slate-400">{roles.length}개</span>}
      >
        <SettingsRows tight>
          {roles.map((r) => {
            const on = r.id === role.id;
            return (
              <SettingsRow key={r.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelectedId(r.id)}
                  className={`-mx-2.5 flex w-[calc(100%+1.25rem)] cursor-pointer items-center gap-3 rounded-lg px-2.5 py-1 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
                    on ? "bg-slate-50 ring-1 ring-slate-200" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold text-slate-900">
                      {r.name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-400">
                      {summarizeRole(r, moduleNames)}
                    </span>
                  </span>
                  {r.system && <Badge tone="slate">시스템 역할</Badge>}
                  <Badge tone="slate">{roleMemberCount(r.name, USERS_ROLES)}명</Badge>
                </button>
              </SettingsRow>
            );
          })}
        </SettingsRows>
        <SectionActions>
          <Button variant="secondary" size="sm">
            <IconPlus size={14} />
            역할 만들기
          </Button>
        </SectionActions>
      </SettingsSection>

      <SettingsSection
        title={`${role.name} — 기능 권한`}
        aside={<span className="text-xs text-slate-400">모듈 {MODULES.length}개</span>}
      >
        {locked && (
          <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-400">
            <IconLock size={14} className="mt-0.5 shrink-0" />
            시스템 역할은 바꿀 수 없어요. 모든 걸 할 수 있는 역할이 하나는 남아 있어야 해요.
          </p>
        )}
        <SettingsRows tight>
          {MODULES.map((m) => (
            <SettingsRow key={m.slug}>
              {/* 좁은 화면에서는 세로로 쌓는다 — 모듈 이름 + 세그먼트 3칸이 390px 한 줄에 안 들어간다 */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="text-[13.5px] font-semibold text-slate-900">{m.name}</span>
                <Segmented<ModulePerm>
                  options={MODULE_PERMS}
                  value={role.perms[m.slug] ?? "none"}
                  onChange={(v) => setPerm(m.slug, v)}
                  label={`${m.name} 권한`}
                  disabled={locked}
                />
              </div>
            </SettingsRow>
          ))}
        </SettingsRows>
      </SettingsSection>

      <SettingsSection title="데이터 접근 범위">
        <SettingsRows tight>
          <SettingsRow>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-slate-900">범위</span>
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
        <SectionActions spread>
          <Button variant="ghost" size="sm" disabled={!canDeleteRole(role, roles)} onClick={remove}>
            역할 삭제
          </Button>
          <Button disabled={locked} onClick={save}>
            저장하기
          </Button>
        </SectionActions>
      </SettingsSection>

      <Toast toast={toast} />
    </>
  );
}
