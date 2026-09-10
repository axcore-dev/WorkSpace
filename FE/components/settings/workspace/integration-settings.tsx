"use client";

import { useEffect, useRef, useState } from "react";
import {
  ActionRow,
  SectionActions,
  SettingsRow,
  SettingsRows,
  SettingsSection,
} from "@/components/settings/settings-section";
import { BrandIcon } from "@/components/brand-icons";
import { ConnectorModal } from "@/components/connector-modal";
import {
  complete as completeConnector,
  fail as failConnector,
  useConnectors,
  type ConnectorNotice,
} from "@/components/connector-provider";
import { ApiRequestError } from "@/lib/api";
import { IconCheckCircle, IconPlus, IconX } from "@/components/icons";
import { Modal } from "@/components/modal";
import { Badge, Button, Toast, Toggle } from "@/components/ui";
import { useToast } from "@/components/use-toast";
import { CONNECTOR_LIB } from "@/data/chat";
import type { Tone } from "@/data/types";

/**
 * 워크스페이스 › 연동.
 *
 * **외부 시스템은 읽기 전용이다** — 운영팀이 연결해준다. 추가·설정 버튼을 두지 않고
 * 이름·시스템·상태만 보인다. 목록은 서버가 준다(`GET /api/workspace/connectors`).
 *
 * **외부 서비스는 세 상태다.** 등록(한 번 연결한 앱, 목록에 남는다) · 켜짐(토글, AI 가 지금 쓴다) · 해제(목록에서
 * 빠진다). 토글을 꺼도 앱은 비활성으로 남고, 다시 켤 때 재인증이 없다 — 제공자 토큰이 그 앱의 권한을 이미 덮는다.
 * 목록에서 지우는 것은 「커넥터 연결」 팝업의 「연결 해제」다. `/ai-chat` 과 같은 스토어(`useConnectors`)를 본다.
 *
 * **연결 결과는 모달로 알린다.** 제공자 동의 화면에서 돌아오면 콜백 화면은 아무것도 그리지 않고 여기로 오고,
 * 스토어에 남은 알림을 모달로 보인다 — 성공이면 「연결이 완료되었습니다」, 실패면 사유.
 *
 * **연결은 내 계정 단위다.** 구성원 누구나 자기 구글 계정을 연결하고, AI 는 그 사람의 연결만 쓴다. 남이 연결한 것은
 * 내 목록에 보이지 않는다. 그래서 별도 권한이 없고 서버의 `editable` 은 늘 참이다.
 */

/** 서버의 status → 화면 배지. 문구·색을 화면이 정한다 (DB 에는 ok · delayed · down 만 있다) */
const STATUS: Record<string, { badge: string; tone: Tone }> = {
  ok: { badge: "정상", tone: "green" },
  delayed: { badge: "지연", tone: "amber" },
  down: { badge: "끊김", tone: "red" },
};

const PROVIDER_NAMES: Record<string, string> = { google: "Google", slack: "Slack", notion: "Notion" };

const nameOf = (slug: string) => CONNECTOR_LIB.find((c) => c.slug === slug)?.name ?? slug;

export function IntegrationSettings() {
  const [toast, showToast] = useToast();
  const [libOpen, setLibOpen] = useState(false);
  const { registered, systems, accounts, editable, notice, connect, setEnabled, disconnect, dismissNotice } =
    useConnectors();

  /**
   * 구글이 이 화면으로 **바로** 돌려보낸 경우(GOOGLE_CONNECTOR_REDIRECT_URI 가 이 주소일 때). 주소의 code·state 를
   * 서버에 넘겨 마무리하고 주소를 지운다 — 중간 화면이 없다. state 는 서버가 서명한 값이라 여기서 검증하지 않는다.
   * StrictMode 가 effect 를 두 번 돌려도 code 는 한 번만 쓴다.
   */
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const q = new URLSearchParams(window.location.search);
    const state = q.get("state") ?? "";
    if (!state.startsWith("cn.")) return;
    const slug = state.slice(3).split(".")[0] ?? "";
    const code = q.get("code");
    // 주소를 먼저 지운다 — 새로고침해도 code 를 두 번 보내지 않게
    window.history.replaceState({}, "", window.location.pathname);
    void (async () => {
      if (!code || q.get("error")) {
        failConnector(slug, "연결을 취소했거나 제공자가 코드를 주지 않았어요");
        return;
      }
      try {
        await completeConnector(slug, code, state);
      } catch (e: unknown) {
        failConnector(slug, e instanceof ApiRequestError ? e.message : "연결을 마치지 못했어요");
      }
    })();
  }, []);

  /** 등록된 앱을 카탈로그 순서로. 꺼진 것도 그린다 */
  const listed = CONNECTOR_LIB.filter((c) => registered.some((r) => r.slug === c.slug));
  const enabledCount = registered.filter((r) => r.enabled).length;
  const registeredSlugs = registered.map((r) => r.slug);

  /** 저장 결과를 토스트로. 실패는 에러 톤으로 */
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
        aside={
          <span className="text-xs text-slate-400">
            {listed.length}개 등록 · {enabledCount}개 사용 중
          </span>
        }
      >
        {/* 어느 계정으로 연결됐는지. 구글 앱 넷이 같은 계정 하나를 쓴다는 사실이 여기서 보인다. 토큰은 절대 화면에 오지 않는다 */}
        {accounts.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 text-xs text-slate-500">
            {accounts.map((a) => (
              <li key={a.provider} className="flex items-center gap-2">
                <span className="font-medium text-slate-700">{PROVIDER_NAMES[a.provider] ?? a.provider}</span>
                {a.externalAccount && <span className="font-mono">{a.externalAccount}</span>}
                {a.needsReconnect && <Badge tone="amber">다시 연결 필요</Badge>}
              </li>
            ))}
          </ul>
        )}
        {listed.length === 0 ? (
          <p className="py-6 text-center text-[13.5px] text-slate-400">
            연결된 서비스가 없어요. 아래 &lsquo;커넥터 연결&rsquo;에서 추가해 주세요.
          </p>
        ) : (
          <SettingsRows tight>
            {listed.map((svc) => {
              const on = registered.find((r) => r.slug === svc.slug)?.enabled ?? false;
              return (
                <SettingsRow key={svc.slug}>
                  {/* 꺼진 앱은 흐리게 — 사라지지 않는다. 다시 켜면 재인증 없이 바로 쓴다 */}
                  <div className={on ? "" : "opacity-55"}>
                    <ActionRow
                      name={
                        <span className="flex items-center gap-2">
                          <BrandIcon slug={svc.slug} size={16} />
                          {svc.name}
                          {!on && <Badge tone="slate">사용 안 함</Badge>}
                        </span>
                      }
                      value={svc.desc}
                    >
                      <Toggle
                        checked={on}
                        onChange={(v) =>
                          report(setEnabled(svc.slug, v), `${svc.name}을 ${v ? "켰어요" : "껐어요"}`)
                        }
                        label={`${svc.name} 사용`}
                        disabled={!editable}
                      />
                    </ActionRow>
                  </div>
                </SettingsRow>
              );
            })}
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
        connected={registeredSlugs}
        onConnect={(slug) => report(connect(slug), `${nameOf(slug)}을 연결했어요`)}
        onDisconnect={(slug) => report(disconnect(slug), `${nameOf(slug)} 연결을 해제했어요`)}
      />
      <ConnectorNoticeModal notice={notice} onClose={dismissNotice} />
      <Toast toast={toast} />
    </>
  );
}

/**
 * 연결 시도의 결과 모달. 제공자 동의 화면에서 돌아온 직후 한 번 뜬다.
 * 성공·실패 모두 같은 자리에서 알린다 — 다른 화면으로 튀지 않는다.
 */
function ConnectorNoticeModal({ notice, onClose }: { notice: ConnectorNotice | null; onClose: () => void }) {
  if (!notice) return null;
  const name = nameOf(notice.slug);
  return (
    <Modal open onClose={onClose} size="sm">
      <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
        {notice.ok ? (
          <IconCheckCircle size={40} className="text-emerald-600" />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
            <IconX size={22} />
          </span>
        )}
        <p className="mt-3 text-base font-bold text-slate-900">
          {notice.ok ? "연결이 완료되었습니다" : "연결하지 못했습니다"}
        </p>
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">
          {notice.ok ? `${name}을(를) 내 계정에 연결했어요. AI 대화에서 바로 쓸 수 있어요.` : notice.message}
        </p>
        <Button className="mt-6" onClick={onClose}>
          확인
        </Button>
      </div>
    </Modal>
  );
}
