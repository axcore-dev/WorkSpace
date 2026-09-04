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
import { useConnectors } from "@/components/connector-provider";
import { IconLock, IconPlus } from "@/components/icons";
import { Badge, Button, Toast, Toggle } from "@/components/ui";
import { useToast } from "@/components/use-toast";
import { CONNECTOR_LIB } from "@/data/chat";
import { CONNECTORS } from "@/data/org";

/**
 * 워크스페이스 › 연동.
 *
 * **외부 시스템은 읽기 전용이다** — 운영팀이 연결해준다. 추가·설정 버튼을 두지 않고
 * 이름·시스템·상태만 보인다. 버튼 없는 목록은 고장으로 읽히므로 안내 한 줄은 남긴다
 * (계정 페이지의 문구 제거 규칙은 계정에만 적용한다).
 *
 * **외부 서비스는 `/ai-chat`과 같은 상태를 본다** (수정요청 v12). 예전에는 이 화면이
 * `EXTERNAL_SERVICES`(워크스페이스 알림·리포트 연동)를 그리는데 아래 `커넥터 연결` 버튼은
 * `CONNECTOR_LIB`(AI 대화가 부를 수 있는 외부 앱)를 열어서, 한 화면에 다른 사실 둘이
 * 있었다. 이제 둘 다 커넥터를 가리키고 상태는 `useConnectors()` 하나에서 나온다 —
 * 여기서 끄면 AI 대화 입력창의 칩도 사라진다.
 *
 * `모듈 간 데이터 연동` 섹션은 뺐다 (수정요청 v12).
 *
 * **BE 연동 seam**: 커넥터 연결·해제 API가 생기면 `lib/connector-state.ts`가 그걸 부르고,
 * 실패하면 상태를 되돌리고 `showToast(문구, "error")`로 알린다.
 */
export function IntegrationSettings() {
  const [toast, showToast] = useToast();
  const [libOpen, setLibOpen] = useState(false);
  const { connected, connect, disconnect } = useConnectors();

  /** 연결된 것만 목록에 보인다 — 라이브러리 전체는 `커넥터 연결` 팝업이 보여준다 */
  const linked = CONNECTOR_LIB.filter((c) => connected.includes(c.slug));

  function toggle(slug: string, on: boolean) {
    const name = CONNECTOR_LIB.find((c) => c.slug === slug)?.name ?? "서비스";
    if (on) {
      connect(slug);
      showToast(`${name}을 연결했어요`);
    } else {
      disconnect(slug);
      showToast(`${name} 연결을 해제했어요`);
    }
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
        title="외부 서비스"
        aside={<span className="text-xs text-slate-400">연결 {linked.length}개</span>}
      >
        {linked.length === 0 ? (
          <p className="py-6 text-center text-[13.5px] text-slate-400">
            연결된 서비스가 없어요. 아래 &lsquo;커넥터 연결&rsquo;에서 추가해 주세요.
          </p>
        ) : (
          <SettingsRows tight>
            {linked.map((svc) => (
              <SettingsRow key={svc.slug}>
                <ActionRow
                  name={
                    <span className="flex items-center gap-2">
                      <BrandIcon slug={svc.slug} size={16} />
                      {svc.name}
                    </span>
                  }
                  value={svc.desc}
                >
                  {/* 배지가 아니라 토글이다 — 끄면 그 자리에서 연결이 끊긴다.
                      AI 대화 입력창의 칩("이번 대화에서 쓸까")과는 다른 사실이다. */}
                  <Toggle
                    checked
                    onChange={(v) => toggle(svc.slug, v)}
                    label={`${svc.name} 연결`}
                  />
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
        connected={connected}
        onConnect={connect}
        onDisconnect={disconnect}
      />
      <Toast toast={toast} />
    </>
  );
}
