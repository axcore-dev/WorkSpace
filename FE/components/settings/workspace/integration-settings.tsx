"use client";

import { useState } from "react";
import {
  ActionRow,
  SectionActions,
  SettingsRow,
  SettingsRows,
  SettingsSection,
} from "@/components/settings/settings-section";
import { BrandIcon } from "@/components/brand-icons";
import { ConnectorModal } from "@/components/connector-modal";
import { IconLock, IconPlus } from "@/components/icons";
import { Badge, Button, Toast } from "@/components/ui";
import { useToast } from "@/components/use-toast";
import { CONNECTOR_LIB } from "@/data/chat";
import { CONNECTORS, EXTERNAL_SERVICES, SYNC_RULES } from "@/data/org";

/**
 * 워크스페이스 › 연동.
 *
 * **외부 시스템은 읽기 전용이다** — 운영팀이 연결해준다. 추가·설정 버튼을 두지 않고
 * 이름·시스템·상태만 보인다. 버튼 없는 목록은 고장으로 읽히므로 안내 한 줄은 남긴다
 * (계정 페이지의 문구 제거 규칙은 계정에만 적용한다).
 *
 * **BE 연동 seam**: `disconnectService`가 연결 해제 API를 부르고, 실패하면 상태를 되돌리고
 * `showToast(문구, "error")`로 알린다.
 */
export function IntegrationSettings() {
  const [toast, showToast] = useToast();
  const [services, setServices] = useState(EXTERNAL_SERVICES);
  const [libOpen, setLibOpen] = useState(false);

  /**
   * 커넥터 라이브러리의 연결 상태 — 옛 `workspace-settings.tsx`에서 그대로 옮겼다.
   *
   * `CONNECTOR_LIB`(`data/chat.ts`)는 **AI 대화가 부를 수 있는 외부 앱** 목록이고, 위
   * `EXTERNAL_SERVICES`(`data/org.ts`)는 **워크스페이스 알림·리포트 연동**이다. 이름이
   * 겹치지만(Slack·Gmail) 서로 다른 사실이라 상태도 따로 간다 — 여기서 커넥터를 연결해도
   * 위 목록은 바뀌지 않는다.
   *
   * ponytail: 두 목록을 한 화면에서 다루는 게 맞는지는 별개 판단이다. 이번 전환에서는
   * 원본 동작을 그대로 옮기기만 했다.
   */
  const [connectedApps, setConnectedApps] = useState<string[]>(() =>
    CONNECTOR_LIB.filter((c) => c.connected).map((c) => c.slug),
  );

  const connected = services.filter((s) => s.connected);
  const active = SYNC_RULES.filter((r) => r.status.tone !== "slate").length;

  function disconnect(id: string) {
    const name = services.find((s) => s.id === id)?.name ?? "서비스";
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, connected: false } : s)));
    showToast(`${name} 연결을 해제했어요`);
  }

  return (
    <>
      <SettingsSection
        title="외부 시스템"
        aside={<span className="text-xs text-slate-400">활성 {CONNECTORS.length}개</span>}
      >
        <SettingsRows tight>
          {CONNECTORS.map((c, i) => (
            <SettingsRow key={`${c.name}-${i}`}>
              <ActionRow
                name={
                  <>
                    {c.name}
                    <span className="ml-2 text-xs font-normal text-slate-400">{c.type}</span>
                  </>
                }
                value={c.system}
              >
                <Badge tone={c.status.tone}>{c.status.badge}</Badge>
              </ActionRow>
            </SettingsRow>
          ))}
        </SettingsRows>
        <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-400">
          <IconLock size={14} className="mt-0.5 shrink-0" />
          외부 시스템은 운영팀이 연결해 드려요. 추가하거나 바꿀 게 있으면 담당자에게 알려주세요.
        </p>
      </SettingsSection>

      <SettingsSection
        title="모듈 간 데이터 연동"
        aside={
          <span className="text-xs text-slate-400">
            동작 {active} · 비활성 {SYNC_RULES.length - active}
          </span>
        }
      >
        <SettingsRows tight>
          {SYNC_RULES.map((r, i) => (
            <SettingsRow key={i}>
              <ActionRow
                name={
                  <>
                    {r.from}
                    <span className="mx-1.5 font-normal text-slate-300">→</span>
                    {r.to}
                  </>
                }
                value={r.rule}
              >
                <Badge tone={r.status.tone}>{r.status.badge}</Badge>
              </ActionRow>
            </SettingsRow>
          ))}
        </SettingsRows>
      </SettingsSection>

      <SettingsSection
        title="외부 서비스"
        aside={<span className="text-xs text-slate-400">연결 {connected.length}개</span>}
      >
        {connected.length === 0 ? (
          <p className="py-6 text-center text-[13.5px] text-slate-400">
            연결된 서비스가 없어요. 아래 &lsquo;커넥터 연결&rsquo;에서 추가해 주세요.
          </p>
        ) : (
          <SettingsRows tight>
            {connected.map((svc) => (
              <SettingsRow key={svc.id}>
                <ActionRow
                  name={
                    <span className="flex items-center gap-2">
                      <BrandIcon slug={svc.icon} size={16} />
                      {svc.name}
                    </span>
                  }
                  value={`${svc.desc}${svc.account ? ` · ${svc.account}` : ""}`}
                >
                  <Badge tone="green">연결됨</Badge>
                  <Button variant="ghost" size="sm" onClick={() => disconnect(svc.id)}>
                    연결 해제
                  </Button>
                </ActionRow>
              </SettingsRow>
            ))}
          </SettingsRows>
        )}
        <SectionActions>
          <Button variant="secondary" size="sm" onClick={() => setLibOpen(true)}>
            <IconPlus size={14} />
            커넥터 연결
          </Button>
        </SectionActions>
      </SettingsSection>

      <ConnectorModal
        open={libOpen}
        onClose={() => setLibOpen(false)}
        connected={connectedApps}
        onConnect={(slug) => setConnectedApps((prev) => [...prev, slug])}
        onDisconnect={(slug) => setConnectedApps((prev) => prev.filter((x) => x !== slug))}
      />
      <Toast toast={toast} />
    </>
  );
}
