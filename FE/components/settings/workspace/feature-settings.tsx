"use client";

import { SettingsSection } from "@/components/settings/settings-section";
import { ICON_MAP } from "@/components/icons";
import { useModules } from "@/components/module-provider";
import { AiBadge, Toast, Toggle } from "@/components/ui";
import { useToast } from "@/components/use-toast";
import { MODULES } from "@/data/modules";

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
  const [toast, showToast] = useToast();

  const onCount = MODULES.filter((m) => state[m.slug]?.enabled).length;

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
        {/* 2열 격자 — 한 줄에 하나씩 쌓으면 하위 탭이 가로로 흘러서 어디까지가 한 기능인지
            눈으로 세어야 한다. 카드가 아니라 1px 구분선 격자다 (DESIGN.md 「카드에 그림자 금지」). */}
        <div className="mt-3 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-2">
          {MODULES.map((mod) => {
            const Icon = ICON_MAP[mod.icon];
            const st = state[mod.slug];
            const on = mod.subfunctions.filter((s) => st.subs[s.id]).length;
            return (
              <div
                key={mod.slug}
                className={`bg-white p-3.5 ${st.enabled ? "" : "opacity-55"}`}
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
                  </span>
                  <Toggle
                    size="sm"
                    checked={st.enabled}
                    onChange={(v) =>
                      report(setModule(mod.slug, v), `${mod.name} 기능을 ${v ? "켰어요" : "껐어요"}`)
                    }
                    label={`${mod.name} 기능`}
                  />
                </div>

                {/* 하위 탭은 토글로 남긴다 — 칩으로 바꾸면 켜고 끄는 것인지 고르는 것인지
                    구분이 안 되고, 위 기능 토글과 같은 동작이 두 모양이 된다 */}
                <div className="mt-2.5 flex flex-col gap-1.5">
                  {mod.subfunctions.map((sub) => (
                    <span key={sub.id} className="inline-flex items-center gap-2">
                      <Toggle
                        size="sm"
                        checked={st.subs[sub.id]}
                        onChange={(v) =>
                          report(setSub(mod.slug, sub.id, v), `${sub.name}을 ${v ? "켰어요" : "껐어요"}`)
                        }
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
