"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  IconArrowRight,
  IconCheck,
  IconCheckCircle,
  IconChevronRight,
  IconCpu,
  IconDatabase,
  IconExternalLink,
  IconFile,
  IconPlus,
  IconSearch,
} from "@/components/icons";
import { BrandIcon } from "@/components/brand-icons";
import { ConnectorModal, SkillModal } from "@/components/connector-modal";
import { Button } from "@/components/ui";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatRail } from "@/components/chat/chat-rail";
import { OcrProposalCard } from "@/components/chat/ocr-proposal-card";
import { loadChat, saveChat } from "@/lib/chat-storage";
import {
  RAG_FOLDERS,
  REPLY_ROUTES,
  SCRIPTED_CALENDAR_REPLY,
  SCRIPTED_REPLIES,
  ragIngestMessage,
  withUploadedCitation,
  type ChatMessage,
  type ChatProcess,
  type Note,
  type SourceState,
  type TraceStep,
} from "@/data/chat";

// NotebookLM식 소스 목록 (폴더 없이 평면)
const INITIAL_SOURCES = RAG_FOLDERS.flatMap((f) => f.docs).map((d) => ({ ...d }));

/** 일반 단계 아이콘 — 외부 서비스(calendar·mail)는 TraceIcon에서 브랜드 로고로 처리 */
const TRACE_ICONS = {
  search: IconSearch,
  data: IconDatabase,
  doc: IconFile,
  app: IconExternalLink,
  model: IconCpu,
} as const;

/** 트레이스 아이콘 — 실제 연동된 외부 서비스(구글 캘린더·Gmail)는 브랜드 로고, 그 외는 일반 아이콘 */
function TraceIcon({ icon }: { icon?: TraceStep["icon"] }) {
  if (icon === "calendar") return <BrandIcon slug="googlecalendar" size={15} />;
  if (icon === "mail") return <BrandIcon slug="gmail" size={15} />;
  const Icon = icon && icon in TRACE_ICONS ? TRACE_ICONS[icon as keyof typeof TRACE_ICONS] : IconSearch;
  return <Icon size={14} className="text-slate-400" />;
}

/**
 * 추론 과정 — 말풍선 없이 답변 위에 표시.
 * 접힘(기본): 한 줄 요약 · hover 시 '>' 노출 · 클릭하면 세로 타임라인으로 단계별 도구·앱 방문 내역.
 *
 * 이 UI는 Vercel AI SDK 점검 후 별도로 다룬다 — 이번 리뉴얼에서는 손대지 않았다.
 */
function ReasoningTrace({ process }: { process: ChatProcess }) {
  const [open, setOpen] = useState(false);
  const trace: TraceStep[] = process.trace ?? process.steps.map((text) => ({ text }));
  const summary = process.summary ?? `${process.tools.length}개의 도구 사용됨, ${process.tools.join(", ")}`;
  return (
    <div className="mb-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="group flex cursor-pointer items-center gap-1 text-left text-[13px] text-slate-500 transition-colors hover:text-slate-700"
      >
        {summary}
        <IconChevronRight
          size={13}
          className={`shrink-0 text-slate-400 transition-all duration-150 ${
            open ? "rotate-90 opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        />
      </button>
      {open && (
        <div className="mt-2.5">
          {trace.map((t, i) => (
            <div key={`${t.text}-${i}`} className="flex gap-2.5">
              <div className="flex flex-col items-center">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  <TraceIcon icon={t.icon} />
                </span>
                <span className="w-px flex-1 bg-slate-200" />
              </div>
              <div className="min-w-0 flex-1 pb-3 text-[13px]">
                <p className="leading-relaxed text-slate-600">{t.text}</p>
                {t.result && (
                  <span className="mt-1.5 inline-block rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                    {t.result}
                  </span>
                )}
              </div>
            </div>
          ))}
          <div className="flex gap-2.5">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              <IconCheckCircle size={14} className="text-slate-400" />
            </span>
            <span className="text-[13px] text-slate-500">완료</span>
          </div>
        </div>
      )}
    </div>
  );
}

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

export default function AiChatPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [connectorOpen, setConnectorOpen] = useState(false);
  const [skillOpen, setSkillOpen] = useState(false);
  /** 첫 대화 생성 전(시작 화면)의 소스 — 첫 대화가 이 상태를 승계한다 */
  const [draftSrc, setDraftSrc] = useState<SourceState>({
    sources: INITIAL_SOURCES,
    selected: INITIAL_SOURCES.map((s) => s.name),
    uploaded: [],
  });
  const [ocrPending, setOcrPending] = useState(false);
  /** localStorage 복원이 끝나기 전에는 저장하지 않는다 — 빈 상태로 덮어쓰는 걸 막는다 */
  const [restored, setRestored] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const noteSeq = useRef(1);

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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [active?.messages, thinking, thinkingSteps]);

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

  function createNote(title = "새 대화", srcInit?: SourceState): number {
    const id = ++noteSeq.current;
    // 시작 화면에서 자동 생성되는 첫 대화는 화면에 보이던 소스(초안)를 승계한다
    const s = srcInit ?? (active ? EMPTY_SRC : draftSrc);
    setNotes((prev) => [...prev, { id, title, messages: [], replyIdx: 0, src: s }]);
    setActiveId(id);
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
      if (id === activeId) setActiveId(next.length ? next[next.length - 1].id : null);
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

  /** 추론 과정 문구를 하나씩 순차 표시한 뒤 답변을 붙인다 — 실제 AI 응답은 trace 문구로 재생 */
  function pushAi(noteId: number, msg: ChatMessage, stepsOverride?: string[]) {
    const steps =
      stepsOverride ??
      msg.reasoning ?? ["질문의 의도를 파악하고 있어요", "관련 데이터를 살펴보고 있어요", "답변을 정리하고 있어요"];
    setThinking(true);
    setThinkingSteps([]);
    steps.forEach((s, i) => {
      setTimeout(() => setThinkingSteps((prev) => [...prev, s]), i * 850);
    });
    setTimeout(() => {
      setThinking(false);
      setThinkingSteps([]);
      appendMessage(noteId, msg);
      if (msg.ocrProposal) setOcrPending(true);
    }, steps.length * 850 + 600);
  }

  function send(text?: string, noteId?: number) {
    const q = (text ?? input).trim();
    if (!q || thinking) return;
    const nid = noteId ?? activeId ?? createNote(q.length > 18 ? q.slice(0, 18) + "…" : q);
    setInput("");
    nameNoteIfUntitled(nid, q.length > 18 ? q.slice(0, 18) + "…" : q);
    appendMessage(nid, { role: "user", text: q });

    // 구글 캘린더 확인 시나리오 — BE API 연동 전까지는 스크립트 폴백으로 동작한다
    if (/캘린더|일정|calendar/i.test(q)) {
      setThinking(true);
      // 응답 대기 중에도 어떤 도구(Google Calendar)와 소스를 쓰는지 보이게 순차 표시
      setThinkingSteps(["질문의 의도를 파악하고 있어요"]);
      const loadingTimers = [
        setTimeout(() => setThinkingSteps((prev) => [...prev, "Google Calendar에서 일정을 불러오고 있어요"]), 850),
      ];
      if (selectedSources.length > 0) {
        loadingTimers.push(
          setTimeout(() => setThinkingSteps((prev) => [...prev, "선택한 소스 문서를 함께 확인하고 있어요"]), 1900),
        );
      }
      void callScenario("calendar", q, selectedSources).then((r) => {
        loadingTimers.forEach(clearTimeout);
        if (r) {
          pushAi(nid, scenarioToMessage(r), r.trace.map((t) => t.text));
        } else {
          pushAi(nid, SCRIPTED_CALENDAR_REPLY);
        }
      });
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
    const idxPos = note?.replyIdx ?? 0;
    const scriptIdx = order[idxPos];
    setNotes((prev) => prev.map((n) => (n.id === nid ? { ...n, replyIdx: Math.min(n.replyIdx + 1, order.length) } : n)));
    pushAi(
      nid,
      scriptIdx !== undefined
        ? SCRIPTED_REPLIES[scriptIdx]
        : {
            role: "ai",
            text: "데모 시나리오 응답을 모두 재생했습니다. 실제 서비스에서는 연결된 커넥터·스킬과 ON 상태 기능 데이터를 기반으로 답변이 생성됩니다.",
          },
    );
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
    if (!thinking) pushAi(nid, ragIngestMessage(fresh.map((f) => f.name)));
  }

  /** 소스 삭제 — 목록·선택·업로드 추적에서 함께 제거 */
  function removeSource(name: string) {
    patchSrc((s) => ({
      sources: s.sources.filter((d) => d.name !== name),
      selected: s.selected.filter((n) => n !== name),
      uploaded: s.uploaded.filter((n) => n !== name),
    }));
  }

  /** 발주서 제안 시나리오 — 실제 AI가 OCR 텍스트를 근거로 제안·추론 과정을 생성 (키 미설정 시 스크립트 폴백) */
  async function triggerOcr() {
    if (thinking) return;
    const nid = activeId ?? createNote("발주서 OCR 반영");
    nameNoteIfUntitled(nid, "발주서 OCR 반영");
    appendMessage(nid, { role: "user", text: "이 발주서 반영해줘", attachment: "발주서_대신금속_26-0702.pdf" });
    setThinking(true);
    setThinkingSteps(["발주서를 읽고 있어요"]);
    const r = await callScenario(
      "purchase-order",
      "첨부한 발주서(대신금속, 황동봉 C3604 Ø12 800kg)를 읽고 구매 관리 등록을 제안해줘",
    );
    if (r?.proposal) {
      pushAi(
        nid,
        scenarioToMessage(r, { docName: "발주서_대신금속_26-0702.pdf", targetModule: "경영지원 > 구매 관리" }),
        r.trace.map((t) => t.text),
      );
    } else {
      pushAi(nid, SCRIPTED_REPLIES[1]);
    }
  }

  function resolveOcr(noteId: number, approved: boolean) {
    setOcrPending(false);
    if (approved) pushAi(noteId, SCRIPTED_REPLIES[2]);
    else appendMessage(noteId, { role: "ai", text: "반영을 취소했습니다. 문서는 소스로만 보관됩니다." });
  }

  const composer = (
    <ChatComposer
      value={input}
      onChange={setInput}
      onSend={() => send()}
      thinking={thinking}
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
  const empty = !active || active.messages.length === 0;

  return (
    <div className="flex h-screen gap-3 bg-slate-50 p-3">
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
        onSelectNote={setActiveId}
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
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 py-3.5">
          <h1 className="min-w-0 truncate text-sm font-bold text-slate-900">{active ? active.title : "AI대화"}</h1>
          <Button variant="secondary" size="sm" onClick={startNewNote}>
            <IconPlus size={14} />새 대화
          </Button>
        </header>

        {empty ? (
          // 첫 화면 — 입력바가 수직 중앙에 선다. 첫 메시지를 보내면 아래 분기로 넘어가 하단에 고정된다
          <div className="flex flex-1 items-center justify-center px-5 pb-10">
            <div className="w-full max-w-3xl">
              {composer}
              {disclaimer}
            </div>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="thin-scroll flex-1 overflow-y-auto px-5 py-5">
              <div className="mx-auto max-w-3xl space-y-5">
                {active.messages.map((msg, i) =>
                  msg.role === "user" ? (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[80%] rounded-2xl bg-slate-200/70 px-4 py-2.5 text-sm leading-relaxed text-slate-800">
                        {msg.attachment && (
                          <p className="mb-1.5 flex items-center gap-1.5 rounded-lg bg-white/70 px-2.5 py-1.5 text-xs">
                            <IconFile size={13} /> {msg.attachment}
                          </p>
                        )}
                        {msg.text}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="min-w-0 max-w-[85%]">
                      {/* 추론 과정 — 말풍선 없이 답변 위에 표시 */}
                      {msg.process && <ReasoningTrace process={msg.process} />}
                      <div className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                        {msg.text}
                        {msg.ocrProposal && (
                          <OcrProposalCard
                            proposal={msg.ocrProposal}
                            pending={i === active.messages.length - 1 && ocrPending}
                            onResolve={(approved) => resolveOcr(active.id, approved)}
                            onUpdate={(fields) =>
                              updateMessage(active.id, i, { ocrProposal: { ...msg.ocrProposal!, fields } })
                            }
                          />
                        )}
                      </div>
                      {msg.cta && (
                        <Link
                          href={msg.cta.href}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
                        >
                          {msg.cta.label} <IconArrowRight size={13} />
                        </Link>
                      )}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <p className="text-[11px] font-semibold text-slate-400">출처 인용</p>
                          {msg.sources.map((s) => (
                            <button
                              key={s.doc}
                              type="button"
                              className="flex w-full cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-slate-300"
                              title="클릭 시 원문으로 이동"
                            >
                              <IconFile size={13} className="mt-0.5 shrink-0 text-slate-400" />
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-medium text-slate-700">{s.doc}</span>
                                <span className="block truncate text-[11px] text-slate-400">
                                  &ldquo;{s.snippet}&rdquo;
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ),
                )}

                {/* 추론 로딩 — 말풍선 없이 쉬머 텍스트만 */}
                {thinking && (
                  <div className="min-w-0 max-w-[85%]">
                    <ul className="space-y-1.5">
                      {thinkingSteps.map((s, i) => {
                        const isCurrent = i === thinkingSteps.length - 1;
                        return (
                          <li key={s} className="flex items-center gap-2 text-[13px]">
                            {isCurrent ? (
                              <span className="shimmer-text font-medium">{s}…</span>
                            ) : (
                              <>
                                <IconCheck size={12} className="shrink-0 text-slate-400" />
                                <span className="text-slate-400">{s}</span>
                              </>
                            )}
                          </li>
                        );
                      })}
                      {thinkingSteps.length === 0 && (
                        <li className="shimmer-text text-[13px] font-medium">생각하는 중…</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 pb-4 pt-1">
              <div className="mx-auto max-w-3xl">
                {composer}
                {disclaimer}
              </div>
            </div>
          </>
        )}
      </section>

      <ConnectorModal open={connectorOpen} onClose={() => setConnectorOpen(false)} />
      <SkillModal open={skillOpen} onClose={() => setSkillOpen(false)} />
    </div>
  );
}
