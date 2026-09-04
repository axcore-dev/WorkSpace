"use client";

import {
  SettingsRow,
  SettingsRows,
  SettingsSection,
} from "@/components/settings/settings-section";
import { ICON_MAP } from "@/components/icons";
import { useModules } from "@/components/module-provider";
import { AiBadge, Toast, Toggle } from "@/components/ui";
import { useToast } from "@/components/use-toast";
import { MODULES } from "@/data/modules";

/**
 * 워크스페이스 › 기능 — 모듈·서브기능 ON/OFF.
 *
 * 토글은 즉시 저장한다(`useModules`가 localStorage에 바로 쓴다) — 폼이 아니라 스위치라
 * 저장 버튼을 두지 않는다. 대신 무엇이 바뀌었는지 토스트로 알린다.
 *
 * 알림 안내가 여기 있는 이유: 워크스페이스 알림 설정은 임시 비활성화 상태라 내비 항목을
 * 만들지 않았다 — 눌러서 도착한 페이지에 안내문만 있으면 막힌 길이 된다. 기능을 켜고 끄는
 * 화면이 그 안내의 자리다. 다시 켜면 이 섹션을 `/settings/workspace/notifications` 잎으로
 * 승격한다.
 *
 * (개인이 어떤 알림을 어디로 받을지는 별개다 — 계정 › 알림에 있다.)
 */
export function FeatureSettings() {
  const { state, setModule, setSub } = useModules();
  const [toast, showToast] = useToast();

  return (
    <>
      <SettingsSection
        title="기능 활성화"
        aside={<span className="text-xs text-slate-400">모듈 {MODULES.length}개</span>}
      >
        <SettingsRows>
          {MODULES.map((mod) => {
            const Icon = ICON_MAP[mod.icon];
            const st = state[mod.slug];
            return (
              <SettingsRow key={mod.slug}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon
                      size={17}
                      className={`shrink-0 ${st.enabled ? "text-slate-600" : "text-slate-300"}`}
                    />
                    <p
                      className={`text-[13.5px] font-semibold ${
                        st.enabled ? "text-slate-900" : "text-slate-400"
                      }`}
                    >
                      {mod.name}
                    </p>
                  </div>
                  <Toggle
                    size="sm"
                    checked={st.enabled}
                    onChange={(v) => {
                      setModule(mod.slug, v);
                      showToast(`${mod.name} 기능을 ${v ? "켰어요" : "껐어요"}`);
                    }}
                    label={`${mod.name} 기능`}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 pl-8">
                  {mod.subfunctions.map((sub) => (
                    <span key={sub.id} className="inline-flex items-center gap-1.5">
                      <Toggle
                        size="sm"
                        checked={st.subs[sub.id]}
                        onChange={(v) => {
                          setSub(mod.slug, sub.id, v);
                          showToast(`${sub.name}을 ${v ? "켰어요" : "껐어요"}`);
                        }}
                        label={`${mod.name} > ${sub.name}`}
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
              </SettingsRow>
            );
          })}
        </SettingsRows>
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
