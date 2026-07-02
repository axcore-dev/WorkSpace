"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  IconArrowRight,
  IconBot,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconFile,
  IconLayers,
  IconPlus,
  IconScanText,
  IconSend,
  IconSparkles,
  IconUpload,
  IconX,
} from "@/components/icons";
import { ConnectorModal, SkillModal } from "@/components/connector-modal";
import { Button } from "@/components/ui";
import {
  AI_TOOLS_TEASER,
  RAG_FOLDERS,
  SCRIPTED_REPLIES,
  SUGGESTED_QUESTIONS,
  type ChatMessage,
} from "@/data/chat";

// NotebookLM식 소스 목록 (폴더 없이 평면)
const SOURCES = RAG_FOLDERS.flatMap((f) => f.docs).map((d) => ({ ...d }));

interface Note {
  id: number;
  title: string;
  messages: ChatMessage[];
  replyIdx: number;
}

function ProcessDisclosure({ process }: { process: NonNullable<ChatMessage["process"]> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50/70">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:text-slate-700"
      >
        {open ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
        사고 과정 및 사용 도구 보기
        <span className="ml-auto flex flex-wrap gap-1">
          {process.tools.map((t) => (
            <span key={t} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
              {t}
            </span>
          ))}
        </span>
      </button>
      {open && (
        <div className="space-y-2.5 border-t border-slate-200 px-3 py-2.5 text-xs">
          <div>
            <p className="font-semibold text-slate-600">데이터 소스</p>
            <p className="mt-0.5 text-slate-500">{process.sources.join(" · ")}</p>
          </div>
          <div>
            <p className="font-semibold text-slate-600">분석 과정</p>
            <ol className="mt-0.5 list-inside list-decimal space-y-0.5 text-slate-500">
              {process.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
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
  const [selectedSources, setSelectedSources] = useState<string[]>(SOURCES.map((s) => s.name));
  const [ocrPending, setOcrPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLDivElement>(null);
  const noteSeq = useRef(1);

  const active = notes.find((n) => n.id === activeId) ?? null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [active?.messages, thinking]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setAddMenu(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function createNote(title = "새 대화"): number {
    const id = ++noteSeq.current;
    setNotes((prev) => [...prev, { id, title, messages: [], replyIdx: 0 }]);
    setActiveId(id);
    return id;
  }

  function appendMessage(noteId: number, msg: ChatMessage) {
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, messages: [...n.messages, msg] } : n)));
  }

  function pushAi(noteId: number, msg: ChatMessage, delay = 900) {
    setThinking(true);
    setThinkingSteps(msg.process?.steps ?? ["질문 의도 분석", "관련 데이터 조회", "답변 생성"]);
    setTimeout(() => {
      setThinking(false);
      setThinkingSteps([]);
      appendMessage(noteId, msg);
      if (msg.ocrProposal) setOcrPending(true);
    }, delay);
  }

  function send(text?: string, noteId?: number) {
    const q = (text ?? input).trim();
    if (!q || thinking) return;
    const nid = noteId ?? activeId ?? createNote(q.length > 18 ? q.slice(0, 18) + "…" : q);
    setInput("");
    appendMessage(nid, { role: "user", text: q });
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

  function triggerOcr() {
    if (thinking) return;
    const nid = activeId ?? createNote("발주서 OCR 반영");
    appendMessage(nid, { role: "user", text: "이 발주서 반영해줘", attachment: "발주서_대신금속_26-0702.pdf" });
    pushAi(nid, SCRIPTED_REPLIES[1], 1100);
  }

  function resolveOcr(noteId: number, approved: boolean) {
    setOcrPending(false);
    if (approved) pushAi(noteId, SCRIPTED_REPLIES[2], 900);
    else appendMessage(noteId, { role: "ai", text: "반영을 취소했습니다. 문서는 소스로만 보관됩니다." });
  }

  return (
    <div className="flex h-screen">
      {/* ── 좌측: 소스 (NotebookLM식) ── */}
      {leftCollapsed ? (
        <aside className="hidden w-12 shrink-0 flex-col items-center gap-2 border-r border-slate-200 bg-white py-4 lg:flex">
          <button
            type="button"
            onClick={() => setLeftCollapsed(false)}
            aria-label="소스 패널 펼치기"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
          >
            <IconLayers size={18} />
          </button>
        </aside>
      ) : (
        <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">소스</h2>
              <p className="mt-0.5 text-xs text-slate-500">AI가 참고할 문서를 선택하세요</p>
            </div>
            <button
              type="button"
              onClick={() => setLeftCollapsed(true)}
              aria-label="소스 패널 접기"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <IconChevronLeft size={18} />
            </button>
          </div>
          <div className="border-b border-slate-100 p-3">
            <Button variant="secondary" size="sm" className="w-full">
              <IconUpload size={14} />
              소스 추가
            </Button>
          </div>
          <ul className="thin-scroll flex-1 space-y-0.5 overflow-y-auto p-2">
            {SOURCES.map((doc) => {
              const on = selectedSources.includes(doc.name);
              return (
                <li key={doc.name}>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedSources((prev) => (on ? prev.filter((x) => x !== doc.name) : [...prev, doc.name]))
                    }
                    className="flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-slate-50"
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
                </li>
              );
            })}
          </ul>
          <p className="border-t border-slate-100 px-4 py-2.5 text-[10px] leading-relaxed text-slate-400">
            선택 {selectedSources.length}개 · PDF·이미지·XLSX·DOCX 지원. 공개 범위와 역할 권한에 따라 접근이 제어됩니다.
          </p>
        </aside>
      )}

      {/* ── 중앙: 대화 ── */}
      <section className="flex min-w-0 flex-1 flex-col bg-slate-50">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {leftCollapsed && (
              <button
                type="button"
                onClick={() => setLeftCollapsed(false)}
                aria-label="소스 열기"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 lg:hidden"
              >
                <IconLayers size={16} />
              </button>
            )}
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
            <Button variant="secondary" size="sm" onClick={() => createNote()}>
              <IconPlus size={14} />새 대화
            </Button>
          </div>
        </header>

        <div ref={scrollRef} className="thin-scroll flex-1 overflow-y-auto px-5 py-5">
          {!active || active.messages.length === 0 ? (
            <div className="mx-auto mt-10 max-w-lg text-center">
              <span className="mx-auto mb-4 flex items-center justify-center text-slate-400">
                <IconSparkles size={30} />
              </span>
              <h2 className="text-base font-bold text-slate-900">새 대화를 시작하세요</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                생산·품질·재고 데이터와 선택한 소스를 통합 검색해 답변합니다. 커넥터·스킬을 추가해 대화에서
                바로 활용할 수 있어요.
              </p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {SUGGESTED_QUESTIONS.map((qq) => (
                  <button
                    key={qq}
                    type="button"
                    onClick={() => send(qq)}
                    className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-left text-sm text-slate-700 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50"
                  >
                    {qq}
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
                    <div className="max-w-[80%] rounded-2xl rounded-br-md bg-slate-800 px-4 py-2.5 text-sm leading-relaxed text-white">
                      {msg.attachment && (
                        <p className="mb-1.5 flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-xs">
                          <IconFile size={13} /> {msg.attachment}
                        </p>
                      )}
                      {msg.text}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <IconBot size={16} />
                    </span>
                    <div className="min-w-0 max-w-[85%]">
                      <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700">
                        {msg.text}
                        {msg.ocrProposal && (
                          <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
                            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3.5 py-2.5">
                              <IconScanText size={15} className="text-slate-500" />
                              <p className="text-xs font-semibold text-slate-700">
                                OCR 반영 제안 — {msg.ocrProposal.targetModule}
                              </p>
                            </div>
                            <dl className="divide-y divide-slate-100 px-3.5 text-xs">
                              {msg.ocrProposal.fields.map((f) => (
                                <div key={f.label} className="flex items-center justify-between py-2">
                                  <dt className="text-slate-500">{f.label}</dt>
                                  <dd className="font-semibold text-slate-800">{f.value}</dd>
                                </div>
                              ))}
                            </dl>
                            {i === active.messages.length - 1 && ocrPending ? (
                              <div className="flex gap-2 border-t border-slate-100 bg-slate-50 px-3.5 py-2.5">
                                <Button size="sm" onClick={() => resolveOcr(active.id, true)}>
                                  <IconCheck size={13} />
                                  승인하고 반영
                                </Button>
                                <Button size="sm" variant="secondary" onClick={() => resolveOcr(active.id, false)}>
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
                      {msg.process && <ProcessDisclosure process={msg.process} />}
                    </div>
                  </div>
                ),
              )}

              {/* 추론(Thinking) 과정 UI */}
              {thinking && (
                <div className="flex gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <IconBot size={16} />
                  </span>
                  <div className="min-w-0 max-w-[85%] rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3">
                    <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <span className="flex gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
                      </span>
                      추론 중…
                    </p>
                    <ul className="mt-2.5 space-y-1.5">
                      {thinkingSteps.map((s, i) => (
                        <li key={s} className="flex items-start gap-2 text-xs text-slate-500">
                          <span
                            className="mt-1 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-slate-300"
                            style={{ animationDelay: `${i * 200}ms` }}
                          />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 입력창 */}
        <div className="border-t border-slate-200 bg-white px-5 py-3.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="mx-auto flex max-w-3xl items-end gap-2"
          >
            <div className="relative" ref={addRef}>
              <button
                type="button"
                onClick={() => setAddMenu((v) => !v)}
                aria-label="커넥터·스킬 추가"
                aria-expanded={addMenu}
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
              >
                <IconPlus size={18} />
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
            <label htmlFor="chat-input" className="sr-only">
              질문 입력
            </label>
            <input
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="자연어로 질문하세요. 예: 6월 CNC 1라인 불량률과 원인을 알려줘"
              className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-400 focus:outline-2 focus:outline-slate-300/60"
            />
            <Button type="submit" aria-label="전송" disabled={!input.trim() || thinking} className="h-10 w-10 !p-0">
              <IconSend size={16} />
            </Button>
          </form>
          <p className="mx-auto mt-2 max-w-3xl text-[11px] text-slate-400">
            AI 액션은 ON 상태 기능만 호출하며 실행 전 사용자 확인을 거칩니다. 답변에는 사용한 데이터 소스·추론
            과정·도구가 함께 표시됩니다.
          </p>
        </div>
      </section>

      {/* ── 우측: AI도구 (아이콘으로 접기) ── */}
      {rightCollapsed ? (
        <aside className="hidden w-12 shrink-0 flex-col items-center gap-2 border-l border-slate-200 bg-white py-4 xl:flex">
          <button
            type="button"
            onClick={() => setRightCollapsed(false)}
            aria-label="AI도구 패널 펼치기"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
          >
            <IconSparkles size={18} />
          </button>
        </aside>
      ) : (
        <aside className="hidden w-64 shrink-0 flex-col border-l border-slate-200 bg-white xl:flex">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              AI도구
              <span className="text-[10px] font-semibold text-amber-600">준비중</span>
            </h2>
            <button
              type="button"
              onClick={() => setRightCollapsed(true)}
              aria-label="AI도구 패널 접기"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <IconChevronRight size={18} />
            </button>
          </div>
          <div className="flex-1 px-4 py-5">
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
      )}

      <ConnectorModal open={connectorOpen} onClose={() => setConnectorOpen(false)} />
      <SkillModal open={skillOpen} onClose={() => setSkillOpen(false)} />
    </div>
  );
}
