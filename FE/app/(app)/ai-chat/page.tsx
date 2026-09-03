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
import { loadChat, saveChat } from "@/lib/chat-storage";
import {
  RAG_FOLDERS,
  REPLY_ROUTES,
  SCRIPTED_CALENDAR_REPLY,
  SCRIPTED_REPLIES,
  ragIngestMessage,
  withUploadedCitation,
  type ChatMessage,
  type Note,
  type SourceState,
  type TraceStep,
} from "@/data/chat";

// NotebookLM식 소스 목록 (폴더 없이 평면)
const INITIAL_SOURCES = RAG_FOLDERS.flatMap((f) => f.docs).map((d) => ({ ...d }));

/* ── 실제 AI 연동 (발주서 제안 · 구글 캘린더 확인 시나리오) ── */

interface ScenarioResult {
  trace: TraceStep[];
  summary?: string;
  reply: string;
  tools: string[];
  sources: string[];
  proposal?: { fields: { label: string; value: string }[] };
}

/**
 * 시나리오 API 호출 seam — 백엔드는 BE(8080)로 이관 예정이라 현재 엔드포인트는 없다.
 * 실패(=지금은 항상)하면 null을 돌려 데모 스크립트로 폴백한다. BE API가 서면 URL만 교체한다.
 */
async function callScenario(
  scenario: "purchase-order" | "calendar",
  question: string,
  sources?: string[],
): Promise<ScenarioResult | null> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario, messages: [{ role: "user", content: question }], sources }),
    });
    const data = (await res.json().catch(() => null)) as ScenarioResult | null;
    if (!data || !res.ok) return null;
    if (typeof data.reply !== "string" || !Array.isArray(data.trace) || data.trace.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}

/** 시나리오 응답 → 채팅 메시지 (추론 trace 포함) */
function scenarioToMessage(r: ScenarioResult, ocrDoc?: { docName: string; targetModule: string }): ChatMessage {
  return {
    role: "ai",
    text: r.reply,
    ocrProposal: ocrDoc && r.proposal ? { ...ocrDoc, fields: r.proposal.fields } : undefined,
    process: {
      sources: r.sources,
      steps: r.trace.map((t) => t.text),
      tools: r.tools,
      trace: r.trace,
      summary: r.summary,
    },
  };
}

const EMPTY_SRC: SourceState = { sources: [], selected: [], uploaded: [] };

/** 답변 생성 중 상태 — 한 번에 한 대화만. 도구 행이 하나씩 드러나고 끝나면 메시지로 굳는다 */
interface Pending {
  noteId: number;
  rows: TraceStep[];
  /** 지금까지 드러난 행 수 */
  shown: number;
  /** 헤더에 흐르는 추론 문구 — shown 인덱스로 현재 문구를 고른다 */
  labels: string[];
  startedAt: number;
}

const DEFAULT_LABELS = ["질문의 의도를 파악하고 있어요", "관련 데이터를 살펴보고 있어요", "답변을 정리하고 있어요"];
const ROW_MS = 900;

export default function AiChatPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPendingState] = useState<Pending | null>(null);
  /** 타자 효과를 재생할 대화 id — 마지막 답변이 새로 도착했을 때만 */
  const [streaming, setStreaming] = useState<number | null>(null);
  const [drawer, setDrawer] = useState<{ noteId: number; idx: number } | null>(null);
  const [connectorOpen, setConnectorOpen] = useState(false);
  const [skillOpen, setSkillOpen] = useState(false);
  /** 첫 대화 생성 전(시작 화면)의 소스 — 첫 대화가 이 상태를 승계한다 */
  const [draftSrc, setDraftSrc] = useState<SourceState>({
    sources: INITIAL_SOURCES,
    selected: INITIAL_SOURCES.map((s) => s.name),
    uploaded: [],
  });
  /** localStorage 복원이 끝나기 전에는 저장하지 않는다 — 빈 상태로 덮어쓰는 걸 막는다 */
  const [restored, setRestored] = useState(false);
  /** 첫 화면 배경이 페이드아웃을 끝내고 내려갔는지. 빈 상태로 돌아오면 렌더 중에 되돌린다 */
  const [backdropGone, setBackdropGone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const noteSeq = useRef(1);
  // 타이머 콜백은 stale closure를 보므로 pending의 최신값은 ref로 함께 든다
  const pendingRef = useRef<Pending | null>(null);
  const timers = useRef<number[]>([]);

  function setPending(p: Pending | null) {
    pendingRef.current = p;
    setPendingState(p);
  }
  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }
  function after(ms: number, fn: () => void) {
    timers.current.push(window.setTimeout(fn, ms));
  }
  // 페이지를 떠나면 진행 중인 재생을 끊는다 — 답변이 붙지 않은 사용자 메시지는 복귀 시 '다시 시도'로 이어진다
  useEffect(() => {
    const t = timers;
    return () => t.current.forEach(clearTimeout);
  }, []);

  const active = notes.find((n) => n.id === activeId) ?? null;

  // 표시 중인 소스 상태 — 활성 대화(노트북)의 것, 없으면 시작 화면 초안
  const src = active?.src ?? draftSrc;
  const { sources, selected: selectedSources, uploaded: uploadedDocs } = src;

  /** 소스 상태 변경 — 활성 대화가 있으면 그 대화에, 없으면 초안에 반영한다 */
  function patchSrc(patch: (s: SourceState) => SourceState) {
    if (active) {
      setNotes((prev) => prev.map((n) => (n.id === active.id ? { ...n, src: patch(n.src) } : n)));
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
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [active?.messages, pending]);

  // 타자 효과·트레이스 펼침으로 본문이 자라는 동안 바닥에 붙어 따라간다 — 위로 올려 읽는 중이면 두지 않는다
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

  // Google OAuth 콜백 복귀 안내 — /api/google/callback이 ?google_connected=1|google_error=... 로 리다이렉트한다
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("google_connected");
    const error = params.get("google_error");
    if (!connected && !error) return;
    window.history.replaceState({}, "", window.location.pathname);
    const nid = createNote(connected ? "Google Calendar 연결" : "Google Calendar 연결 실패");
    appendMessage(nid, {
      role: "ai",
      text: connected
        ? "Google Calendar 연결이 완료됐어요. 이제 실제 일정을 조회할 수 있어요. 예: '이번 주 정비 일정 확인해줘'"
        : "Google Calendar 연결에 실패했어요. 잠시 후 다시 시도해 주세요.",
    });
    // 마운트 시 1회만 실행 — OAuth 리다이렉트 쿼리 파라미터 처리 용도
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 보는 대화를 바꾼다 — 타자 효과·드로어는 대화에 묶여 있으니 함께 접는다 */
  function showNote(id: number | null) {
    setActiveId(id);
    setStreaming(null);
    setDrawer(null);
  }

  function createNote(title = "새 대화", srcInit?: SourceState): number {
    const id = ++noteSeq.current;
    // 시작 화면에서 자동 생성되는 첫 대화는 화면에 보이던 소스(초안)를 승계한다
    const s = srcInit ?? (active ? EMPTY_SRC : draftSrc);
    setNotes((prev) => [...prev, { id, title, messages: [], replyIdx: 0, src: s }]);
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
      if (id === activeId) showNote(next.length ? next[next.length - 1].id : null);
      return next;
    });
  }

  /** 직전 대화의 소스를 현재 빈 대화로 복사한다 — 새 대화마다 다시 고르는 수고를 던다 */
  function inheritSources() {
    const prev = notes.filter((n) => n.id !== activeId && n.src.sources.length > 0).pop();
    if (!prev) return;
    patchSrc(() => ({
      sources: prev.src.sources.map((d) => ({ ...d })),
      selected: [...prev.src.selected],
      uploaded: [],
    }));
  }

  const canInherit = notes.some((n) => n.id !== activeId && n.src.sources.length > 0);

  /** 비어 있는 '새 대화' 노트북에 첫 활동이 생기면 제목을 붙인다 — 대화 기록에서 구분되도록 */
  function nameNoteIfUntitled(id: number, title: string) {
    setNotes((prev) =>
      prev.map((n) => (n.id === id && n.title === "새 대화" && n.messages.length === 0 ? { ...n, title } : n)),
    );
  }

  function appendMessage(noteId: number, msg: ChatMessage) {
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, messages: [...n.messages, msg] } : n)));
  }

  function updateMessage(noteId: number, msgIdx: number, patch: Partial<ChatMessage>) {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId ? { ...n, messages: n.messages.map((m, i) => (i === msgIdx ? { ...m, ...patch } : m)) } : n,
      ),
    );
  }

  /** len 뒤를 잘라낸다 — 다시 시도로 답변을 새로 만들 때 */
  function truncate(noteId: number, len: number) {
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, messages: n.messages.slice(0, len) } : n)));
  }

  /** 응답을 기다리는 동안(API 호출 등) 헤더 문구만 먼저 띄운다 */
  function startPending(noteId: number, label: string) {
    clearTimers();
    setPending({ noteId, rows: [], shown: 0, labels: [label], startedAt: Date.now() });
  }

  /** 대기 중 추론 문구를 하나 더 붙인다 — 같은 대화의 pending일 때만 */
  function addLabel(noteId: number, label: string, ms: number) {
    after(ms, () => {
      const p = pendingRef.current;
      if (p?.noteId === noteId) setPending({ ...p, labels: [...p.labels, label], shown: p.shown + 1 });
    });
  }

  /**
   * 도구 행을 하나씩(ROW_MS) 드러낸 뒤 답변을 붙인다 — 실제 AI 응답도 trace로 같은 재생을 탄다.
   * 붙는 순간 활동 시간(durationMs)을 기록하고 타자 효과를 켠다.
   */
  function pushAi(noteId: number, msg: ChatMessage, labels?: string[]) {
    clearTimers();
    const rows = msg.process?.trace ?? msg.process?.steps.map((text) => ({ text })) ?? [];
    const startedAt = pendingRef.current?.noteId === noteId ? pendingRef.current.startedAt : Date.now();
    setPending({ noteId, rows, shown: 0, labels: labels ?? msg.reasoning ?? DEFAULT_LABELS, startedAt });
    rows.forEach((_, i) =>
      after((i + 1) * ROW_MS, () => {
        const p = pendingRef.current;
        if (p) setPending({ ...p, shown: i + 1 });
      }),
    );
    after(Math.max(rows.length, 1) * ROW_MS + 500, () => {
      appendMessage(noteId, { ...msg, durationMs: Date.now() - startedAt });
      setStreaming(noteId);
      setPending(null);
    });
  }

  /** 사용자 메시지 하나에 답한다 — 전송·편집·다시 시도가 모두 여기로 모인다 */
  async function respond(nid: number, u: ChatMessage) {
    const q = u.text;

    // 발주서 OCR — 실제 AI가 OCR 텍스트를 근거로 제안·추론 과정을 생성 (키 미설정 시 스크립트 폴백)
    if (u.attachment) {
      startPending(nid, "발주서를 읽고 있어요");
      const r = await callScenario(
        "purchase-order",
        "첨부한 발주서(대신금속, 황동봉 C3604 Ø12 800kg)를 읽고 구매 관리 등록을 제안해줘",
      );
      if (r?.proposal) {
        pushAi(
          nid,
          scenarioToMessage(r, { docName: u.attachment, targetModule: "경영지원 > 구매 관리" }),
          r.trace.map((t) => t.text),
        );
      } else {
        pushAi(nid, SCRIPTED_REPLIES[1]);
      }
      return;
    }

    // 구글 캘린더 확인 시나리오 — BE API 연동 전까지는 스크립트 폴백으로 동작한다
    if (/캘린더|일정|calendar/i.test(q)) {
      startPending(nid, "질문의 의도를 파악하고 있어요");
      // 응답 대기 중에도 어떤 도구(Google Calendar)와 소스를 쓰는지 보이게 순차 표시
      addLabel(nid, "Google Calendar에서 일정을 불러오고 있어요", 850);
      if (selectedSources.length > 0) addLabel(nid, "선택한 소스 문서를 함께 확인하고 있어요", 1900);
      const r = await callScenario("calendar", q, selectedSources);
      if (r) pushAi(nid, scenarioToMessage(r), r.trace.map((t) => t.text));
      else pushAi(nid, SCRIPTED_CALENDAR_REPLY);
      return;
    }

    // 데모 시나리오 라우팅 — 질문 키워드로 응답 선택, 없으면 순서 재생
    const routed = REPLY_ROUTES.find((r) => r.pattern.test(q));
    if (routed) {
      const base = SCRIPTED_REPLIES[routed.index];
      // 지식도우미(작업표준·FAQ) 답변: 업로드 문서가 있으면 그 문서를 최우선 출처로 인용 (RAG 시연)
      const isKnowledge = routed.index === 6 || routed.index === 7;
      pushAi(nid, isKnowledge && uploadedDocs.length > 0 ? withUploadedCitation(base, uploadedDocs[0]) : base);
      return;
    }
    const order = [0, 3];
    const note = notes.find((n) => n.id === nid);
    const scriptIdx = order[note?.replyIdx ?? 0];
    setNotes((prev) => prev.map((n) => (n.id === nid ? { ...n, replyIdx: Math.min(n.replyIdx + 1, order.length) } : n)));
    pushAi(
      nid,
      scriptIdx !== undefined
        ? SCRIPTED_REPLIES[scriptIdx]
        : {
            role: "ai",
            text: "데모 시나리오 응답을 모두 재생했어요. 실제 서비스에서는 연결된 커넥터·스킬과 ON 상태 기능 데이터를 기반으로 답변이 생성돼요.",
          },
    );
  }

  function send() {
    const q = input.trim();
    if (!q || pending) return;
    const title = q.length > 18 ? q.slice(0, 18) + "…" : q;
    const nid = activeId ?? createNote(title);
    setInput("");
    nameNoteIfUntitled(nid, title);
    const u: ChatMessage = { role: "user", text: q };
    appendMessage(nid, u);
    void respond(nid, u);
  }

  /** 사용자 메시지 제자리 편집 — 그 뒤 답변을 버리고 다시 생성한다 */
  function editUser(noteId: number, idx: number, text: string) {
    const old = notes.find((n) => n.id === noteId)?.messages[idx];
    if (!old || pending) return;
    const u = { ...old, text };
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, messages: [...n.messages.slice(0, idx), u] } : n)));
    void respond(noteId, u);
  }

  /** 답변 다시 시도 — 바로 앞 사용자 메시지로 다시 답한다 */
  function retry(noteId: number, aiIdx: number) {
    const u = notes.find((n) => n.id === noteId)?.messages[aiIdx - 1];
    if (!u || u.role !== "user" || pending) return;
    truncate(noteId, aiIdx);
    void respond(noteId, u);
  }

  /** 응답 평가 — 같은 걸 다시 누르면 해제. 추후 성능 평가 데이터로 보낸다 */
  function rate(noteId: number, idx: number, r: "up" | "down") {
    const cur = notes.find((n) => n.id === noteId)?.messages[idx]?.rating;
    updateMessage(noteId, idx, { rating: cur === r ? undefined : r });
  }

  /**
   * 소스 추가 — 파일 선택 즉시 목록 상단에 추가·선택되고,
   * 대화에서 RAG 인덱싱(텍스트 추출→청크 분할→임베딩 등록) 과정을 재생한다.
   * 이후 지식도우미 질문에 이 문서가 최우선 출처로 인용된다.
   */
  function addSourceFiles(files: FileList | null) {
    if (!files?.length) return;
    const now = new Date();
    const updated = `${now.getMonth() + 1}/${now.getDate()}`;
    const fresh = Array.from(files)
      .filter((f) => !sources.some((s) => s.name === f.name))
      .map((f) => ({
        name: f.name,
        type: (f.name.split(".").pop() ?? "파일").toUpperCase(),
        scope: "개인" as const,
        updated,
      }));
    if (!fresh.length) return;
    const nextSrc: SourceState = {
      sources: [...fresh, ...src.sources],
      selected: [...src.selected, ...fresh.map((f) => f.name)],
      uploaded: [...fresh.map((f) => f.name), ...src.uploaded],
    };
    // 활성 대화가 없으면 업로드 문서를 담은 새 노트북을 만들어 분석 과정을 재생한다
    const nid = active ? active.id : createNote("문서 분석", nextSrc);
    if (active) {
      nameNoteIfUntitled(nid, "문서 분석");
      patchSrc(() => nextSrc);
    }
    if (!pending) pushAi(nid, ragIngestMessage(fresh.map((f) => f.name)));
  }

  /** 소스 삭제 — 목록·선택·업로드 추적에서 함께 제거 */
  function removeSource(name: string) {
    patchSrc((s) => ({
      sources: s.sources.filter((d) => d.name !== name),
      selected: s.selected.filter((n) => n !== name),
      uploaded: s.uploaded.filter((n) => n !== name),
    }));
  }

  /** 발주서 제안 시나리오 시작 — 첨부가 달린 사용자 메시지를 보내면 respond가 OCR 경로를 탄다 */
  function triggerOcr() {
    if (pending) return;
    const nid = activeId ?? createNote("발주서 OCR 반영");
    nameNoteIfUntitled(nid, "발주서 OCR 반영");
    const u: ChatMessage = { role: "user", text: "이 발주서 반영해줘", attachment: "발주서_대신금속_26-0702.pdf" };
    appendMessage(nid, u);
    void respond(nid, u);
  }

  /** 발주서 제안 승인/취소 — 카드를 resolved로 굳혀 새로고침 뒤에도 버튼이 다시 뜨지 않게 한다 */
  function resolveOcr(noteId: number, idx: number, approved: boolean) {
    const m = notes.find((n) => n.id === noteId)?.messages[idx];
    if (m?.ocrProposal) updateMessage(noteId, idx, { ocrProposal: { ...m.ocrProposal, resolved: true } });
    if (approved) pushAi(noteId, SCRIPTED_REPLIES[2]);
    else appendMessage(noteId, { role: "ai", text: "반영을 취소했어요. 문서는 소스로만 보관돼요." });
  }

  const stopStreaming = useCallback(() => setStreaming(null), []);
  const closeDrawer = useCallback(() => setDrawer(null), []);

  const composer = (
    <ChatComposer
      value={input}
      onChange={setInput}
      onSend={send}
      thinking={!!pending}
      onAddSource={() => fileRef.current?.click()}
      onOcrDemo={triggerOcr}
      onOpenConnectors={() => setConnectorOpen(true)}
      onOpenSkills={() => setSkillOpen(true)}
    />
  );
  const disclaimer = (
    <p className="mt-2 text-center text-[11px] text-slate-400">
      AI 액션은 ON 상태 기능만 호출하며 실행 전 사용자 확인을 거쳐요.
    </p>
  );

  const last = active?.messages[active.messages.length - 1];
  const drawerMsg = drawer && drawer.noteId === active?.id ? active.messages[drawer.idx] : undefined;

  return (
    <div className="relative flex h-screen gap-3 bg-slate-50 p-3">
      {/* 첫 화면 배경 — 페이지 전체가 캔버스다. 레일·패널·대화가 그 위에 얹힌다. 첫 메시지에 500ms로 옅어진 뒤 내려간다 */}
      {restored && !backdropGone && <AiBackdrop visible={empty} onHidden={() => setBackdropGone(true)} />}
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          addSourceFiles(e.target.files);
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
            selected: s.selected.includes(name) ? s.selected.filter((x) => x !== name) : [...s.selected, name],
          }))
        }
        onToggleAll={() =>
          patchSrc((s) => ({
            ...s,
            selected: s.selected.length === s.sources.length ? [] : s.sources.map((d) => d.name),
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
          <h1 className="min-w-0 truncate text-sm font-bold text-slate-900">{active ? active.title : "AI대화"}</h1>
          <Button variant="secondary" size="sm" onClick={startNewNote}>
            <IconPlus size={14} />새 대화
          </Button>
        </header>

        {!restored ? (
          // 저장된 대화를 읽어오는 동안 — 빈 화면이 번쩍 지나가지 않게 스켈레톤을 둔다
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
                      streaming={streaming === active.id && i === active.messages.length - 1}
                      disabled={!!pending}
                      onStreamDone={stopStreaming}
                      onRetry={() => retry(active.id, i)}
                      onRate={(r) => rate(active.id, i, r)}
                      onOpenSources={() => setDrawer({ noteId: active.id, idx: i })}
                    >
                      {msg.ocrProposal && (
                        <OcrProposalCard
                          proposal={msg.ocrProposal}
                          pending={!msg.ocrProposal.resolved}
                          onResolve={(approved) => resolveOcr(active.id, i, approved)}
                          onUpdate={(fields) =>
                            updateMessage(active.id, i, { ocrProposal: { ...msg.ocrProposal!, fields } })
                          }
                        />
                      )}
                    </AiMessage>
                  ),
                )}

                {/* 답변 생성 중 — 트레이스가 살아 움직인다 */}
                {active && pending?.noteId === active.id && (
                  <div className="min-w-0 max-w-[85%]">
                    <AgentTrace
                      working
                      rows={pending.rows.slice(0, pending.shown)}
                      label={pending.labels[Math.min(pending.shown, pending.labels.length - 1)]}
                    />
                  </div>
                )}

                {/* 답변 중 새로고침·이탈로 끊긴 자리 — 마지막이 사용자 메시지면 다시 보낼 수 있게 */}
                {active && !pending && last?.role === "user" && (
                  <p className="flex items-center gap-2 text-[13px] text-slate-500">
                    답변을 받지 못했어요.
                    <button
                      type="button"
                      onClick={() => void respond(active.id, last)}
                      className="cursor-pointer font-semibold text-slate-700 underline-offset-2 transition-colors hover:text-slate-900 hover:underline"
                    >
                      다시 시도
                    </button>
                  </p>
                )}
              </div>
            </div>

            <div className="px-5 pb-4 pt-1">
              <div className="mx-auto max-w-3xl">
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

      {drawerMsg && <SourceDrawer msg={drawerMsg} onClose={closeDrawer} />}
      <ConnectorModal open={connectorOpen} onClose={() => setConnectorOpen(false)} />
      <SkillModal open={skillOpen} onClose={() => setSkillOpen(false)} />
    </div>
  );
}
