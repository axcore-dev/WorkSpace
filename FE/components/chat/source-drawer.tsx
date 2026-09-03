"use client";

import { useEffect, useState } from "react";
import { TraceIcon } from "@/components/chat/agent-trace";
import { IconFile, IconSparkles, IconX } from "@/components/icons";
import type { ChatMessage, TraceStep } from "@/data/chat";

/**
 * 답변 상세 패널 — 동작 바의 '출처 n'을 누르면 대화 오른쪽에 docked로 붙어 대화 폭을 민다(lg 미만에서는 대화 위로 뜬다).
 *
 * 바깥 상자의 폭이 0↔24rem으로 300ms 미끄러지고, **안쪽 패널은 오른쪽 끝에 붙어 있다** — 상자가 넓어지는 만큼
 * 패널이 왼쪽으로 들어오므로 오른쪽에서 밀고 들어오는 움직임이 된다(왼쪽에 붙이면 제자리에서 가려진 부분만
 * 드러나는 커튼처럼 보인다). 마운트 첫 프레임은 폭 0으로 그려 열리는 전환이 걸리게 하고, `open`이 false로 바뀌면
 * 닫히는 전환을 재생해 끝나는 순간 `onClosed`로 알려 부모가 내려놓는다.
 *
 * 포커스를 빼앗지 않는다 — 모달이 아니고, 폭 0인 상자 안의 버튼에 포커스를 주면 브라우저가 스크롤을 튕겨
 * 열리는 첫 프레임이 흔들린다. 닫기는 같은 '출처' 재클릭·ESC·×.
 *
 * 순서는 활동 시간(헤더) → 소스 → 생각 과정 → 도구 호출.
 */
export function SourceDrawer({
  msg,
  open,
  onClose,
  onClosed,
}: {
  msg: ChatMessage;
  open: boolean;
  onClose: () => void;
  onClosed: () => void;
}) {
  // 마운트 직후 한 프레임 뒤에 펼쳐서 열리는 슬라이드가 걸리게 한다
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const trace: TraceStep[] =
    msg.process?.trace ?? msg.process?.steps.map((text) => ({ text })) ?? [];
  const cited = msg.sources ?? [];
  // 조회는 했지만 본문에 인용하진 않은 소스 — 같은 목록에 스니펫 없이 이어 붙인다
  const consulted = (msg.process?.sources ?? []).filter(
    (d) => !cited.some((s) => s.doc === d),
  );
  const srcN = cited.length + consulted.length;
  const sec =
    msg.durationMs === undefined
      ? undefined
      : Math.max(1, Math.round(msg.durationMs / 1000));

  return (
    // 바깥 상자가 폭을 움직이고 안쪽 패널은 오른쪽 끝에 고정 폭으로 붙는다 — 전환 중에 본문이 다시 흐르지 않게
    <div
      inert={!open}
      onTransitionEnd={(e) => {
        if (!open && e.target === e.currentTarget) onClosed();
      }}
      className={`relative h-full shrink-0 overflow-hidden transition-[width,margin-left] duration-300 ease-out max-lg:absolute max-lg:inset-y-3 max-lg:right-3 max-lg:z-30 max-lg:rounded-2xl ${
        open && shown ? "w-96 max-lg:shadow-lg" : "-ml-3 w-0"
      }`}
    >
      <aside
        aria-label="답변 상세"
        className="absolute inset-y-0 right-0 flex w-96 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="flex items-baseline gap-1.5 text-[15px] font-bold text-slate-900">
            활동
            {sec !== undefined && (
              <span className="text-[13px] font-medium tabular-nums text-slate-400">
                · {sec}s
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="출처 닫기"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            <IconX size={15} />
          </button>
        </div>

        <div className="thin-scroll flex-1 space-y-5 overflow-y-auto px-4 py-4 text-[15px]">
          {srcN > 0 && (
            <section aria-label="소스">
              <h3 className="mb-1.5 text-[13px] font-semibold text-slate-400">
                소스 <span className="tabular-nums">· {srcN}</span>
              </h3>
              <ul className="-mx-2">
                {cited.map((s) => (
                  <li key={s.doc}>
                    <div className="flex gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50">
                      <IconFile
                        size={15}
                        strokeWidth={1.75}
                        className="mt-0.5 shrink-0 text-slate-400"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">
                          {s.doc}
                        </p>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">
                          &ldquo;{s.snippet}&rdquo;
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
                {consulted.map((d) => (
                  <li key={d}>
                    <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50">
                      <IconFile
                        size={15}
                        strokeWidth={1.75}
                        className="shrink-0 text-slate-400"
                      />
                      <p className="min-w-0 flex-1 truncate text-slate-700">
                        {d}
                      </p>
                      <span className="shrink-0 text-[13px] text-slate-400">
                        조회
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {msg.reasoning && msg.reasoning.length > 0 && (
            <section aria-label="생각 과정">
              <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-slate-400">
                <IconSparkles size={15} strokeWidth={1.75} />
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
              <h3 className="mb-2 text-[13px] font-semibold text-slate-400">
                도구 호출 <span className="tabular-nums">· {trace.length}</span>
              </h3>
              <ol className="space-y-3">
                {trace.map((t, i) => (
                  <li key={`${i}-${t.text}`} className="flex gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                      <TraceIcon step={t} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-700">{t.text}</p>
                      {t.result && (
                        <p className="mt-0.5 text-[13px] tabular-nums text-slate-400">
                          {t.result}
                        </p>
                      )}
                      {(t.input || t.output) && (
                        <dl className="mt-1.5 space-y-1.5 text-[13px]">
                          {t.input && (
                            <div>
                              <dt className="text-[13px] font-semibold text-slate-400">
                                입력
                              </dt>
                              <dd className="mt-0.5 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[13px] text-slate-600">
                                {t.input}
                              </dd>
                            </div>
                          )}
                          {t.output && (
                            <div>
                              <dt className="text-[13px] font-semibold text-slate-400">
                                출력
                              </dt>
                              <dd className="mt-0.5 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[13px] text-slate-600">
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
        </div>
      </aside>
    </div>
  );
}
