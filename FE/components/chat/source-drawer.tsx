"use client";

import { useEffect, useRef } from "react";
import { TraceIcon } from "@/components/chat/agent-trace";
import { IconClock, IconCpu, IconFile, IconX } from "@/components/icons";
import type { ChatMessage, TraceStep } from "@/data/chat";

/**
 * 답변 상세 드로어 — 동작 바의 '출처 n'을 누르면 대화 오른쪽에 뜬다.
 * 맨 위 AI 활동 시간, 생각 과정, 도구 호출(입력·출력), 인용 문서 순서.
 * 바깥 클릭·ESC·×로 닫힌다.
 */
export function SourceDrawer({ msg, onClose }: { msg: ChatMessage; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const trace: TraceStep[] = msg.process?.trace ?? msg.process?.steps.map((text) => ({ text })) ?? [];
  const cited = msg.sources ?? [];
  // 조회는 했지만 본문에 인용하진 않은 소스 — 칩으로만 보여준다
  const consulted = (msg.process?.sources ?? []).filter((d) => !cited.some((s) => s.doc === d));
  const sec = msg.durationMs === undefined ? undefined : Math.max(1, Math.round(msg.durationMs / 1000));

  return (
    <aside
      ref={ref}
      aria-label="답변 상세"
      className="agent-fade absolute inset-y-3 right-3 z-30 flex w-[min(24rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-bold text-slate-900">출처</h2>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          aria-label="출처 닫기"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
        >
          <IconX size={15} />
        </button>
      </div>

      <div className="thin-scroll flex-1 space-y-5 overflow-y-auto px-4 py-4 text-[13px]">
        {sec !== undefined && (
          <p className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 font-medium text-slate-700">
            <IconClock size={14} className="text-slate-400" />
            AI 활동 시간 <span className="tabular-nums">{sec}s</span>
          </p>
        )}

        {msg.reasoning && msg.reasoning.length > 0 && (
          <section aria-label="생각 과정">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <IconCpu size={13} />
              생각 과정
            </h3>
            <ol className="ml-1.5 space-y-1.5 border-l border-slate-200 pl-3 text-slate-600">
              {msg.reasoning.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
          </section>
        )}

        {trace.length > 0 && (
          <section aria-label="도구 호출">
            <h3 className="mb-2 text-xs font-semibold text-slate-400">도구 호출 {trace.length}</h3>
            <ol className="space-y-3">
              {trace.map((t, i) => (
                <li key={`${i}-${t.text}`} className="flex gap-2.5">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                    <TraceIcon icon={t.icon} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-700">{t.text}</p>
                    {t.result && <p className="mt-0.5 text-[11px] tabular-nums text-slate-400">{t.result}</p>}
                    {(t.input || t.output) && (
                      <dl className="mt-1.5 space-y-1.5 text-[12px]">
                        {t.input && (
                          <div>
                            <dt className="text-[10px] font-semibold text-slate-400">입력</dt>
                            <dd className="mt-0.5 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[11.5px] text-slate-600">
                              {t.input}
                            </dd>
                          </div>
                        )}
                        {t.output && (
                          <div>
                            <dt className="text-[10px] font-semibold text-slate-400">출력</dt>
                            <dd className="mt-0.5 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[11.5px] text-slate-600">
                              {t.output}
                            </dd>
                          </div>
                        )}
                      </dl>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {(cited.length > 0 || consulted.length > 0) && (
          <section aria-label="인용 문서">
            <h3 className="mb-2 text-xs font-semibold text-slate-400">인용 문서 {cited.length + consulted.length}</h3>
            <ul className="space-y-1.5">
              {cited.map((s) => (
                <li key={s.doc} className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2">
                  <IconFile size={13} className="mt-0.5 shrink-0 text-slate-400" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-slate-700">{s.doc}</span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                      &ldquo;{s.snippet}&rdquo;
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {consulted.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="조회한 소스">
                {consulted.map((d) => (
                  <li
                    key={d}
                    className="flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500"
                  >
                    <IconFile size={11} />
                    {d}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </aside>
  );
}
