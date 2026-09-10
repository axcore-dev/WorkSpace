"use client";

import { SettingsSection } from "@/components/settings/settings-section";
import { ICON_MAP } from "@/components/icons";
import { useModules } from "@/components/module-provider";
import { AiBadge, Badge, Toast, Toggle } from "@/components/ui";
import { useToast } from "@/components/use-toast";
import { MODULES } from "@/data/modules";
import { useWorkspaceMe } from "@/lib/workspace-me";

/**
 * 워크스페이스 › 기능 관리 — 기능과 그 하위 항목 ON/OFF.
 *
 * 화면 문구에서 「모듈」이라는 말을 쓰지 않는다 (수정요청 v12). 코드 이름
 * (`MODULES`·`slug`·`data/modules.ts`)은 그대로 둔다 — 화면에 안 나온다.
 *
 * 토글은 즉시 저장한다(`useModules`가 서버에 바로 쓴다 — `PUT /api/workspace/features/{module}`) —
 * 폼이 아니라 스위치라 저장 버튼을 두지 않는다. 대신 무엇이 바뀌었는지 토스트로 알린다.
 * 화면은 먼저 바뀌고, 저장이 거절되면(관리자가 아님 · 네트워크) 스토어가 되돌리고 여기서 에러 톤으로 알린다.
 *
 * 알림 안내가 여기 있는 이유: 워크스페이스 알림 설정은 임시 비활성화 상태라 내비 항목을
 * 만들지 않았다 — 눌러서 도착한 페이지에 안내문만 있으면 막힌 길이 된다. 기능을 켜고 끄는
 * 화면이 그 안내의 자리다. 다시 켜면 이 섹션을 `/settings/workspace/notifications` 잎으로
 * 승격한다. (개인 알림 설정은 계정 페이지에 있었는데 v12에서 함께 빠졌다.)
 */
export function FeatureSettings() {
  const { state, setModule, setSub } = useModules();
  const { me } = useWorkspaceMe();
  const [toast, showToast] = useToast();

  const onCount = MODULES.filter((m) => state[m.slug]?.enabled).length;

  /**
   * 내 직급이 가진 탭만 켜고 끌 수 있다 — 회사 설정 권한이 있어도 자기 직급에 없는 기능은 잠긴다.
   * 경영지원·영업만 받은 팀장이 생산관리를 켜면 자기가 볼 수도 없는 화면을 회사 전체에 여는 셈이다.
   * 소유자는 전부다. 자격을 받기 전에는 전부 잠근다 — 서버도 같은 규칙으로 거절한다(403).
   */
  const canEdit = !!me && (me.member.admin || me.member.owner);
  const granted = new Set(canEdit ? me.permissions.tabs : []);

  /** 저장 결과를 토스트로. 성공 문구는 바로, 실패는 스토어가 되돌린 뒤 에러 톤으로 */
  function report(saving: Promise<void>, done: string) {
    saving.then(
      () => showToast(done),
      (e: unknown) =>
        showToast(e instanceof Error && e.message ? e.message : "저장하지 못했어요", "error"),
    );
  }

  return (
    <>
      <SettingsSection
        title="기능 활성화"
        aside={
          <span className="text-xs text-slate-400">
            {MODULES.length}가지 중 {onCount}가지 켜짐
          </span>
        }
      >
        {/* 기능 한 줄 = 한 행. 2열 격자였을 때는 한 행의 두 칸이 큰 쪽 높이로 늘어나서, 하위 탭이
            2개인 기능 아래에 104px 빈칸이 생겼다 (하위 탭 수가 2~6개로 다르다). 행으로 세우고
            하위 탭을 열로 묶으면 각 행이 제 내용만큼만 높다. 구분은 1px 실선이 진다
            (DESIGN.md 「카드에 그림자 금지」). */}
        <div className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
          {MODULES.map((mod) => {
            const Icon = ICON_MAP[mod.icon];
            const st = state[mod.slug];
            const on = mod.subfunctions.filter((s) => st.subs[s.id]).length;
            /** 이 기능에서 내가 만질 수 있는 탭. 하나도 없으면 기능 토글도 잠긴다 */
            const mine = mod.subfunctions.filter((s) => granted.has(s.id)).map((s) => s.id);
            return (
              <div
                key={mod.slug}
                className={`bg-white p-4 ${st.enabled ? "" : "opacity-55"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Icon
                      size={16}
                      className={`shrink-0 ${st.enabled ? "text-slate-600" : "text-slate-300"}`}
                    />
                    <span className="truncate text-[13.5px] font-semibold text-slate-900">
                      {mod.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {on}/{mod.subfunctions.length}
                    </span>
                    {canEdit && mine.length === 0 && <Badge tone="slate">내 직급에 없음</Badge>}
                  </span>
                  <Toggle
                    size="sm"
                    checked={st.enabled}
                    // 내가 가진 탭만 바꾼다 — 남의 탭까지 통째로 켜고 끄지 않는다
                    onChange={(v) =>
                      report(setModule(mod.slug, v, mine), `${mod.name} 기능을 ${v ? "켰어요" : "껐어요"}`)
                    }
                    label={`${mod.name} 기능`}
                    disabled={mine.length === 0}
                  />
                </div>

                {/* 하위 탭은 토글로 남긴다 — 칩으로 바꾸면 켜고 끄는 것인지 고르는 것인지
                    구분이 안 되고, 위 기능 토글과 같은 동작이 두 모양이 된다 */}
                <div className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {mod.subfunctions.map((sub) => (
                    <span key={sub.id} className="inline-flex items-center gap-2">
                      <Toggle
                        size="sm"
                        checked={st.subs[sub.id]}
                        onChange={(v) =>
                          report(setSub(mod.slug, sub.id, v), `${sub.name}을 ${v ? "켰어요" : "껐어요"}`)
                        }
                        label={`${mod.name} > ${sub.name}`}
                        disabled={!granted.has(sub.id)}
                      />
                      <span
                        className={`flex items-center gap-1 text-[13px] ${
                          st.subs[sub.id] ? "text-slate-600" : "text-slate-400"
                        }`}
                      >
                        {sub.name}
                        {sub.ai && <AiBadge />}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection title="알림">
        <p className="py-6 text-center text-[13.5px] text-slate-400">
          알림 설정은 임시 비활성화되어 있어요. 다음 업데이트에서 다시 제공될 예정이에요.
        </p>
      </SettingsSection>

      <Toast toast={toast} />
    </>
  );
}
