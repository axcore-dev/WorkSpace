"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconCheck,
  IconFile,
  IconFolder,
  IconHistory,
  IconPlus,
  IconUpload,
  IconX,
} from "@/components/icons";
import { Button } from "@/components/ui";
import type { Note, SourceState } from "@/data/chat";

type Panel = "notes" | "sources" | null;

/**
 * 대화 좌측 아이콘 레일 + 오버레이 패널.
 *
 * 패널은 대화 위로 떠서 대화 폭을 밀지 않는다. 닫히는 길은 셋이다 —
 * 같은 아이콘 재클릭·바깥 클릭·ESC. 패널 안 클릭은 닫지 않는다 (소스를 여러 개 켜야 하니까).
 */
export function ChatRail({
  notes,
  activeId,
  src,
  onSelectNote,
  onNewNote,
  onDeleteNote,
  onToggleSource,
  onToggleAll,
  onAddSource,
  onRemoveSource,
  onInheritSources,
  canInherit,
}: {
  notes: Note[];
  activeId: number | null;
  src: SourceState;
  onSelectNote: (id: number) => void;
  onNewNote: () => void;
  onDeleteNote: (id: number) => void;
  onToggleSource: (name: string) => void;
  onToggleAll: () => void;
  onAddSource: () => void;
  onRemoveSource: (name: string) => void;
  onInheritSources: () => void;
  canInherit: boolean;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panel) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setPanel(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPanel(null);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [panel]);

  const { sources, selected } = src;
  const allSelected = sources.length > 0 && selected.length === sources.length;
  const someSelected = selected.length > 0 && !allSelected;

  function railButton(id: Exclude<Panel, null>, Icon: typeof IconHistory, label: string, count: string) {
    const on = panel === id;
    return (
      <button
        type="button"
        onClick={() => setPanel(on ? null : id)}
        aria-label={label}
        aria-expanded={on}
        aria-controls={`chat-rail-${id}`}
        className={`flex w-full cursor-pointer flex-col items-center gap-1 rounded-lg py-2.5 transition-colors ${
          on ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
        }`}
      >
        <Icon size={19} />
        <span className={`text-[10px] font-medium ${on ? "text-slate-500" : "text-slate-400"}`}>{count}</span>
      </button>
    );
  }

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <div className="flex h-full w-14 flex-col gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5">
        {railButton("notes", IconHistory, "대화 기록", String(notes.length))}
        {railButton("sources", IconFolder, "소스", sources.length ? `${selected.length}/${sources.length}` : "0")}
      </div>

      {panel === "notes" && (
        <section
          id="chat-rail-notes"
          aria-label="대화 기록"
          className="absolute left-[68px] top-0 z-20 flex h-full w-72 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-900">
              대화 <span className="ml-1 font-normal text-slate-400">{notes.length}</span>
            </h2>
            <button
              type="button"
              onClick={() => setPanel(null)}
              aria-label="대화 기록 닫기"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <IconX size={15} />
            </button>
          </div>
          <div className="p-3">
            <Button variant="secondary" size="sm" className="w-full" onClick={onNewNote}>
              <IconPlus size={14} />새 대화
            </Button>
          </div>
          <ul className="thin-scroll flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
            {notes.length === 0 && (
              <li className="mx-1 mt-1 rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center text-xs leading-relaxed text-slate-400">
                아직 대화가 없어요.
                <br />
                질문을 보내면 여기에 쌓여요.
              </li>
            )}
            {notes.map((n) => (
              <li key={n.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelectNote(n.id)}
                  className={`flex w-full cursor-pointer flex-col items-start rounded-lg px-2.5 py-2 pr-8 text-left transition-colors ${
                    n.id === activeId ? "bg-slate-100" : "hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`block w-full truncate text-xs font-medium ${
                      n.id === activeId ? "text-slate-900" : "text-slate-700"
                    }`}
                  >
                    {n.title}
                  </span>
                  <span className="mt-0.5 text-[10px] text-slate-400">메시지 {n.messages.length}개</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteNote(n.id)}
                  aria-label={`${n.title} 대화 삭제`}
                  title="대화 삭제"
                  className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-slate-400 opacity-0 transition-[opacity,color,background-color] hover:bg-slate-200/70 hover:text-slate-600 focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <IconX size={13} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {panel === "sources" && (
        <section
          id="chat-rail-sources"
          aria-label="소스"
          className="absolute left-[68px] top-0 z-20 flex h-full w-72 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-900">
              소스{" "}
              <span className="ml-1 font-normal text-slate-400">
                {selected.length}/{sources.length}
              </span>
            </h2>
            <button
              type="button"
              onClick={() => setPanel(null)}
              aria-label="소스 닫기"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <IconX size={15} />
            </button>
          </div>
          <div className="space-y-2.5 border-b border-slate-100 p-3">
            <Button variant="secondary" size="sm" className="w-full" onClick={onAddSource}>
              <IconUpload size={14} />
              소스 추가
            </Button>
            {sources.length > 0 && (
              <label className="flex cursor-pointer items-center gap-2 px-1 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={onToggleAll}
                  className="h-3.5 w-3.5 cursor-pointer accent-slate-800"
                  aria-label="소스 전체 선택/해제"
                />
                전체 선택
                <span className="ml-auto text-slate-400">
                  {selected.length}/{sources.length}
                </span>
              </label>
            )}
          </div>
          <ul className="thin-scroll flex-1 space-y-0.5 overflow-y-auto p-2">
            {sources.length === 0 && (
              <li className="mx-1 mt-1 rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs leading-relaxed text-slate-400">
                새 대화라 소스가 비어 있어요.
                <br />
                문서를 추가하면 AI가 분석해
                <br />
                답변 근거로 사용해요.
                {canInherit && (
                  <button
                    type="button"
                    onClick={onInheritSources}
                    className="mt-3 block w-full cursor-pointer rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    직전 대화 소스 가져오기
                  </button>
                )}
              </li>
            )}
            {sources.map((doc) => {
              const on = selected.includes(doc.name);
              return (
                <li key={doc.name} className="group relative">
                  <button
                    type="button"
                    onClick={() => onToggleSource(doc.name)}
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
                  <button
                    type="button"
                    onClick={() => onRemoveSource(doc.name)}
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
            PDF·이미지·XLSX·DOCX를 올릴 수 있어요. 공개 범위와 역할 권한에 따라 접근이 제어돼요.
          </p>
        </section>
      )}
    </div>
  );
}
