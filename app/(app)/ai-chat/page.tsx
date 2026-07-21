"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  IconArrowRight,
  IconCheck,
  IconCheckCircle,
  IconChevronLeft,
  IconChevronRight,
  IconCpu,
  IconDatabase,
  IconExternalLink,
  IconFile,
  IconLayers,
  IconPencil,
  IconPlus,
  IconScanText,
  IconSearch,
  IconSend,
  IconSparkles,
  IconUpload,
  IconX,
} from "@/components/icons";
import { BrandIcon } from "@/components/brand-icons";
import { ConnectorModal, SkillModal } from "@/components/connector-modal";
import { Button } from "@/components/ui";
import {
  AI_TOOLS_TEASER,
  RAG_FOLDERS,
  REPLY_ROUTES,
  SCRIPTED_CALENDAR_REPLY,
  SCRIPTED_REPLIES,
  SUGGESTED_QUESTIONS,
  ragIngestMessage,
  withUploadedCitation,
  type ChatMessage,
  type ChatProcess,
  type OcrProposal,
  type TraceStep,
} from "@/data/chat";

// NotebookLM식 소스 목록 (폴더 없이 평면)
const INITIAL_SOURCES = RAG_FOLDERS.flatMap((f) => f.docs).map((d) => ({ ...d }));

interface SourceDoc {
  name: string;
  type: string;
  scope: "개인" | "팀" | "전사";
  updated: string;
}

/** 대화(노트북)별 소스 상태 — 새 대화는 빈 노트북으로 시작한다 */
interface SourceState {
  sources: SourceDoc[];
  selected: string[];
  /** 이 대화에서 업로드한 문서 — 지식도우미 답변의 최우선 출처로 인용 */
  uploaded: string[];
}

interface Note {
  id: number;
  title: string;
  messages: ChatMessage[];
  replyIdx: number;
  src: SourceState;
}

/** 입력창 자동 높이 조절 (참고 코드의 useAutoResizeTextarea를 의존성 없이 구현) */
function useAutoResizeTextarea(minHeight: number, maxHeight: number) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const adjust = useCallback(
    (reset?: boolean) => {
      const el = ref.current;
      if (!el) return;
      el.style.height = `${minHeight}px`;
      if (!reset) el.style.height = `${Math.max(minHeight, Math.min(el.scrollHeight, maxHeight))}px`;
    },
    [minHeight, maxHeight],
  );
  return { ref, adjust };
}

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
 * 추론 과정 — 말풍선 없이 답변 위에 표시 (레퍼런스: AI 추론 과정 접기/펼치기/hover).
 * 접힘(기본): 한 줄 요약 · hover 시 '>' 노출 · 클릭하면 세로 타임라인으로 단계별 도구·앱 방문 내역.
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

/** OCR 반영 제안 카드 — 승인 전 필드 편집 가능 */
function OcrProposalCard({
  proposal,
  pending,
  onResolve,
  onUpdate,
}: {
  proposal: OcrProposal;
  pending: boolean;
  onResolve: (approved: boolean) => void;
  onUpdate: (fields: { label: string; value: string }[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(proposal.fields);
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3.5 py-2.5">
        <IconScanText size={15} className="text-slate-500" />
        <p className="text-xs font-semibold text-slate-700">OCR 반영 제안 — {proposal.targetModule}</p>
        {pending && !editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(proposal.fields);
              setEditing(true);
            }}
            className="ml-auto inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-700"
          >
            <IconPencil size={12} />
            편집
          </button>
        )}
      </div>
      {editing ? (
        <div className="divide-y divide-slate-100 px-3.5 text-xs">
          {draft.map((f, i) => (
            <div key={f.label} className="flex items-center justify-between gap-3 py-1.5">
              <label htmlFor={`ocr-field-${i}`} className="shrink-0 text-slate-500">
                {f.label}
              </label>
              <input
                id={`ocr-field-${i}`}
                value={f.value}
                onChange={(e) =>
                  setDraft((prev) => prev.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
                }
                className="w-56 max-w-full rounded-md border border-slate-300 px-2 py-1 text-right text-xs font-semibold text-slate-800 transition-colors focus:border-slate-400 focus:outline-none"
              />
            </div>
          ))}
        </div>
      ) : (
        <dl className="divide-y divide-slate-100 px-3.5 text-xs">
          {proposal.fields.map((f) => (
            <div key={f.label} className="flex items-center justify-between py-2">
              <dt className="text-slate-500">{f.label}</dt>
              <dd className="font-semibold text-slate-800">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {editing ? (
        <div className="flex gap-2 border-t border-slate-100 bg-slate-50 px-3.5 py-2.5">
          <Button
            size="sm"
            onClick={() => {
              onUpdate(draft);
              setEditing(false);
            }}
          >
            <IconCheck size={13} />
            수정 내용 저장
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
            취소
          </Button>
        </div>
      ) : pending ? (
        <div className="flex gap-2 border-t border-slate-100 bg-slate-50 px-3.5 py-2.5">
          <Button size="sm" onClick={() => onResolve(true)}>
            <IconCheck size={13} />
            승인하고 반영
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onResolve(false)}>
            <IconX size={13} />
            거절
          </Button>
        </div>
      ) : (
        <p className="border-t border-slate-100 bg-slate-50 px-3.5 py-2 text-[11px] text-slate-400">
          처리 완료된 제안입니다.
        </p>
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
  /** Google Calendar 미연결 — connectUrl로 안내(진짜 캘린더 방문 전 사용자 동의가 필요) */
  notConnected?: boolean;
  connectUrl?: string;
}

/** /api/chat 시나리오 호출 — 키 미설정(501)·오류 시 null을 돌려 데모 스크립트로 폴백한다 */
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
    const data = (await res.json().catch(() => null)) as (ScenarioResult & { error?: string }) | null;
    if (!data) return null;
    if (data.error === "google_not_connected") {
      return { notConnected: true, connectUrl: data.connectUrl, reply: data.reply, trace: [], tools: [], sources: [] };
    }
    if (!res.ok) return null;
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

export default function AiChatPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const [connectorOpen, setConnectorOpen] = useState(false);
  const [skillOpen, setSkillOpen] = useState(false);
  /** 첫 대화 생성 전(시작 화면)의 소스 — 첫 대화가 이 상태를 승계한다 */
  const [draftSrc, setDraftSrc] = useState<SourceState>({
    sources: INITIAL_SOURCES,
    selected: INITIAL_SOURCES.map((s) => s.name),
    uploaded: [],
  });
  const [ocrPending, setOcrPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const noteSeq = useRef(1);
  // border-box 기준 — pt-3.5(14px) + 한 줄(20px) = 최소 38px
  const { ref: inputRef, adjust: adjustInput } = useAutoResizeTextarea(38, 160);

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

  const allSelected = sources.length > 0 && selectedSources.length === sources.length;
  const someSelected = selectedSources.length > 0 && !allSelected;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [active?.messages, thinking, thinkingSteps]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setAddMenu(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

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
    const s = srcInit ?? (active ? { sources: [], selected: [], uploaded: [] } : draftSrc);
    setNotes((prev) => [...prev, { id, title, messages: [], replyIdx: 0, src: s }]);
    setActiveId(id);
    return id;
  }

  /** 새 대화 = 새 노트북 생성 — 소스 없이 빈 상태로 시작한다 */
  function startNewNote() {
    createNote("새 대화", { sources: [], selected: [], uploaded: [] });
  }

  /** 비어 있는 '새 대화' 노트북에 첫 활동이 생기면 제목을 붙인다 — 대화 드롭다운에서 구분되도록 */
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
    adjustInput(true);
    nameNoteIfUntitled(nid, q.length > 18 ? q.slice(0, 18) + "…" : q);
    appendMessage(nid, { role: "user", text: q });

    // 구글 캘린더 확인 시나리오 — Google Calendar API를 실제로 조회한다 (키 미설정 시 스크립트 폴백)
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
        if (r?.notConnected) {
          setThinking(false);
          setThinkingSteps([]);
          appendMessage(nid, {
            role: "ai",
            text: r.reply || "Google Calendar가 아직 연결되지 않았어요.",
            cta: { label: "Google Calendar 연결하기", href: r.connectUrl ?? "/api/auth/google" },
          });
        } else if (r) {
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

  return (
    <div className="flex h-screen gap-3 bg-slate-50 p-3">
      {/* ── 좌측: 소스 패널 (플로팅 카드 · 부드러운 접기) ── */}
      <aside
        className={`hidden shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-[width] duration-300 ease-in-out lg:flex ${
          leftCollapsed ? "w-12" : "w-72"
        }`}
      >
        <div className={`flex items-center border-b border-slate-100 py-3 ${leftCollapsed ? "justify-center px-0" : "justify-between px-4"}`}>
          {!leftCollapsed && (
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900">소스</h2>
              <p className="mt-0.5 truncate text-xs text-slate-500">AI가 참고할 문서를 선택하세요</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setLeftCollapsed((v) => !v)}
            aria-label={leftCollapsed ? "소스 패널 펼치기" : "소스 패널 접기"}
            aria-expanded={!leftCollapsed}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            {leftCollapsed ? <IconChevronRight size={17} /> : <IconChevronLeft size={17} />}
          </button>
        </div>
        <div
          className={`flex w-72 min-w-0 flex-1 flex-col transition-opacity duration-200 ${
            leftCollapsed ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <div className="space-y-2.5 border-b border-slate-100 p-3">
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
            <Button variant="secondary" size="sm" className="w-full" onClick={() => fileRef.current?.click()}>
              <IconUpload size={14} />
              소스 추가
            </Button>
            {/* 전체 선택/해제 — 소스가 있을 때만 표시 */}
            {sources.length > 0 && (
              <label className="flex cursor-pointer items-center gap-2 px-1 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={() => patchSrc((s) => ({ ...s, selected: allSelected ? [] : s.sources.map((d) => d.name) }))}
                  className="h-3.5 w-3.5 cursor-pointer accent-slate-800"
                  aria-label="소스 전체 선택/해제"
                />
                전체 선택
                <span className="ml-auto text-slate-400">
                  {selectedSources.length}/{sources.length}
                </span>
              </label>
            )}
          </div>
          <ul className="thin-scroll flex-1 space-y-0.5 overflow-y-auto p-2">
            {sources.length === 0 && (
              <li className="mx-1 mt-1 rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center text-xs leading-relaxed text-slate-400">
                새 노트북이에요.
                <br />
                문서를 추가하면 AI가 분석해
                <br />
                답변 근거로 사용해요.
              </li>
            )}
            {sources.map((doc) => {
              const on = selectedSources.includes(doc.name);
              return (
                <li key={doc.name} className="group relative">
                  <button
                    type="button"
                    onClick={() =>
                      patchSrc((s) => ({
                        ...s,
                        selected: on ? s.selected.filter((x) => x !== doc.name) : [...s.selected, doc.name],
                      }))
                    }
                    className="flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 pr-8 text-left transition-colors hover:bg-slate-50"
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        on ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300"
                      }`}
                    >
                      {on && <IconCheck size={11} />}
                    </span>
                    <IconFile size={14} className="mt-0.5 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-slate-700">{doc.name}</span>
                      <span className="mt-0.5 block text-[10px] text-slate-400">
                        {doc.type} · {doc.scope} · {doc.updated}
                      </span>
                    </span>
                  </button>
                  {/* 소스 삭제 — 호버 시에만 표시 (무채색 유지) */}
                  <button
                    type="button"
                    onClick={() => removeSource(doc.name)}
                    aria-label={`${doc.name} 삭제`}
                    title="소스 삭제"
                    className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-slate-400 opacity-0 transition-[opacity,color,background-color] hover:bg-slate-200/70 hover:text-slate-600 focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <IconX size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-slate-100 px-4 py-2.5 text-[10px] leading-relaxed text-slate-400">
            PDF·이미지·XLSX·DOCX 지원. 공개 범위와 역할 권한에 따라 접근이 제어됩니다.
          </p>
        </div>
      </aside>

      {/* ── 중앙: 대화 ── */}
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-sm font-bold text-slate-900">{active ? active.title : "AI대화"}</h1>
            {notes.length > 0 && (
              <span className="hidden text-xs text-slate-400 sm:inline">대화 {notes.length}개</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {notes.length > 1 && (
              <select
                value={activeId ?? ""}
                onChange={(e) => setActiveId(Number(e.target.value))}
                aria-label="대화 선택"
                className="cursor-pointer rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600"
              >
                {notes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
            )}
            <Button variant="secondary" size="sm" onClick={startNewNote}>
              <IconPlus size={14} />새 대화
            </Button>
          </div>
        </header>

        <div ref={scrollRef} className="thin-scroll flex-1 overflow-y-auto px-5 py-5">
          {!active || active.messages.length === 0 ? (
            <div className="mx-auto mt-10 max-w-lg text-center">
              <h2 className="text-base font-bold text-slate-900">새 대화를 시작하세요</h2>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {SUGGESTED_QUESTIONS.map((s) => (
                  <button
                    key={s.q}
                    type="button"
                    onClick={() => send(s.q)}
                    className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-left text-sm text-slate-700 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50"
                  >
                    {s.demo && (
                      <span className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold tracking-wide text-slate-400">
                        <IconSparkles size={11} />
                        데모 시연 — 지식도우미
                      </span>
                    )}
                    {s.q}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={triggerOcr}
                className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100"
              >
                <IconScanText size={16} />
                발주서 OCR 반영 데모 체험
              </button>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-5">
              {active.messages.map((msg, i) =>
                msg.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl bg-slate-100 px-4 py-2.5 text-sm leading-relaxed text-slate-800">
                      {msg.attachment && (
                        <p className="mb-1.5 flex items-center gap-1.5 rounded-lg bg-slate-900/5 px-2.5 py-1.5 text-xs">
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
                              <span className="block truncate text-[11px] text-slate-400">&ldquo;{s.snippet}&rdquo;</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ),
              )}

              {/* 추론 로딩 — 말풍선 없이 쉬머 텍스트만 (ChatGPT·Gemini식) */}
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
          )}
        </div>

        {/* 하단 입력바 — 플로팅 (참고 코드 재구성 · 모델 선택/파일 첨부 대신 + 메뉴) */}
        <div className="px-5 pb-4 pt-1">
          <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors focus-within:border-slate-400">
            <label htmlFor="chat-input" className="sr-only">
              질문 입력
            </label>
            <textarea
              id="chat-input"
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                adjustInput();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="AI에게 물어보기"
              className="thin-scroll block w-full resize-none border-none bg-transparent px-4 pt-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            <div className="flex items-center justify-between px-2.5 pb-2.5 pt-1.5">
              <div className="relative" ref={addRef}>
                <button
                  type="button"
                  onClick={() => setAddMenu((v) => !v)}
                  aria-label="커넥터·스킬 추가"
                  aria-expanded={addMenu}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <IconPlus size={17} />
                </button>
                {addMenu && (
                  <div className="absolute bottom-full left-0 mb-2 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setAddMenu(false);
                        setConnectorOpen(true);
                      }}
                      className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100"
                    >
                      <IconLayers size={16} className="text-slate-400" />
                      커넥터 추가
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddMenu(false);
                        setSkillOpen(true);
                      }}
                      className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100"
                    >
                      <IconSparkles size={16} className="text-slate-400" />
                      스킬 추가
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => send()}
                aria-label="전송"
                disabled={!input.trim() || thinking}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-200 ${
                  input.trim() && !thinking
                    ? "cursor-pointer bg-primary-600 text-white hover:bg-primary-700"
                    : "cursor-not-allowed bg-slate-100 text-slate-300"
                }`}
              >
                <IconSend size={15} />
              </button>
            </div>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-slate-400">
            AI 액션은 ON 상태 기능만 호출하며 실행 전 사용자 확인을 거칩니다.
          </p>
        </div>
      </section>

      {/* ── 우측: AI도구 패널 (플로팅 카드 · 부드러운 접기) ── */}
      <aside
        className={`hidden shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-[width] duration-300 ease-in-out xl:flex ${
          rightCollapsed ? "w-12" : "w-64"
        }`}
      >
        <div className={`flex items-center border-b border-slate-100 py-3 ${rightCollapsed ? "justify-center px-0" : "justify-between px-4"}`}>
          {!rightCollapsed && (
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              AI도구
              <span className="text-[10px] font-semibold text-amber-600">준비중</span>
            </h2>
          )}
          <button
            type="button"
            onClick={() => setRightCollapsed((v) => !v)}
            aria-label={rightCollapsed ? "AI도구 패널 펼치기" : "AI도구 패널 접기"}
            aria-expanded={!rightCollapsed}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            {rightCollapsed ? <IconChevronLeft size={17} /> : <IconChevronRight size={17} />}
          </button>
        </div>
        <div
          className={`w-64 flex-1 px-4 py-5 transition-opacity duration-200 ${
            rightCollapsed ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <p className="text-xs leading-relaxed text-slate-500">
            AI도구 패널은 차기 버전에서 제공될 예정입니다. 아래 기능들이 검토되고 있습니다.
          </p>
          <ul className="mt-4 space-y-2.5">
            {AI_TOOLS_TEASER.map((tool) => (
              <li key={tool.name} className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3.5 py-3">
                <p className="flex items-center justify-between text-sm font-semibold text-slate-600">
                  {tool.name}
                  <span className="text-[10px] font-medium text-slate-400">예정</span>
                </p>
                <p className="mt-0.5 text-xs text-slate-400">{tool.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <ConnectorModal open={connectorOpen} onClose={() => setConnectorOpen(false)} />
      <SkillModal open={skillOpen} onClose={() => setSkillOpen(false)} />
    </div>
  );
}
