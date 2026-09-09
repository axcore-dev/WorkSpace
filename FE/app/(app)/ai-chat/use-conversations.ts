"use client";

/**
 * 대화(노트북) 저장소 — 목록 · 생성 · 열기 · 삭제 · 제목, 그리고 그 안의 메시지.
 *
 * **서버가 원본이다.** 목록은 메시지 없이 받아 두고(`loaded: false`) 대화를 열 때 채운다. 화면이 들고 있는
 * `notes` 는 그 저장본의 사본이라, 답변·편집·평가가 저장본과 같이 움직이게 각 조작이 서버 호출을 함께 낸다.
 *
 * 문서 선택(`Note.src.selected`)도 대화의 일부다(서버 `ai_conversations.selected_sources`). 그래서 문서 목록
 * (`library`)과 시작 화면 초안(`draftSrc`)까지 이 저장소가 든다 — 새 대화가 그 목록을 승계하기 때문이다.
 * 문서 자체를 올리고 지우는 일은 `use-sources.ts` 가 하고, 결과를 이 저장소에 반영한다.
 */
import { useEffect, useRef, useState } from "react";
import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
} from "@/lib/ai/conversations";
import { listSources } from "@/lib/ai/sources";
import { ApiRequestError } from "@/lib/api";
import type { ChatMessage, Note, SourceDoc, SourceState } from "@/data/chat";

export const EMPTY_SRC: SourceState = { sources: [], selected: [] };

/**
 * 서버 문서 목록으로 소스 목록을 맞춘다. **서버가 원본이다.**
 *
 * 문서 본문과 메타는 서버(테넌트 스키마 `ai_source_docs` + Object Storage)에 있고, 대화가 갖는 것은
 * "어느 문서를 골랐나"(`selected`) 뿐이다. 서버에 없는 문서는 빼고, 남은 것은 서버 값(id · 색인 상태 · 시각)으로
 * 갈아 끼우고, 서버에만 있는 문서는 뒤에 붙인다.
 *
 * @param selectAll 시작 화면(초안)과 새 대화는 전부 선택된 채 시작한다. 기존 대화는 자기 선택을 지킨다
 */
export function mergeServerDocs(s: SourceState, server: SourceDoc[], selectAll: boolean): SourceState {
  const byName = new Map(server.map((d) => [d.name, d]));
  const kept = s.sources.filter((d) => byName.has(d.name)).map((d) => ({ ...d, ...byName.get(d.name)! }));
  const known = new Set(kept.map((d) => d.name));
  const sources = [...kept, ...server.filter((d) => !known.has(d.name))];
  const selected = selectAll ? sources.map((d) => d.name) : s.selected.filter((n) => byName.has(n));
  return { sources, selected };
}

export interface Notebooks {
  notes: Note[];
  active: Note | null;
  activeId: string | null;
  /** 서버에서 목록을 받아왔는지. 그 전에는 스켈레톤을 그린다 */
  restored: boolean;
  /** 표시 중인 소스 상태 — 활성 대화의 것, 없으면 시작 화면 초안 */
  src: SourceState;
  /**
   * 마지막으로 받은 서버 문서 목록. 새 대화가 이 목록을 전부 선택된 채로 물려받는다.
   * state 가 아닌 이유: 목록 자체는 그리지 않고(대화별 `src` 가 그린다) 새 대화를 만들 때만 읽는다.
   */
  library: () => SourceDoc[];
  setLibrary: (docs: SourceDoc[]) => void;
  show: (id: string | null) => void;
  create: (title?: string, srcInit?: SourceState) => Promise<string>;
  startNew: () => void;
  remove: (id: string) => void;
  appendMessage: (noteId: string, msg: ChatMessage) => void;
  updateMessage: (noteId: string, idx: number, patch: Partial<ChatMessage>) => void;
  /** len 뒤를 잘라낸다 — 편집·다시 시도로 답변을 새로 만들 때. 서버 쪽은 `replaceFromSeq` 가 맡는다 */
  truncate: (noteId: string, len: number) => void;
  /** 활성 대화(없으면 초안)의 소스 상태만 바꾼다 */
  patchSrc: (patch: (s: SourceState) => SourceState) => void;
  /** 모든 대화와 초안의 소스 상태에 같은 변환을 건다 — 문서가 올라가거나 지워졌을 때 */
  patchAllSrc: (patch: (s: SourceState) => SourceState) => void;
  /** 답변이 붙는 등 메시지를 통째로 손볼 때. `use-ai-chat` 이 쓴다 */
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
}

export function useConversations(opts: {
  /** 목록·생성 실패 — 화면 어디서나 보이는 문구로 올린다 */
  fail: (text: string) => void;
  /** 보는 대화가 바뀌었다 — 출처 패널·실패 문구처럼 대화에 묶인 것을 접는다 */
  onSwitch: () => void;
}): Notebooks {
  const { fail, onSwitch } = opts;
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  /** 첫 대화 생성 전(시작 화면)의 소스 — 첫 대화가 이 상태를 승계한다 */
  const [draftSrc, setDraftSrc] = useState<SourceState>(EMPTY_SRC);
  const [restored, setRestored] = useState(false);
  const libraryRef = useRef<SourceDoc[]>([]);

  /**
   * 첫 로드 — 대화 목록과 문서 목록을 함께 받는다. 문서 목록은 초안(전부 선택)에 넣고, 대화마다 서버가 기억한
   * 선택(`selectedSources`)을 얹는다. 실패하면 빈 화면이 아니라 시작 화면으로 간다.
   */
  useEffect(() => {
    let cancelled = false;
    void Promise.allSettled([listConversations(), listSources()]).then(([convs, docs]) => {
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

  const active = notes.find((n) => n.id === activeId) ?? null;
  const src = active?.src ?? draftSrc;

  /** 보는 대화를 바꾼다. 메시지를 아직 안 받은 대화면 서버에서 받아 채운다 */
  function show(id: string | null) {
    setActiveId(id);
    onSwitch();
    const n = id ? notes.find((x) => x.id === id) : null;
    if (!n || n.loaded) return;
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
      .catch((e) => fail(e instanceof ApiRequestError ? e.message : "대화를 불러오지 못했어요"));
  }

  /** 서버에 대화를 만들고 목록 맨 앞에 넣는다. 첫 대화는 시작 화면의 소스 선택을 승계한다 */
  async function create(title = "새 대화", srcInit?: SourceState): Promise<string> {
    const s = srcInit ?? (active ? mergeServerDocs(EMPTY_SRC, libraryRef.current, true) : draftSrc);
    const created = await createConversation({ title, selectedSources: s.selected });
    setNotes((prev) => [{ id: created.id, title: created.title, messages: [], loaded: true, src: s }, ...prev]);
    setActiveId(created.id);
    onSwitch();
    return created.id;
  }

  /** 새 대화 — 서버에 있는 내 문서를 전부 선택한 채로 시작한다 */
  function startNew() {
    void create("새 대화", mergeServerDocs(EMPTY_SRC, libraryRef.current, true)).catch((e) =>
      fail(e instanceof ApiRequestError ? e.message : "새 대화를 만들지 못했어요"),
    );
  }

  /** 삭제 — 화면에서 먼저 지우고 서버에도 지운다. 보고 있던 대화면 가장 최근 것으로 옮겨간다 */
  function remove(id: string) {
    const next = notes.filter((n) => n.id !== id);
    setNotes(next);
    if (id === activeId) show(next.length ? next[0].id : null);
    void deleteConversation(id).catch(() => undefined);
  }

  const patchNote = (noteId: string, patch: (n: Note) => Note) =>
    setNotes((prev) => prev.map((n) => (n.id === noteId ? patch(n) : n)));

  return {
    notes,
    active,
    activeId,
    restored,
    src,
    library: () => libraryRef.current,
    setLibrary: (docs) => {
      libraryRef.current = docs;
    },
    show,
    create,
    startNew,
    remove,
    appendMessage: (noteId, msg) => patchNote(noteId, (n) => ({ ...n, messages: [...n.messages, msg] })),
    updateMessage: (noteId, idx, patch) =>
      patchNote(noteId, (n) => ({
        ...n,
        messages: n.messages.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
      })),
    truncate: (noteId, len) => patchNote(noteId, (n) => ({ ...n, messages: n.messages.slice(0, len) })),
    patchSrc: (patch) => {
      if (active) patchNote(active.id, (n) => ({ ...n, src: patch(n.src) }));
      else setDraftSrc((prev) => patch(prev));
    },
    patchAllSrc: (patch) => {
      setNotes((prev) => prev.map((n) => ({ ...n, src: patch(n.src) })));
      setDraftSrc((prev) => patch(prev));
    },
    setNotes,
  };
}
