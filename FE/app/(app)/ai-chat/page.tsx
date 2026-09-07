"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
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
import { ApiRequestError } from "@/lib/api";
import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  rateMessage,
  updateConversation,
} from "@/lib/ai/conversations";
import {
  deleteSource,
  getSourceView,
  listSources,
  uploadSources,
} from "@/lib/ai/sources";
import { createChatTransport, type TurnContext } from "@/lib/ai/transport";
import { toChatMessage, turnOf, type AxpUIMessage } from "@/lib/ai/ui-messages";
import { useConnectors } from "@/components/connector-provider";
import { CONNECTOR_LIB } from "@/data/chat";
import type {
  ChatMessage,
  Note,
  SourceDoc,
  SourceState,
  TraceStep,
} from "@/data/chat";

const EMPTY_SRC: SourceState = { sources: [], selected: [] };

/**
 * 서버 문서 목록으로 소스 목록을 맞춘다. **서버가 원본이다.**
 *
 * 문서 본문과 메타는 서버(테넌트 스키마 `ai_source_docs` + Object Storage)에 있고, 대화가 갖는 것은
 * "어느 문서를 골랐나"(`selected`, 서버 `ai_conversations.selected_sources`) 뿐이다. 서버에 없는 문서는 빼고,
 * 남은 것은 서버 값(id · 색인 상태 · 시각)으로 갈아 끼우고, 서버에만 있는 문서는 뒤에 붙인다.
 *
 * @param selectAll 시작 화면(초안)과 새 대화는 전부 선택된 채 시작한다. 기존 대화는 자기 선택을 지킨다
 */
function mergeServerDocs(
  s: SourceState,
  server: SourceDoc[],
  selectAll: boolean,
): SourceState {
  const byName = new Map(server.map((d) => [d.name, d]));
  const kept = s.sources
    .filter((d) => byName.has(d.name))
    .map((d) => ({ ...d, ...byName.get(d.name)! }));
  const known = new Set(kept.map((d) => d.name));
  const sources = [...kept, ...server.filter((d) => !known.has(d.name))];
  const selected = selectAll
    ? sources.map((d) => d.name)
    : s.selected.filter((n) => byName.has(n));
  return { sources, selected };
}

/**
 * 답변 생성 중 상태 — 한 번에 한 대화만.
 *
 * `useChat` 이 파트를 들고 있고 이 모양은 화면이 쓰던 그대로 파생해서 만든다 — 스트리밍 상태의 진실이
 * 두 벌이 되지 않게.
 */
interface Pending {
  noteId: string;
  rows: TraceStep[];
  /** 헤더에 흐르는 추론 문구 */
  label: string;
  /** 지금까지 받은 본문 조각 — 답변이 굳기 전에 그대로 보여준다 */
  draft: string;
}

const FIRST_LABEL = "질문의 의도를 파악하고 있어요";

/**
 * 한 턴의 내용 — 질문 · 제안 승인 · 도구 승인. 다시 시도는 같은 턴을 그대로 다시 보낸다.
 * 소스·스킬까지 턴에 담는 이유: 전송 직후 스킬 칩을 비우므로, 담아 두지 않으면 재시도가 스킬 없이 나간다.
 */
type Turn = { message: string } & Omit<TurnContext, "conversationId">;

/** 실패 한 건 — 대화 영역에 문구와 다시 시도로 뜬다. 턴 실패는 그 대화에서만, 업로드 실패는 어디서나 보인다 */
type Failure = { text: string } & (
  | {
      kind: "turn";
      noteId: string;
      turn: Turn;
      /** 성공 뒤에 해야 할 일 — 제안 승인처럼 답변만으로 끝나지 않는 턴이 쓴다 */
      after?: () => void;
    }
  | { kind: "upload"; files: File[] }
);

export default function AiChatPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<Failure | null>(null);
  /** 타자 효과를 재생할 대화 id — 답변이 delta 없이 한 번에 도착했을 때만 */
  const [streaming, setStreaming] = useState<string | null>(null);
  /**
   * 방금 답변이 붙은 대화 id — 그 답변의 트레이스가 펼친 상태로 마운트해 접히는 전환을 재생한다.
   * 작업 중 트레이스는 답변이 붙는 순간 언마운트되므로 이 신호 없이는 행이 그냥 사라진다.
   */
  const [justArrived, setJustArrived] = useState<string | null>(null);
  /** 출처 패널 — open이 false여도 닫히는 동안 내용을 유지하다가 전환이 끝나면 비운다 */
  const [drawer, setDrawer] = useState<{
    noteId: string;
    idx: number;
    open: boolean;
  } | null>(null);
  const [connectorOpen, setConnectorOpen] = useState(false);
  const [skillOpen, setSkillOpen] = useState(false);
  /** 이 턴에 물린 스킬 id — 전송하면 비운다 */
  const [skills, setSkills] = useState<string[]>([]);
  /**
   * 켜 둔 앱 slug — 연결된 앱 중 이 대화에서 쓸 것들. 처음엔 연결된 앱 전부가 켜져 있다.
   * '연결됨'(계정 연동)은 `CONNECTOR_LIB.connected`가 갖는 별개의 사실이고, 끄는 것과 연결을 끊는 것은 다르다.
   * 지금은 화면 안에만 있다 — 커넥터 OAuth 가 붙으면 서버 조회로 옮긴다.
   */
  const [enabledApps, setEnabledApps] = useState<string[]>(() =>
    CONNECTOR_LIB.filter((c) => c.connected).map((c) => c.slug),
  );
  /**
   * 연결된 앱 slug — 커넥터 팝업·입력창, 그리고 **설정 › 워크스페이스 › 연동**이 같은 값을
   * 본다. 화면 state로 두면 설정에서 끊은 앱이 여기 그대로 남는다 (수정요청 v12).
   */
  const { connected: linkedApps, connect, disconnect } = useConnectors();
  /** 첫 대화 생성 전(시작 화면)의 소스 — 첫 대화가 이 상태를 승계한다 */
  const [draftSrc, setDraftSrc] = useState<SourceState>(EMPTY_SRC);
  /** 서버에서 대화 목록·문서 목록을 받아왔는지. 그 전에는 스켈레톤을 그린다 */
  const [restored, setRestored] = useState(false);
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
   * 지금 보내고 있는 턴. 스트림이 끝났을 때 어느 대화에 답변을 붙일지 알아야 해서 들고 있다.
   * ref 인 이유: 값이 바뀌었다고 다시 그릴 것이 없고, transport 가 매 요청 시점에 읽어야 한다.
   */
  const turnRef = useRef<{ nid: string; turn: Turn; after?: () => void } | null>(null);
  /**
   * 진행 중인 답변이 붙을 대화 id.
   *
   * `turnRef` 와 같은 값이지만 이쪽은 state 다 — 렌더가 이 값을 보고 작업 중 표시를 그리는데,
   * ref 는 바뀌어도 다시 그리지 않는다. ref 는 렌더 밖(전송 시점·스트림 종료)에서만 읽는다.
   */
  const [pendingNoteId, setPendingNoteId] = useState<string | null>(null);
  /**
   * 전송 계층은 마운트 때 한 번만 만든다. 매 렌더 새로 만들면 `useChat` 이 전송 도중에 이걸
   * 교체해 스트림이 끊긴다. 턴마다 달라지는 값은 `sendMessage` 의 `body` 로 넘긴다.
   */
  const [transport] = useState(createChatTransport);

  /**
   * 스트리밍 엔진. 대화 저장본은 서버가 갖고 화면은 `notes` 로 들고 있으며, 여기는 **진행 중인 턴
   * 하나만** 든다. 답변이 끝나면 `notes` 로 옮기고 다음 턴 시작에 비운다.
   */
  const chat = useChat<AxpUIMessage>({
    transport,
    onFinish: ({ message, isAbort, isError }) => {
      const t = turnRef.current;
      if (!t || isAbort || isError) return;
      const saved = turnOf(message);
      const ai = toChatMessage(message);
      setNotes((prev) =>
        prev.map((n) => {
          if (n.id !== t.nid) return n;
          // 방금 보낸 사용자 메시지(순번 없음)에 서버 순번을 매기고, 첫 질문이면 제목을 받는다
          const messages = n.messages.map((m, i) =>
            i === n.messages.length - 1 && m.role === "user" && m.seq === undefined && saved
              ? { ...m, seq: saved.userSeq }
              : m,
          );
          return {
            ...n,
            title: saved?.title ?? n.title,
            messages: [...messages, { ...ai, seq: saved?.assistantSeq ?? ai.seq }],
          };
        }),
      );
      // 본문이 조각으로 흘러왔으므로 타자 효과를 다시 틀지 않는다
      setStreaming(null);
      setJustArrived(t.nid);
      // 접히는 전환(300ms)이 끝나면 신호를 내린다 — 대화를 다시 열 때 또 접히지 않게
      setTimeout(() => setJustArrived((n) => (n === t.nid ? null : n)), 400);
      t.after?.();
      clearTurn();
    },
    onError: (e) => {
      const t = turnRef.current;
      if (!t) return;
      // 서버가 사용자 메시지를 이미 저장했다면(data-turn 도착) 재시도는 그 자리를 덮어써야 두 번 쌓이지 않는다
      const saved = chat.messages.findLast((m) => m.role === "assistant");
      const seq = saved ? turnOf(saved)?.userSeq : undefined;
      setError({
        kind: "turn",
        noteId: t.nid,
        turn: seq ? { ...t.turn, replaceFromSeq: seq } : t.turn,
        after: t.after,
        text: e instanceof ApiRequestError ? e.message : "답변을 받지 못했어요",
      });
      clearTurn();
    },
  });

  function clearTurn() {
    turnRef.current = null;
    setPendingNoteId(null);
  }

  const busy = chat.status === "submitted" || chat.status === "streaming";

  /**
   * 진행 중인 턴을 화면이 쓰던 모양으로 접는다.
   *
   * `useChat` 의 파트가 유일한 출처다 — 별도 state 에 또 쌓으면 두 벌이 어긋난다.
   */
  const live = busy ? chat.messages.findLast((m) => m.role === "assistant") : undefined;
  const liveMsg = live ? toChatMessage(live) : null;
  const pending: Pending | null =
    busy && pendingNoteId !== null
      ? {
          noteId: pendingNoteId,
          rows: liveMsg?.process?.trace ?? [],
          label: liveMsg?.reasoning?.at(-1) ?? FIRST_LABEL,
          draft: liveMsg?.text ?? "",
        }
      : null;

  // 페이지를 떠나면 스트림을 끊는다. 답변이 붙지 않은 사용자 메시지는 복귀 시 '다시 시도'로 이어진다
  const stopRef = useRef(chat.stop);
  useEffect(() => {
    stopRef.current = chat.stop;
  }, [chat.stop]);
  useEffect(() => () => void stopRef.current(), []);

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

  /** 선택 변경 — 화면에 바로 반영하고, 대화가 있으면 서버에도 남긴다(기다리지 않는다) */
  function changeSelection(next: (s: SourceState) => string[]) {
    const selected = next(src);
    patchSrc((s) => ({ ...s, selected }));
    if (active) {
      void updateConversation(active.id, { selectedSources: selected }).catch(() => undefined);
    }
  }

  /**
   * 마지막으로 받은 서버 문서 목록. 새 대화가 이 목록을 전부 선택된 채로 물려받는다.
   * ref 인 이유: 목록 자체는 화면에 그리지 않고(대화별 src 가 그린다) 새 대화를 만들 때만 읽는다.
   */
  const libraryRef = useRef<SourceDoc[]>([]);

  /**
   * 첫 로드 — 대화 목록과 문서 목록을 서버에서 받는다. 둘 다 서버가 원본이다.
   *
   * 대화 목록은 메시지 없이 온다(`loaded: false`). 메시지는 대화를 열 때 받는다. 문서 목록은 초안(전부 선택)에
   * 넣고, 대화마다 서버가 기억한 선택(`selectedSources`)을 얹는다. 실패하면 빈 화면이 아니라 시작 화면으로 간다.
   */
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([listConversations(), listSources()]).then(([convs, docs]) => {
      if (cancelled) return;
      const library = docs.status === "fulfilled" ? docs.value : [];
      libraryRef.current = library;
      setDraftSrc(mergeServerDocs(EMPTY_SRC, library, true));
      if (convs.status === "fulfilled") {
        setNotes(
          convs.value.map((c) => ({
            id: c.id,
            title: c.title,
            messages: [],
            loaded: false,
            src: mergeServerDocs({ sources: [], selected: c.selectedSources }, library, false),
          })),
        );
      }
      setRestored(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * 색인 상태 polling. 업로드 응답은 `indexing` 으로 오고 조각 생성은 서버가 응답 뒤에 이어서 하므로,
   * 화면이 다시 묻지 않으면 '색인 중' 이 영원히 남는다. 표시 중인 소스에 색인 중인 것이 있을 때만
   * 2초마다 목록을 받아 같은 id 의 상태를 갱신하고, 전부 끝나면 멈춘다.
   */
  const indexing = sources.some((d) => d.id && d.status === "indexing");
  useEffect(() => {
    if (!indexing) return;
    let stopped = false;
    const tick = async () => {
      let fresh: SourceDoc[];
      try {
        fresh = await listSources();
      } catch {
        return; // 일시 실패는 다음 tick 에 다시 본다
      }
      if (stopped) return;
      libraryRef.current = fresh;
      const byId = new Map(fresh.filter((d) => d.id).map((d) => [d.id!, d]));
      const apply = (s: SourceState): SourceState => ({
        ...s,
        sources: s.sources.map((d) => {
          const f = d.id ? byId.get(d.id) : undefined;
          return f && f.status !== d.status ? { ...d, status: f.status, updated: f.updated } : d;
        }),
      });
      setNotes((prev) => prev.map((n) => ({ ...n, src: apply(n.src) })));
      setDraftSrc((prev) => apply(prev));
    };
    const timer = setInterval(() => void tick(), 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [indexing]);

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

  /**
   * 보는 대화를 바꾼다 — 타자 효과·출처 패널·실패 문구는 대화에 묶여 있으니 함께 접는다.
   * 메시지를 아직 안 받은 대화면 서버에서 받아 채운다.
   */
  function showNote(id: string | null) {
    setActiveId(id);
    setStreaming(null);
    setDrawer(null);
    setError(null);
    const n = id ? notes.find((x) => x.id === id) : null;
    if (n && !n.loaded) {
      getConversation(n.id)
        .then(({ conversation, messages }) =>
          setNotes((prev) =>
            prev.map((x) =>
              x.id === n.id
                ? {
                    ...x,
                    title: conversation.title,
                    messages,
                    loaded: true,
                    src: {
                      ...x.src,
                      selected: conversation.selectedSources.filter((s) =>
                        x.src.sources.some((d) => d.name === s),
                      ),
                    },
                  }
                : x,
            ),
          ),
        )
        .catch((e) =>
          setError({
            kind: "upload",
            files: [],
            text: e instanceof ApiRequestError ? e.message : "대화를 불러오지 못했어요",
          }),
        );
    }
  }

  /** 서버에 대화를 만들고 목록 맨 앞에 넣는다. 첫 대화는 시작 화면의 소스 선택을 승계한다 */
  async function createNote(title = "새 대화", srcInit?: SourceState): Promise<string> {
    const s = srcInit ?? (active ? mergeServerDocs(EMPTY_SRC, libraryRef.current, true) : draftSrc);
    const created = await createConversation({ title, selectedSources: s.selected });
    setNotes((prev) => [{ id: created.id, title: created.title, messages: [], loaded: true, src: s }, ...prev]);
    setActiveId(created.id);
    setStreaming(null);
    setDrawer(null);
    setError(null);
    return created.id;
  }

  /** 새 대화 = 새 노트북 생성 — 서버에 있는 내 문서를 전부 선택한 채로 시작한다 */
  function startNewNote() {
    void createNote("새 대화", mergeServerDocs(EMPTY_SRC, libraryRef.current, true)).catch((e) =>
      setError({
        kind: "upload",
        files: [],
        text: e instanceof ApiRequestError ? e.message : "새 대화를 만들지 못했어요",
      }),
    );
  }

  /** 대화 삭제 — 화면에서 먼저 지우고 서버에도 지운다. 지운 게 보고 있던 대화면 가장 최근 것으로 옮겨간다 */
  function deleteNote(id: string) {
    const next = notes.filter((n) => n.id !== id);
    setNotes(next);
    if (id === activeId) showNote(next.length ? next[0].id : null);
    void deleteConversation(id).catch(() => undefined);
  }

  function appendMessage(noteId: string, msg: ChatMessage) {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId ? { ...n, messages: [...n.messages, msg] } : n,
      ),
    );
  }

  function updateMessage(noteId: string, msgIdx: number, patch: Partial<ChatMessage>) {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId
          ? {
              ...n,
              messages: n.messages.map((m, i) => (i === msgIdx ? { ...m, ...patch } : m)),
            }
          : n,
      ),
    );
  }

  /** len 뒤를 잘라낸다 — 편집·다시 시도로 답변을 새로 만들 때. 서버 쪽은 `replaceFromSeq` 가 맡는다 */
  function truncate(noteId: string, len: number) {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId ? { ...n, messages: n.messages.slice(0, len) } : n,
      ),
    );
  }

  /**
   * 한 턴을 보낸다 — 전송·편집·다시 시도·제안 승인·도구 승인이 모두 여기로 모인다.
   *
   * 결과는 `useChat` 의 `onFinish`/`onError` 로 돌아온다. **직전 턴을 비우고 시작한다.** transport 가
   * 마지막 메시지 하나만 보내므로 훅에 히스토리를 쌓아 둘 이유가 없다 — 히스토리는 서버가 자기 저장본에서 읽는다.
   */
  function respond(nid: string, turn: Turn, after?: () => void) {
    setError(null);
    chat.clearError();
    chat.setMessages([]);
    turnRef.current = { nid, turn, after };
    setPendingNoteId(nid);
    const body: TurnContext = {
      conversationId: nid,
      sources: turn.sources,
      skills: turn.skills,
      replaceFromSeq: turn.replaceFromSeq,
      action: turn.action,
    };
    void chat.sendMessage({ text: turn.message }, { body });
  }

  async function send() {
    const q = input.trim();
    if (!q || pending) return;
    setInput("");
    let nid = activeId;
    if (!nid) {
      try {
        nid = await createNote("새 대화");
      } catch (e) {
        setInput(q);
        setError({
          kind: "upload",
          files: [],
          text: e instanceof ApiRequestError ? e.message : "새 대화를 만들지 못했어요",
        });
        return;
      }
    }
    appendMessage(nid, { role: "user", text: q });
    respond(nid, { message: q, sources: selectedSources, skills });
    setSkills([]);
  }

  /** 사용자 메시지 제자리 편집 — 그 뒤 답변을 버리고 다시 생성한다 */
  function editUser(noteId: string, idx: number, text: string) {
    const old = notes.find((n) => n.id === noteId)?.messages[idx];
    if (!old || pending) return;
    truncate(noteId, idx);
    appendMessage(noteId, { role: "user", text });
    respond(noteId, { message: text, sources: selectedSources, skills, replaceFromSeq: old.seq });
  }

  /** 답변 다시 시도 — 바로 앞 사용자 메시지로 다시 답한다 */
  function retry(noteId: string, aiIdx: number) {
    const u = notes.find((n) => n.id === noteId)?.messages[aiIdx - 1];
    if (!u || u.role !== "user" || pending) return;
    truncate(noteId, aiIdx - 1);
    appendMessage(noteId, { role: "user", text: u.text });
    respond(noteId, { message: u.text, sources: selectedSources, skills, replaceFromSeq: u.seq });
  }

  /** 응답 평가 — 같은 걸 다시 누르면 해제. 서버에 남겨 답변 품질 지표로 쓴다 */
  function rate(noteId: string, idx: number, r: "up" | "down") {
    const m = notes.find((n) => n.id === noteId)?.messages[idx];
    if (!m) return;
    const next = m.rating === r ? undefined : r;
    updateMessage(noteId, idx, { rating: next });
    if (m.seq) void rateMessage(noteId, m.seq, next ?? null).catch(() => undefined);
  }

  /** 소스 추가 — 서버에 올리고 돌아온 문서 메타를 목록 상단에 추가·선택한다. 실패하면 같은 파일로 다시 시도할 수 있다 */
  async function addSourceFiles(files: File[]) {
    if (!files.length) return;
    setError(null);
    try {
      // 같은 이름은 교체다 — 서버가 기존 문서(객체·조각)를 지우고 새 것으로 바꿔 다시 색인한다.
      // 화면도 그 항목을 새 id·'색인 중' 으로 갈아 끼우되 자리와 선택 상태는 그대로 둔다.
      const docs = await uploadSources(files);
      const byName = new Map(docs.map((d) => [d.name, d]));
      const added = docs.filter((d) => !src.sources.some((x) => x.name === d.name));
      const nextSelected = [...new Set([...src.selected, ...docs.map((d) => d.name)])];
      patchSrc((s) => ({
        sources: [...added, ...s.sources.map((x) => byName.get(x.name) ?? x)],
        selected: nextSelected,
      }));
      if (active) void updateConversation(active.id, { selectedSources: nextSelected }).catch(() => undefined);
      // 다른 대화·초안이 같은 문서를 들고 있으면 거기도 새 버전으로 맞춘다
      const apply = (s: SourceState): SourceState => ({
        ...s,
        sources: s.sources.map((x) => byName.get(x.name) ?? x),
      });
      setNotes((prev) => prev.map((n) => ({ ...n, src: apply(n.src) })));
      setDraftSrc((prev) => apply(prev));
      libraryRef.current = [...docs, ...libraryRef.current.filter((d) => !byName.has(d.name))];
    } catch (e) {
      setError({
        kind: "upload",
        files,
        text: e instanceof ApiRequestError ? e.message : "소스를 올리지 못했어요",
      });
    }
  }

  /**
   * 소스 삭제 — 목록·선택에서 바로 지우고, 서버 문서(id 있음)면 스토리지·색인도 지운다.
   * 서버 삭제는 기다리지 않는다. 화면에서 사라지는 게 사용자가 기대한 일이고, 실패해도 다음 목록
   * 조회에서 다시 보이는 것 외에 잃는 것이 없다.
   */
  function removeSource(name: string) {
    const doc = sources.find((d) => d.name === name);
    const drop = (s: SourceState): SourceState => ({
      sources: s.sources.filter((d) => d.name !== name),
      selected: s.selected.filter((n) => n !== name),
    });
    setNotes((prev) => prev.map((n) => ({ ...n, src: drop(n.src) })));
    setDraftSrc((prev) => drop(prev));
    libraryRef.current = libraryRef.current.filter((d) => d.name !== name);
    if (doc?.id) void deleteSource(doc.id).catch(() => undefined);
  }

  /** 소스 열기 — 서버가 준 한시적 링크를 새 탭에서 연다 */
  async function openSource(name: string) {
    const doc = sources.find((d) => d.name === name);
    if (!doc?.id) return;
    // 팝업 차단을 피하려면 클릭 직후에 창을 열어 두고 주소를 나중에 넣어야 한다
    const win = window.open("", "_blank", "noopener,noreferrer");
    try {
      const { url } = await getSourceView(doc.id);
      if (win) win.location.href = url;
    } catch (e) {
      win?.close();
      setError({
        kind: "upload",
        files: [],
        text: e instanceof ApiRequestError ? e.message : "문서를 열지 못했어요",
      });
    }
  }

  /**
   * 발주서 제안 승인/취소 — 승인은 서버에 반영을 요청하고 답이 오면 카드를 resolved로 굳힌다(실패하면 버튼이 남아 다시 누를 수 있다).
   * 취소는 바로 굳힌다.
   */
  async function resolveOcr(noteId: string, idx: number, approved: boolean) {
    const proposal = notes.find((n) => n.id === noteId)?.messages[idx]?.ocrProposal;
    if (!proposal || pending) return;
    const resolve = () =>
      updateMessage(noteId, idx, { ocrProposal: { ...proposal, resolved: true } });
    if (!approved) {
      resolve();
      appendMessage(noteId, { role: "ai", text: "반영을 취소했어요. 문서는 소스로만 보관돼요." });
      return;
    }
    // 성공 뒤 카드를 닫는 일을 respond에 맡긴다 — 실패 후 '다시 시도'로 성공했을 때도 같이 닫히게
    respond(
      noteId,
      { message: "", sources: selectedSources, skills, action: { type: "approve-proposal", proposal } },
      resolve,
    );
  }

  /**
   * 도구 실행 승인·거절 — 카드의 결정을 서버로 보낸다. 서버는 자기 감사 기록의 입력으로 실행하고 결과로 답한다.
   * 화면에는 결정 문구를 사용자 메시지로 남긴다(서버도 같은 문구를 저장한다).
   */
  function decideApproval(noteId: string, idx: number, approvalId: string, approved: boolean) {
    const m = notes.find((n) => n.id === noteId)?.messages[idx];
    const a = m?.approvals?.find((x) => x.approvalId === approvalId);
    if (!a || a.decision || pending) return;
    updateMessage(noteId, idx, {
      approvals: m!.approvals!.map((x) =>
        x.approvalId === approvalId ? { ...x, decision: approved ? "approved" : "denied" } : x,
      ),
    });
    appendMessage(noteId, { role: "user", text: `${a.label} 실행을 ${approved ? "승인" : "거절"}했어요.` });
    respond(noteId, {
      message: "",
      sources: selectedSources,
      skills: [],
      action: { type: "tool-approval", approvalId, approved },
    });
  }

  /** 출처 패널 토글 — 같은 답변의 '출처'를 다시 누르면 닫히고, 다른 답변이면 내용만 갈아탄다 */
  function toggleDrawer(noteId: string, idx: number) {
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
        setEnabledApps((prev) =>
          prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug],
        )
      }
    />
  );
  const disclaimer = (
    <p className="mt-2 text-center text-[13px] text-slate-400">
      AI는 실수를 할 수 있습니다. 중요한 정보는 재차 확인하세요.
    </p>
  );

  const last = active?.messages[active.messages.length - 1];
  const drawerMsg =
    drawer && drawer.noteId === active?.id ? active.messages[drawer.idx] : undefined;
  const shownError =
    error && (error.kind === "upload" || error.noteId === active?.id) ? error : null;
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
          changeSelection((s) =>
            s.selected.includes(name) ? s.selected.filter((x) => x !== name) : [...s.selected, name],
          )
        }
        onToggleAll={() =>
          changeSelection((s) =>
            s.selected.length === s.sources.length ? [] : s.sources.map((d) => d.name),
          )
        }
        onAddSource={() => fileRef.current?.click()}
        onRemoveSource={removeSource}
        onOpenSource={(name) => void openSource(name)}
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
                      onEdit={(text) => editUser(active.id, i, text)}
                    />
                  ) : (
                    <AiMessage
                      key={msg.seq ?? `a${i}`}
                      msg={msg}
                      last={i === active.messages.length - 1}
                      streaming={streaming === active.id && i === active.messages.length - 1}
                      disabled={!!pending}
                      sourcesOpen={!!drawer?.open && drawer.noteId === active.id && drawer.idx === i}
                      justArrived={justArrived === active.id && i === active.messages.length - 1}
                      onStreamDone={stopStreaming}
                      onRetry={() => retry(active.id, i)}
                      onRate={(r) => rate(active.id, i, r)}
                      onOpenSources={() => toggleDrawer(active.id, i)}
                    >
                      {msg.ocrProposal && (
                        <OcrProposalCard
                          proposal={msg.ocrProposal}
                          pending={!msg.ocrProposal.resolved}
                          onResolve={(approved) => void resolveOcr(active.id, i, approved)}
                          onUpdate={(fields) =>
                            updateMessage(active.id, i, {
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
                          onDecide={(approved) => decideApproval(active.id, i, a.approvalId, approved)}
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
                            ? respond(shownError.noteId, shownError.turn, shownError.after)
                            : addSourceFiles(shownError.files))
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
                        respond(active.id, {
                          message: last.text,
                          sources: selectedSources,
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
        <SourceDrawer msg={drawerMsg} open={drawer!.open} onClose={closeDrawer} onClosed={unmountDrawer} />
      )}
      <ConnectorModal
        open={connectorOpen}
        onClose={() => setConnectorOpen(false)}
        connected={linkedApps}
        onConnect={(slug) => {
          connect(slug);
          // 새로 연결한 앱은 켜진 상태로 시작한다
          setEnabledApps((prev) => [...prev, slug]);
        }}
        onDisconnect={(slug) => {
          disconnect(slug);
          setEnabledApps((prev) => prev.filter((x) => x !== slug));
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
