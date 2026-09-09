"use client";

/**
 * AI 대화 화면 — 배치와 화면 상태만 든다.
 *
 * 일하는 쪽은 훅 셋이다. 셋 다 이 폴더에 있고 이 화면에서만 쓴다.
 *   `use-conversations.ts`  대화(노트북) 저장소 — 목록 · 생성 · 열기 · 삭제 · 메시지
 *   `use-sources.ts`        소스 문서 — 올리기 · 지우기 · 열기 · 선택
 *   `use-ai-chat.ts`        턴 엔진 — 전송 · 편집 · 다시 시도 · 평가 · 승인
 *
 * 여기 남은 state 는 화면에만 있는 것들이다 — 입력창 글자, 열린 팝업, 출처 패널, 배경 전환, 실패 문구.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { IconPlus } from "@/components/icons";
import { ConnectorModal, SkillModal } from "@/components/connector-modal";
import { Button } from "@/components/ui";
import { AgentTrace } from "@/components/chat/agent-trace";
import { AiBackdrop } from "@/components/chat/ai-backdrop";
import { ChatComposer } from "@/components/chat/chat-composer";
import { AiMessage, UserMessage } from "@/components/chat/chat-message";
import { Markdown } from "@/components/chat/markdown";
import { ChatRail } from "@/components/chat/chat-rail";
import { OcrProposalCard } from "@/components/chat/ocr-proposal-card";
import { SourceDrawer } from "@/components/chat/source-drawer";
import { ToolApprovalCard } from "@/components/chat/tool-approval-card";
import { useConnectors } from "@/components/connector-provider";
import { useAiChat, type Failure } from "./use-ai-chat";
import { useConversations } from "./use-conversations";
import { useSources } from "./use-sources";

export default function AiChatPage() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<Failure | null>(null);
  /** 출처 패널 — open 이 false 여도 닫히는 동안 내용을 유지하다가 전환이 끝나면 비운다 */
  const [drawer, setDrawer] = useState<{ noteId: string; idx: number; open: boolean } | null>(null);
  const [connectorOpen, setConnectorOpen] = useState(false);
  const [skillOpen, setSkillOpen] = useState(false);
  /** 이 턴에 물린 스킬 id — 전송하면 비운다 */
  const [skills, setSkills] = useState<string[]>([]);
  /**
   * 이 대화에서 **꺼 둔** 앱 slug. 연결된 앱은 기본으로 켜져 있고, 칩을 끄면 여기 들어온다.
   * 켜진 목록이 아니라 끈 목록을 드는 이유: 연결 상태는 서버에서 비동기로 오고 설정 화면에서도 바뀐다.
   * 켜진 목록을 들면 새로 연결된 앱이 켜지지 않고, 끊긴 앱이 남는다. 끈 목록은 그 두 경우에 저절로 맞다.
   */
  const [mutedApps, setMutedApps] = useState<string[]>([]);
  /** 첫 화면 배경이 페이드아웃을 끝내고 내려갔는지. 빈 상태로 돌아오면 렌더 중에 되돌린다 */
  const [backdropGone, setBackdropGone] = useState(false);
  // 배경의 퇴장 완료 신호 — 신원이 매 렌더 바뀌면 안전장치 타이머가 계속 리셋된다
  const hideBackdrop = useCallback(() => setBackdropGone(true), []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /** 배경 중앙 블룸이 중심을 맞추는 기준 — 입력창은 첫 화면↔대화 전환에 세로로 미끄러진다 */
  const composerRef = useRef<HTMLDivElement>(null);

  /**
   * 연결된 앱 slug — 커넥터 팝업·입력창, 그리고 **설정 › 워크스페이스 › 연동**이 같은 값을 본다.
   * 화면 state 로 두면 설정에서 끊은 앱이 여기 그대로 남는다.
   */
  const { connected: linkedApps, registered, connect, disconnect } = useConnectors();
  /** 이번 대화에서 쓸 앱 = 연결된 앱 − 끈 앱. 서버에 apps 로 보낸다 */
  const enabledApps = linkedApps.filter((slug) => !mutedApps.includes(slug));

  const notice = (text: string) => setError({ kind: "notice", files: [], text });

  const nb = useConversations({
    fail: notice,
    onSwitch: () => {
      setDrawer(null);
      setError(null);
    },
  });
  const src = useSources({ nb, setError });
  const ai = useAiChat({
    nb,
    turnContext: { sources: nb.src.selected, skills, apps: enabledApps },
    setError,
  });

  const { active, notes, restored, activeId } = nb;
  const { pending, justArrived } = ai;
  const empty = !active || active.messages.length === 0;
  if (empty && backdropGone) setBackdropGone(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [active?.messages, pending?.noteId]);

  // 트레이스 펼침·본문 조각으로 본문이 자라는 동안 바닥에 붙어 따라간다 — 위로 올려 읽는 중이면 두지 않는다
  useEffect(() => {
    const el = scrollRef.current;
    const inner = innerRef.current;
    if (!el || !inner) return;
    const ro = new ResizeObserver(() => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
    });
    ro.observe(inner);
    return () => ro.disconnect();
  }, [restored]);

  async function send() {
    const q = input.trim();
    if (!q || pending) return;
    setInput("");
    if (await ai.send(q)) setSkills([]);
    else setInput(q);
  }

  /** 출처 패널 토글 — 같은 답변의 '출처'를 다시 누르면 닫히고, 다른 답변이면 내용만 갈아탄다 */
  function toggleDrawer(noteId: string, idx: number) {
    setDrawer((d) =>
      d?.open && d.noteId === noteId && d.idx === idx ? { ...d, open: false } : { noteId, idx, open: true },
    );
  }
  const closeDrawer = useCallback(() => setDrawer((d) => (d ? { ...d, open: false } : d)), []);
  const unmountDrawer = useCallback(() => setDrawer((d) => (d?.open ? d : null)), []);

  const last = active?.messages[active.messages.length - 1];
  const drawerMsg = drawer && drawer.noteId === active?.id ? active.messages[drawer.idx] : undefined;
  const shownError = error && (error.kind === "notice" || error.noteId === active?.id) ? error : null;
  /** 대화를 골랐는데 메시지를 아직 받는 중 — 스켈레톤을 둔다 */
  const loadingNote = !!active && !active.loaded;

  return (
    // 화면에 꽉 차는 앱 셸이라 문서가 스크롤될 일이 없다 — `h-dvh`로 모바일 브라우저 UI를 반영하고
    // `overflow-hidden`으로 어떤 이유로든(스크롤바 등장 등) 문서가 밀려 아래에 여백이 생기는 걸 막는다
    <div className="relative flex h-dvh overflow-hidden gap-3 bg-slate-50 p-3">
      {/* 첫 화면 배경 — 페이지 전체가 캔버스다. 레일·패널·대화가 그 위에 얹힌다.
          첫 메시지에 아래로 80px 미끄러지며 400ms에 빠지고, 새 대화로 돌아오면 아래에서 다시 올라온다 */}
      {restored && !backdropGone && (
        <AiBackdrop visible={empty && !loadingNote} onHidden={hideBackdrop} anchorRef={composerRef} />
      )}
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          void src.add(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      <ChatRail
        notes={notes}
        activeId={activeId}
        src={nb.src}
        onSelectNote={nb.show}
        onNewNote={nb.startNew}
        onDeleteNote={nb.remove}
        onToggleSource={(name) =>
          src.changeSelection((s) =>
            s.selected.includes(name) ? s.selected.filter((x) => x !== name) : [...s.selected, name],
          )
        }
        onToggleAll={() =>
          src.changeSelection((s) =>
            s.selected.length === s.sources.length ? [] : s.sources.map((d) => d.name),
          )
        }
        onAddSource={() => fileRef.current?.click()}
        onRemoveSource={src.remove}
        onOpenSource={(name) => void src.open(name)}
      />

      {/* ── 대화 — 카드 없이 배경을 그대로 캔버스로 쓴다 ── */}
      <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative flex items-center justify-between px-6 py-3.5">
          <h1 className="min-w-0 truncate text-[15px] font-bold text-slate-900">
            {active ? active.title : "AI대화"}
          </h1>
          <Button variant="secondary" size="sm" onClick={nb.startNew}>
            <IconPlus size={14} />새 대화
          </Button>
        </header>

        {!restored || loadingNote ? (
          // 서버에서 대화를 읽어오는 동안 — 빈 화면이 번쩍 지나가지 않게 스켈레톤을 둔다
          <div className="flex-1 px-5 py-5" role="status" aria-label="대화 불러오는 중">
            <div className="mx-auto max-w-3xl space-y-5">
              <div className="ml-auto h-10 w-2/5 animate-pulse rounded-2xl bg-slate-200/70" />
              <div className="h-24 w-4/5 animate-pulse rounded-2xl bg-slate-200/70" />
              <div className="ml-auto h-10 w-1/3 animate-pulse rounded-2xl bg-slate-200/70" />
            </div>
          </div>
        ) : (
          // 첫 화면과 대화가 같은 DOM이다 — 빈 상태면 아래 스페이서가 입력바를 세로 중앙에 세우고,
          // 첫 메시지에 300ms로 접혀 입력바가 바닥으로 미끄러진다
          <>
            <div ref={scrollRef} className="thin-scroll flex-1 overflow-y-auto px-5 py-5">
              <div ref={innerRef} className="mx-auto max-w-3xl space-y-5">
                {active?.messages.map((msg, i) =>
                  msg.role === "user" ? (
                    <UserMessage
                      key={msg.seq ?? `u${i}`}
                      msg={msg}
                      disabled={!!pending}
                      onEdit={(text) => ai.editUser(active.id, i, text)}
                    />
                  ) : (
                    <AiMessage
                      key={msg.seq ?? `a${i}`}
                      msg={msg}
                      last={i === active.messages.length - 1}
                      disabled={!!pending}
                      sourcesOpen={!!drawer?.open && drawer.noteId === active.id && drawer.idx === i}
                      justArrived={justArrived === active.id && i === active.messages.length - 1}
                      onRetry={() => ai.retry(active.id, i)}
                      onRate={(r) => ai.rate(active.id, i, r)}
                      onOpenSources={() => toggleDrawer(active.id, i)}
                    >
                      {msg.ocrProposal && (
                        <OcrProposalCard
                          proposal={msg.ocrProposal}
                          pending={!msg.ocrProposal.resolved}
                          onResolve={(approved) => ai.resolveOcr(active.id, i, approved)}
                          onUpdate={(fields) =>
                            nb.updateMessage(active.id, i, {
                              ocrProposal: { ...msg.ocrProposal!, fields },
                            })
                          }
                        />
                      )}
                      {msg.approvals?.map((a) => (
                        <ToolApprovalCard
                          key={a.approvalId}
                          approval={a}
                          disabled={!!pending}
                          onDecide={(approved) => ai.decideApproval(active.id, i, a.approvalId, approved)}
                        />
                      ))}
                    </AiMessage>
                  ),
                )}

                {/* 답변 생성 중 — 도구 행과 본문 조각이 도착하는 대로 살아 움직인다 */}
                {active && pending?.noteId === active.id && (
                  <div className="min-w-0 max-w-[85%]">
                    <AgentTrace working rows={pending.rows} label={pending.label} />
                    {pending.draft && (
                      <div className="text-base leading-relaxed text-slate-700">
                        <Markdown text={pending.draft} />
                      </div>
                    )}
                  </div>
                )}

                {/* 실패 — 문구 그대로 보여주고 같은 턴(또는 같은 파일)으로 다시 보낼 수 있게 */}
                {!pending && shownError && (
                  <p role="alert" className="flex items-center gap-2 text-[15px] text-slate-500">
                    {shownError.text}
                    {(shownError.kind === "turn" || shownError.files.length > 0) && (
                      <button
                        type="button"
                        onClick={() =>
                          void (shownError.kind === "turn"
                            ? ai.respond(shownError.noteId, shownError.turn, shownError.after)
                            : src.add(shownError.files))
                        }
                        className="cursor-pointer font-semibold text-slate-700 underline-offset-2 transition-colors hover:text-slate-900 hover:underline"
                      >
                        다시 시도
                      </button>
                    )}
                  </p>
                )}

                {/* 답변 중 새로고침·이탈로 끊긴 자리 — 마지막이 사용자 메시지면 다시 보낼 수 있게 */}
                {active && !pending && !shownError && last?.role === "user" && (
                  <p className="flex items-center gap-2 text-[15px] text-slate-500">
                    답변을 받지 못했어요.
                    <button
                      type="button"
                      onClick={() =>
                        ai.respond(active.id, {
                          message: last.text,
                          sources: nb.src.selected,
                          skills,
                          // 저장된 질문이면 그 자리를 덮어써 두 번 쌓이지 않게
                          replaceFromSeq: last.seq,
                        })
                      }
                      className="cursor-pointer font-semibold text-slate-700 underline-offset-2 transition-colors hover:text-slate-900 hover:underline"
                    >
                      다시 시도
                    </button>
                  </p>
                )}
              </div>
            </div>

            <div className="px-5 pb-4 pt-1">
              <div ref={composerRef} className="mx-auto max-w-3xl">
                <ChatComposer
                  value={input}
                  onChange={setInput}
                  onSend={() => void send()}
                  thinking={!!pending}
                  onAddSource={() => fileRef.current?.click()}
                  onOpenConnectors={() => setConnectorOpen(true)}
                  onOpenSkills={() => setSkillOpen(true)}
                  menuBelow={empty}
                  skills={skills}
                  onRemoveSkill={(id) => setSkills((prev) => prev.filter((x) => x !== id))}
                  linkedApps={linkedApps}
                  enabledApps={enabledApps}
                  onToggleApp={(slug) =>
                    setMutedApps((prev) =>
                      prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug],
                    )
                  }
                />
                <p className="mt-2 text-center text-[13px] text-slate-400">
                  AI는 실수를 할 수 있습니다. 중요한 정보는 재차 확인하세요.
                </p>
              </div>
            </div>
            <div
              aria-hidden
              className="transition-[flex] duration-300 ease-out"
              style={{ flex: empty ? "1 1 5rem" : "0 1 0px" }}
            />
          </>
        )}
      </section>

      {/* 출처 패널 — 대화 오른쪽에 docked. 열리고 닫힐 때 폭이 300ms로 미끄러지며 대화를 밀고 당긴다 */}
      {drawerMsg && (
        <SourceDrawer msg={drawerMsg} open={drawer!.open} onClose={closeDrawer} onClosed={unmountDrawer} />
      )}
      <ConnectorModal
        open={connectorOpen}
        onClose={() => setConnectorOpen(false)}
        // 팝업의 「연결됨」은 등록 기준이다 — 꺼 둔 앱도 연결된 앱이다. 켜기/끄기는 입력창의 칩이 한다
        connected={registered.map((r) => r.slug)}
        onConnect={(slug) => {
          // 제공자 동의 화면으로 떠난다. 돌아오면 연결된 앱은 기본으로 켜져 있다
          void connect(slug).catch(() => {});
        }}
        onDisconnect={(slug) => {
          void disconnect(slug).catch(() => {});
        }}
      />
      <SkillModal
        open={skillOpen}
        onClose={() => setSkillOpen(false)}
        selected={skills}
        onToggle={(id) =>
          setSkills((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
        }
      />
    </div>
  );
}
