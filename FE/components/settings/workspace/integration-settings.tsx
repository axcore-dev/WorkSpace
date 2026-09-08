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
import { IconPlus } from "@/components/icons";
import { Badge, Button, Toast, Toggle } from "@/components/ui";
import { useToast } from "@/components/use-toast";
import { CONNECTOR_LIB } from "@/data/chat";
import type { Tone } from "@/data/types";

/**
 * 워크스페이스 › 연동.
 *
 * **외부 시스템은 읽기 전용이다** — 운영팀이 연결해준다. 추가·설정 버튼을 두지 않고
 * 이름·시스템·상태만 보인다. 안내 문구는 뺐다 — 배지가 이미 상태를 말하고, 바꿀 수 없다는
 * 건 버튼이 없다는 것으로 충분하다. 목록은 서버가 준다(`GET /api/workspace/connectors`) —
 * 아직 등록된 게 없으면 빈 자리를 그대로 보인다.
 *
 * **외부 서비스는 `/ai-chat`과 같은 상태를 본다** (수정요청 v12). 둘 다 커넥터를 가리키고
 * 상태는 `useConnectors()` 하나에서 나온다 — 여기서 끄면 AI 대화 입력창의 칩도 사라진다.
 * 연결·해제는 **연동 관리 권한**이 있어야 한다. 없으면 토글이 잠긴다 — 서버도 같은 규칙으로
 * 거절한다(403). 화면 잠금은 보안 경계가 아니다.
 *
 * `모듈 간 데이터 연동` 섹션은 뺐다 (수정요청 v12).
 */

/** 서버의 status → 화면 배지. 문구·색을 화면이 정한다 (DB 에는 ok · delayed · down 만 있다) */
const STATUS: Record<string, { badge: string; tone: Tone }> = {
  ok: { badge: "정상", tone: "green" },
  delayed: { badge: "지연", tone: "amber" },
  down: { badge: "끊김", tone: "red" },
};

export function IntegrationSettings() {
  const [toast, showToast] = useToast();
  const [libOpen, setLibOpen] = useState(false);
  const { connected, systems, editable, connect, disconnect } = useConnectors();

  /** 연결된 것만 목록에 보인다 — 라이브러리 전체는 `커넥터 연결` 팝업이 보여준다 */
  const linked = CONNECTOR_LIB.filter((c) => connected.includes(c.slug));

  /** 저장 결과를 토스트로. 실패는 스토어가 되돌린 뒤 에러 톤으로 */
  function report(saving: Promise<void>, done: string) {
    saving.then(
      () => showToast(done),
      (e: unknown) =>
        showToast(e instanceof Error && e.message ? e.message : "저장하지 못했어요", "error"),
    );
  }

  function toggle(slug: string, on: boolean) {
    const name = CONNECTOR_LIB.find((c) => c.slug === slug)?.name ?? "서비스";
    report(on ? connect(slug) : disconnect(slug), `${name}${on ? "을 연결했어요" : " 연결을 해제했어요"}`);
  }

  return (
    <>
      <SettingsSection
        title="외부 시스템"
        aside={<span className="text-xs text-slate-400">활성 {systems.length}개</span>}
      >
        {systems.length === 0 ? (
          <p className="py-6 text-center text-[13.5px] text-slate-400">
            연결된 외부 시스템이 없어요. ERP·MES 연결은 운영팀이 등록해 드려요.
          </p>
        ) : (
          <SettingsRows tight>
            {systems.map((c) => {
              const st = STATUS[c.status] ?? { badge: c.status, tone: "slate" as Tone };
              return (
                <SettingsRow key={c.id}>
                  <ActionRow
                    name={
                      <>
                        {c.name}
                        <span className="ml-2 text-xs font-normal text-slate-400">{c.kind}</span>
                      </>
                    }
                    value={c.vendor}
                  >
                    <Badge tone={st.tone}>{st.badge}</Badge>
                  </ActionRow>
                </SettingsRow>
              );
            })}
          </SettingsRows>
        )}
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
                    disabled={!editable}
                  />
                </ActionRow>
              </SettingsRow>
            ))}
          </SettingsRows>
        )}
        {editable && (
          <SectionActions>
            <Button variant="secondary" size="sm" onClick={() => setLibOpen(true)}>
              <IconPlus size={14} />
              커넥터 연결
            </Button>
          </SectionActions>
        )}
      </SettingsSection>

      <ConnectorModal
        open={libOpen}
        onClose={() => setLibOpen(false)}
        connected={connected}
        onConnect={(slug) => toggle(slug, true)}
        onDisconnect={(slug) => toggle(slug, false)}
      />
      <Toast toast={toast} />
    </>
  );
}
