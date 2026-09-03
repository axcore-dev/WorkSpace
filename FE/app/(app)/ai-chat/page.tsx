"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconPlus } from "@/components/icons";
import { ConnectorModal, SkillModal } from "@/components/connector-modal";
import { Button } from "@/components/ui";
import { AgentTrace } from "@/components/chat/agent-trace";
import { AiBackdrop } from "@/components/chat/ai-backdrop";
import { ChatComposer } from "@/components/chat/chat-composer";
import { AiMessage, UserMessage } from "@/components/chat/chat-message";
import { ChatRail } from "@/components/chat/chat-rail";
import { OcrProposalCard } from "@/components/chat/ocr-proposal-card";
import { SourceDrawer } from "@/components/chat/source-drawer";
import { ApiRequestError } from "@/lib/api";
import { streamChat, uploadSources, type ChatRequest } from "@/lib/chat-api";
import { loadChat, saveChat } from "@/lib/chat-storage";
import type { ChatMessage, Note, SourceState, TraceStep } from "@/data/chat";

const EMPTY_SRC: SourceState = { sources: [], selected: [] };

/** 답변 생성 중 상태 — 한 번에 한 대화만. SSE로 문구·도구 행·본문 조각이 흘러들고 message로 굳는다 */
interface Pending {
  noteId: number;
  rows: TraceStep[];
  /** 헤더에 흐르는 추론 문구 */
  label: string;
  /** 지금까지 받은 본문 조각 — 답변이 굳기 전에 그대로 보여준다 */
  draft: string;
}

/** 한 턴의 내용 — 질문 또는 제안 승인. 다시 시도는 같은 턴을 다시 보낸다 */
type Turn = Pick<ChatRequest, "message" | "action">;

/** 실패 한 건 — 대화 영역에 문구와 다시 시도로 뜬다. 턴 실패는 그 대화에서만, 업로드 실패는 어디서나 보인다 */
type Failure = { text: string } & (
  | { kind: "turn"; noteId: number; turn: Turn }
  | { kind: "upload"; files: File[] }
);

export default function AiChatPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<Failure | null>(null);
  /** 타자 효과를 재생할 대화 id — 답변이 delta 없이 한 번에 도착했을 때만 */
  const [streaming, setStreaming] = useState<number | null>(null);
  /**
   * 방금 답변이 붙은 대화 id — 그 답변의 트레이스가 펼친 상태로 마운트해 접히는 전환을 재생한다.
   * 작업 중 트레이스는 답변이 붙는 순간 언마운트되므로 이 신호 없이는 행이 그냥 사라진다.
   */
  const [justArrived, setJustArrived] = useState<number | null>(null);
  /** 출처 패널 — open이 false여도 닫히는 동안 내용을 유지하다가 전환이 끝나면 비운다 */
  const [drawer, setDrawer] = useState<{
    noteId: number;
    idx: number;
    open: boolean;
  } | null>(null);
  const [connectorOpen, setConnectorOpen] = useState(false);
  const [skillOpen, setSkillOpen] = useState(false);
  /** 이 턴에 물린 스킬 id — 전송하면 비운다 */
  const [skills, setSkills] = useState<string[]>([]);
  /** 첫 대화 생성 전(시작 화면)의 소스 — 첫 대화가 이 상태를 승계한다 */
  const [draftSrc, setDraftSrc] = useState<SourceState>(EMPTY_SRC);
  /** localStorage 복원이 끝나기 전에는 저장하지 않는다 — 빈 상태로 덮어쓰는 걸 막는다 */
  const [restored, setRestored] = useState(false);
  /** 첫 화면 배경이 페이드아웃을 끝내고 내려갔는지. 빈 상태로 돌아오면 렌더 중에 되돌린다 */
  const [backdropGone, setBackdropGone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /** 배경 중앙 블룸이 중심을 맞추는 기준 — 입력창은 첫 화면↔대화 전환에 세로로 미끄러진다 */
  const composerRef = useRef<HTMLDivElement>(null);
  const noteSeq = useRef(1);
  /** 진행 중인 스트림 — 페이지를 떠나면 끊는다. 답변이 붙지 않은 사용자 메시지는 복귀 시 '다시 시도'로 이어진다 */
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const active = notes.find((n) => n.id === activeId) ?? null;

  // 표시 중인 소스 상태 — 활성 대화(노트북)의 것, 없으면 시작 화면 초안
  const src = active?.src ?? draftSrc;
  const { sources, selected: selectedSources } = src;

  /** 소스 상태 변경 — 활성 대화가 있으면 그 대화에, 없으면 초안에 반영한다 */
  function patchSrc(patch: (s: SourceState) => SourceState) {
    if (active) {
      setNotes((prev) =>
        prev.map((n) => (n.id === active.id ? { ...n, src: patch(n.src) } : n)),
      );
    } else {
      setDraftSrc((prev) => patch(prev));
    }
  }

  // 저장된 대화 복원 — 마운트 후 1회.
  // useState의 lazy initializer로 읽으면 서버(빈 값)와 클라이언트(저장 값)가 갈려 hydration이 깨진다.
  // 외부 저장소에서 초기 상태를 끌어오는 자리라 effect가 맞고, 마운트 1회뿐이라 연쇄 렌더가 없다.
  /* eslint-disable react-hooks/set-state-in-effect -- localStorage 복원은 hydration 이후에만 가능하다 */
  useEffect(() => {
    const saved = loadChat<Note>();
    if (saved?.notes.length) {
      setNotes(saved.notes);
      setActiveId(saved.activeId);
      // id가 겹치면 기존 대화를 덮어쓰므로 다음 번호를 최대값 뒤로 밀어둔다
      noteSeq.current = Math.max(...saved.notes.map((n) => n.id), 1);
    }
    setRestored(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (restored) saveChat<Note>({ notes, activeId });
  }, [notes, activeId, restored]);

  const empty = !active || active.messages.length === 0;
  if (empty && backdropGone) setBackdropGone(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [active?.messages, pending?.noteId]);

  // 타자 효과·트레이스 펼침·본문 조각으로 본문이 자라는 동안 바닥에 붙어 따라간다 — 위로 올려 읽는 중이면 두지 않는다
  useEffect(() => {
    const el = scrollRef.current;
    const inner = innerRef.current;
    if (!el || !inner) return;
    const ro = new ResizeObserver(() => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 160)
        el.scrollTop = el.scrollHeight;
    });
    ro.observe(inner);
    return () => ro.disconnect();
  }, [restored]);

  /** 보는 대화를 바꾼다 — 타자 효과·출처 패널·실패 문구는 대화에 묶여 있으니 함께 접는다 */
  function showNote(id: number | null) {
    setActiveId(id);
    setStreaming(null);
    setDrawer(null);
    setError(null);
  }

  function createNote(title = "새 대화", srcInit?: SourceState): number {
    const id = ++noteSeq.current;
    // 시작 화면에서 자동 생성되는 첫 대화는 화면에 보이던 소스(초안)를 승계한다
    const s = srcInit ?? (active ? EMPTY_SRC : draftSrc);
    setNotes((prev) => [...prev, { id, title, messages: [], src: s }]);
    showNote(id);
    return id;
  }

  /** 새 대화 = 새 노트북 생성 — 소스 없이 빈 상태로 시작한다 */
  function startNewNote() {
    createNote("새 대화", EMPTY_SRC);
  }

  /** 대화 삭제 — 지운 게 보고 있던 대화면 가장 최근 것으로 옮겨간다 */
  function deleteNote(id: number) {
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      if (id === activeId)
        showNote(next.length ? next[next.length - 1].id : null);
      return next;
    });
  }

  /** 직전 대화의 소스를 현재 빈 대화로 복사한다 — 새 대화마다 다시 고르는 수고를 던다 */
  function inheritSources() {
    const prev = notes
      .filter((n) => n.id !== activeId && n.src.sources.length > 0)
      .pop();
    if (!prev) return;
    patchSrc(() => ({
      sources: prev.src.sources.map((d) => ({ ...d })),
      selected: [...prev.src.selected],
    }));
  }

  const canInherit = notes.some(
    (n) => n.id !== activeId && n.src.sources.length > 0,
  );

  /** 비어 있는 '새 대화' 노트북에 첫 활동이 생기면 제목을 붙인다 — 대화 기록에서 구분되도록 */
  function nameNoteIfUntitled(id: number, title: string) {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id && n.title === "새 대화" && n.messages.length === 0
          ? { ...n, title }
          : n,
      ),
    );
  }

  function appendMessage(noteId: number, msg: ChatMessage) {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId ? { ...n, messages: [...n.messages, msg] } : n,
      ),
    );
  }

  function updateMessage(
    noteId: number,
    msgIdx: number,
    patch: Partial<ChatMessage>,
  ) {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId
          ? {
              ...n,
              messages: n.messages.map((m, i) =>
                i === msgIdx ? { ...m, ...patch } : m,
              ),
            }
          : n,
      ),
    );
  }

  /** len 뒤를 잘라낸다 — 다시 시도로 답변을 새로 만들 때 */
  function truncate(noteId: number, len: number) {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId ? { ...n, messages: n.messages.slice(0, len) } : n,
      ),
    );
  }

  /**
   * 한 턴을 BE에 보내고 스트림을 끝까지 받는다 — 전송·편집·다시 시도·제안 승인이 모두 여기로 모인다.
   * 흘러드는 문구·도구 행·본문 조각은 pending에 쌓이고, 최종 답변이 오면 메시지로 굳는다. 성공 여부를 돌려준다.
   */
  async function respond(nid: number, turn: Turn): Promise<boolean> {
    const ac = new AbortController();
    abortRef.current = ac;
    let streamed = false;
    setError(null);
    setPending({
      noteId: nid,
      rows: [],
      label: "질문의 의도를 파악하고 있어요",
      draft: "",
    });
    const patch = (f: (p: Pending) => Pending) =>
      setPending((p) => (p?.noteId === nid ? f(p) : p));
    try {
      const msg = await streamChat(
        { conversationId: nid, sources: selectedSources, skills, ...turn },
        {
          onLabel: (label) => patch((p) => ({ ...p, label })),
          onTrace: (row) => patch((p) => ({ ...p, rows: [...p.rows, row] })),
          onDelta: (text) => {
            streamed = true;
            patch((p) => ({ ...p, draft: p.draft + text }));
          },
        },
        ac.signal,
      );
      appendMessage(nid, msg);
      // 본문이 이미 조각으로 흘러왔으면 타자 효과를 다시 틀지 않는다
      setStreaming(streamed ? null : nid);
      setJustArrived(nid);
      // 접히는 전환(300ms)이 끝나면 신호를 내린다 — 대화를 다시 열 때 또 접히지 않게
      setTimeout(() => setJustArrived((n) => (n === nid ? null : n)), 400);
      setPending(null);
      return true;
    } catch (e) {
      if (ac.signal.aborted) return false;
      setPending(null);
      setError({
        kind: "turn",
        noteId: nid,
        turn,
        text: e instanceof ApiRequestError ? e.message : "답변을 받지 못했어요",
      });
      return false;
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
    }
  }

  function send() {
    const q = input.trim();
    if (!q || pending) return;
    const title = q.length > 18 ? q.slice(0, 18) + "…" : q;
    const nid = activeId ?? createNote(title);
    setInput("");
    nameNoteIfUntitled(nid, title);
    appendMessage(nid, { role: "user", text: q });
    void respond(nid, { message: q });
    setSkills([]);
  }

  /** 사용자 메시지 제자리 편집 — 그 뒤 답변을 버리고 다시 생성한다 */
  function editUser(noteId: number, idx: number, text: string) {
    const old = notes.find((n) => n.id === noteId)?.messages[idx];
    if (!old || pending) return;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId
          ? { ...n, messages: [...n.messages.slice(0, idx), { ...old, text }] }
          : n,
      ),
    );
    void respond(noteId, { message: text });
  }

  /** 답변 다시 시도 — 바로 앞 사용자 메시지로 다시 답한다 */
  function retry(noteId: number, aiIdx: number) {
    const u = notes.find((n) => n.id === noteId)?.messages[aiIdx - 1];
    if (!u || u.role !== "user" || pending) return;
    truncate(noteId, aiIdx);
    void respond(noteId, { message: u.text });
  }

  /** 응답 평가 — 같은 걸 다시 누르면 해제. 추후 성능 평가 데이터로 보낸다 */
  function rate(noteId: number, idx: number, r: "up" | "down") {
    const cur = notes.find((n) => n.id === noteId)?.messages[idx]?.rating;
    updateMessage(noteId, idx, { rating: cur === r ? undefined : r });
  }

  /** 소스 추가 — BE에 올리고 돌아온 문서 메타를 목록 상단에 추가·선택한다. 실패하면 같은 파일로 다시 시도할 수 있다 */
  async function addSourceFiles(files: File[]) {
    const fresh = files.filter((f) => !sources.some((s) => s.name === f.name));
    if (!fresh.length) return;
    setError(null);
    try {
      const docs = await uploadSources(fresh);
      patchSrc((s) => ({
        sources: [
          ...docs.filter((d) => !s.sources.some((x) => x.name === d.name)),
          ...s.sources,
        ],
        selected: [...new Set([...s.selected, ...docs.map((d) => d.name)])],
      }));
    } catch (e) {
      setError({
        kind: "upload",
        files: fresh,
        text:
          e instanceof ApiRequestError ? e.message : "소스를 올리지 못했어요",
      });
    }
  }

  /** 소스 삭제 — 목록·선택에서 함께 제거 */
  function removeSource(name: string) {
    patchSrc((s) => ({
      sources: s.sources.filter((d) => d.name !== name),
      selected: s.selected.filter((n) => n !== name),
    }));
  }

  /**
   * 발주서 제안 승인/취소 — 승인은 BE에 반영을 요청하고 답이 오면 카드를 resolved로 굳힌다(실패하면 버튼이 남아 다시 누를 수 있다).
   * 취소는 바로 굳힌다. resolved는 메시지에 남아 새로고침 뒤에도 버튼이 되살아나지 않는다.
   */
  async function resolveOcr(noteId: number, idx: number, approved: boolean) {
    const proposal = notes.find((n) => n.id === noteId)?.messages[idx]
      ?.ocrProposal;
    if (!proposal || pending) return;
    const resolve = () =>
      updateMessage(noteId, idx, {
        ocrProposal: { ...proposal, resolved: true },
      });
    if (!approved) {
      resolve();
      appendMessage(noteId, {
        role: "ai",
        text: "반영을 취소했어요. 문서는 소스로만 보관돼요.",
      });
      return;
    }
    if (
      await respond(noteId, {
        message: "",
        action: { type: "approve-proposal", proposal },
      })
    )
      resolve();
  }

  /** 출처 패널 토글 — 같은 답변의 '출처'를 다시 누르면 닫히고, 다른 답변이면 내용만 갈아탄다 */
  function toggleDrawer(noteId: number, idx: number) {
    setDrawer((d) =>
      d?.open && d.noteId === noteId && d.idx === idx
        ? { ...d, open: false }
        : { noteId, idx, open: true },
    );
  }

  const stopStreaming = useCallback(() => setStreaming(null), []);
  const closeDrawer = useCallback(
    () => setDrawer((d) => (d ? { ...d, open: false } : d)),
    [],
  );
  const unmountDrawer = useCallback(
    () => setDrawer((d) => (d?.open ? d : null)),
    [],
  );

  const composer = (
    <ChatComposer
      value={input}
      onChange={setInput}
      onSend={send}
      thinking={!!pending}
      onAddSource={() => fileRef.current?.click()}
      onOpenConnectors={() => setConnectorOpen(true)}
      onOpenSkills={() => setSkillOpen(true)}
      menuBelow={empty}
      skills={skills}
      onRemoveSkill={(id) => setSkills((prev) => prev.filter((x) => x !== id))}
    />
  );
  const disclaimer = (
    <p className="mt-2 text-center text-[13px] text-slate-400">
      AI는 실수를 할 수 있습니다. 중요한 정보는 재차 확인하세요.
    </p>
  );

  const last = active?.messages[active.messages.length - 1];
  const drawerMsg =
    drawer && drawer.noteId === active?.id
      ? active.messages[drawer.idx]
      : undefined;
  const shownError =
    error && (error.kind === "upload" || error.noteId === active?.id)
      ? error
      : null;

  return (
    // 화면에 꽉 차는 앱 셸이라 문서가 스크롤될 일이 없다 — `h-dvh`로 모바일 브라우저 UI를 반영하고
    // `overflow-hidden`으로 어떤 이유로든(스크롤바 등장 등) 문서가 밀려 아래에 여백이 생기는 걸 막는다
    <div className="relative flex h-dvh overflow-hidden gap-3 bg-slate-50 p-3">
      {/* 첫 화면 배경 — 페이지 전체가 캔버스다. 레일·패널·대화가 그 위에 얹힌다.
          첫 메시지에 아래로 80px 미끄러지며 400ms에 빠지고, 새 대화로 돌아오면 아래에서 다시 올라온다 */}
      {restored && !backdropGone && (
        <AiBackdrop
          visible={empty}
          onHidden={() => setBackdropGone(true)}
          anchorRef={composerRef}
        />
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
          void addSourceFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      <ChatRail
        notes={notes}
        activeId={activeId}
        src={src}
        onSelectNote={showNote}
        onNewNote={startNewNote}
        onDeleteNote={deleteNote}
        onToggleSource={(name) =>
          patchSrc((s) => ({
            ...s,
            selected: s.selected.includes(name)
              ? s.selected.filter((x) => x !== name)
              : [...s.selected, name],
          }))
        }
        onToggleAll={() =>
          patchSrc((s) => ({
            ...s,
            selected:
              s.selected.length === s.sources.length
                ? []
                : s.sources.map((d) => d.name),
          }))
        }
        onAddSource={() => fileRef.current?.click()}
        onRemoveSource={removeSource}
        onInheritSources={inheritSources}
        canInherit={canInherit}
      />

      {/* ── 대화 — 카드 없이 배경을 그대로 캔버스로 쓴다 ── */}
      <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative flex items-center justify-between px-6 py-3.5">
          <h1 className="min-w-0 truncate text-[15px] font-bold text-slate-900">
            {active ? active.title : "AI대화"}
          </h1>
          <Button variant="secondary" size="sm" onClick={startNewNote}>
            <IconPlus size={14} />새 대화
          </Button>
        </header>

        {!restored ? (
          // 저장된 대화를 읽어오는 동안 — 빈 화면이 번쩍 지나가지 않게 스켈레톤을 둔다
          <div
            className="flex-1 px-5 py-5"
            role="status"
            aria-label="대화 불러오는 중"
          >
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
            <div
              ref={scrollRef}
              className="thin-scroll flex-1 overflow-y-auto px-5 py-5"
            >
              <div ref={innerRef} className="mx-auto max-w-3xl space-y-5">
                {active?.messages.map((msg, i) =>
                  msg.role === "user" ? (
                    <UserMessage
                      key={i}
                      msg={msg}
                      disabled={!!pending}
                      onEdit={(text) => editUser(active.id, i, text)}
                    />
                  ) : (
                    <AiMessage
                      key={i}
                      msg={msg}
                      last={i === active.messages.length - 1}
                      streaming={
                        streaming === active.id &&
                        i === active.messages.length - 1
                      }
                      disabled={!!pending}
                      sourcesOpen={
                        !!drawer?.open &&
                        drawer.noteId === active.id &&
                        drawer.idx === i
                      }
                      justArrived={
                        justArrived === active.id &&
                        i === active.messages.length - 1
                      }
                      onStreamDone={stopStreaming}
                      onRetry={() => retry(active.id, i)}
                      onRate={(r) => rate(active.id, i, r)}
                      onOpenSources={() => toggleDrawer(active.id, i)}
                    >
                      {msg.ocrProposal && (
                        <OcrProposalCard
                          proposal={msg.ocrProposal}
                          pending={!msg.ocrProposal.resolved}
                          onResolve={(approved) =>
                            void resolveOcr(active.id, i, approved)
                          }
                          onUpdate={(fields) =>
                            updateMessage(active.id, i, {
                              ocrProposal: { ...msg.ocrProposal!, fields },
                            })
                          }
                        />
                      )}
                    </AiMessage>
                  ),
                )}

                {/* 답변 생성 중 — 도구 행과 본문 조각이 도착하는 대로 살아 움직인다 */}
                {active && pending?.noteId === active.id && (
                  <div className="min-w-0 max-w-[85%]">
                    <AgentTrace
                      working
                      rows={pending.rows}
                      label={pending.label}
                    />
                    {pending.draft && (
                      <div className="whitespace-pre-line text-base leading-relaxed text-slate-700">
                        {pending.draft}
                      </div>
                    )}
                  </div>
                )}

                {/* 실패 — 문구 그대로 보여주고 같은 턴(또는 같은 파일)으로 다시 보낼 수 있게 */}
                {!pending && shownError && (
                  <p
                    role="alert"
                    className="flex items-center gap-2 text-[15px] text-slate-500"
                  >
                    {shownError.text}
                    <button
                      type="button"
                      onClick={() =>
                        void (shownError.kind === "turn"
                          ? respond(shownError.noteId, shownError.turn)
                          : addSourceFiles(shownError.files))
                      }
                      className="cursor-pointer font-semibold text-slate-700 underline-offset-2 transition-colors hover:text-slate-900 hover:underline"
                    >
                      다시 시도
                    </button>
                  </p>
                )}

                {/* 답변 중 새로고침·이탈로 끊긴 자리 — 마지막이 사용자 메시지면 다시 보낼 수 있게 */}
                {active && !pending && !shownError && last?.role === "user" && (
                  <p className="flex items-center gap-2 text-[15px] text-slate-500">
                    답변을 받지 못했어요.
                    <button
                      type="button"
                      onClick={() =>
                        void respond(active.id, { message: last.text })
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
                {composer}
                {disclaimer}
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
        <SourceDrawer
          msg={drawerMsg}
          open={drawer!.open}
          onClose={closeDrawer}
          onClosed={unmountDrawer}
        />
      )}
      <ConnectorModal
        open={connectorOpen}
        onClose={() => setConnectorOpen(false)}
      />
      <SkillModal
        open={skillOpen}
        onClose={() => setSkillOpen(false)}
        selected={skills}
        onToggle={(id) =>
          setSkills((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
          )
        }
      />
    </div>
  );
}
