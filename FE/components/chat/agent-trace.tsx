"use client";

import { useEffect, useState } from "react";
import { BrandIcon } from "@/components/brand-icons";
import {
  IconChevronDown,
  IconCpu,
  IconDatabase,
  IconExternalLink,
  IconFile,
  IconSearch,
} from "@/components/icons";
import type { TraceStep } from "@/data/chat";

const TRACE_ICONS = {
  search: IconSearch,
  data: IconDatabase,
  doc: IconFile,
  app: IconExternalLink,
  model: IconCpu,
} as const;

/** 단계가 부른 외부 앱의 slug — `brand`가 우선이고, 없으면 아이콘 종류로 유추한다 */
function brandOf(step: TraceStep) {
  if (step.brand) return step.brand;
  if (step.icon === "calendar") return "googlecalendar";
  if (step.icon === "mail") return "gmail";
  return undefined;
}

/**
 * 트레이스 아이콘 — 외부 앱을 부른 단계는 그 앱의 공식 심볼 마크를 그린다.
 * 사내 모듈 조회·RAG 검색·모델 추론은 브랜드가 없으므로 일반 아이콘을 쓴다.
 */
export function TraceIcon({ step }: { step: TraceStep }) {
  const brand = brandOf(step);
  if (brand) return <BrandIcon slug={brand} size={14} />;
  const Icon =
    step.icon && step.icon in TRACE_ICONS
      ? TRACE_ICONS[step.icon as keyof typeof TRACE_ICONS]
      : IconSearch;
  return <Icon size={14} className="text-slate-400" />;
}

/** AI 작업 중 3×3 픽셀 도트 (`.pixel-dots`) */
export function PixelDots() {
  return (
    <span
      className="pixel-dots grid h-3.5 w-3.5 shrink-0 grid-cols-3 gap-[2px]"
      aria-hidden
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          style={{ "--i": i } as React.CSSProperties}
          className="rounded-[1px] bg-slate-700"
        />
      ))}
    </span>
  );
}

/** 높이 0fr→1fr 접힘/펼침 — 300ms(모션 사다리 상한) */
function Collapse({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      inert={!open}
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
        open
          ? "grid-rows-[1fr] opacity-100"
          : "pointer-events-none grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

/** 새 답변 1회 타자 효과 — 18ms마다 2글자. 복원된 메시지엔 쓰지 않는다 */
export function StreamingText({
  text,
  onDone,
}: {
  text: string;
  onDone?: () => void;
}) {
  const [n, setN] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? text.length
      : 0,
  );
  useEffect(() => {
    if (n >= text.length) {
      onDone?.();
      return;
    }
    const t = setTimeout(() => setN((v) => Math.min(text.length, v + 2)), 18);
    return () => clearTimeout(t);
  }, [n, text, onDone]);
  return <>{text.slice(0, n)}</>;
}

function sec(ms?: number) {
  return ms === undefined ? undefined : Math.max(1, Math.round(ms / 1000));
}

/**
 * AI 추론 트레이스 — 답변 위에 말풍선 없이 붙는다 (레퍼런스: ai-agent-response).
 *
 * 작업 중: 픽셀 도트 + 현재 추론 문구(shimmer) 헤더, 행이 하나씩 드러나며 자동으로 펼쳐진다.
 * 완료: "{n}개 도구 사용 · {n}s" 헤더로 바뀌고 접힌다. 클릭하면 다시 펼쳐지고,
 * 입력·출력이 있는 행은 한 번 더 펼쳐 도구 호출 내용을 볼 수 있다.
 */
export function AgentTrace({
  rows,
  working = false,
  label,
  thoughts,
  durationMs,
}: {
  rows: TraceStep[];
  working?: boolean;
  /** 작업 중 헤더에 흐르는 현재 추론 문구 */
  label?: string;
  /** 완료 후 "{n}초 생각함" 행에 펼쳐지는 추론 문구 */
  thoughts?: string[];
  durationMs?: number;
}) {
  const [manual, setManual] = useState<boolean | null>(null);
  const [openRow, setOpenRow] = useState<number | null>(null);
  const expanded = manual ?? working;
  const s = sec(durationMs);
  // 접힘 헤더에 겹쳐 보여줄 앱 마크 — 중복을 걷고 앞의 네 개만
  const brands = [
    ...new Set(rows.map(brandOf).filter((b) => b !== undefined)),
  ].slice(0, 4);

  return (
    <div className="mb-2 select-none text-[13px]">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setManual(!expanded)}
        className="group flex cursor-pointer items-center gap-2 rounded-md py-0.5 text-left text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
      >
        {working ? (
          <>
            <PixelDots />
            <span className="shimmer-text font-medium">
              {label ?? "작업 중"}…
            </span>
          </>
        ) : (
          <>
            {/* 접혀 있어도 어떤 앱을 거쳤는지 보이게 사용한 앱 마크를 겹쳐 놓는다 (레퍼런스: Used 4 tools) */}
            {brands.length > 0 && (
              <span className="flex -space-x-1.5" aria-hidden>
                {brands.map((b) => (
                  <span
                    key={b}
                    className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white ring-1 ring-white"
                  >
                    <BrandIcon slug={b} size={13} />
                  </span>
                ))}
              </span>
            )}
            <span>
              {rows.length}개 도구 사용
              {s !== undefined && <span className="tabular-nums"> · {s}s</span>}
            </span>
          </>
        )}
        <IconChevronDown
          size={13}
          className={`shrink-0 text-slate-400 opacity-40 transition-transform duration-200 group-hover:opacity-100 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      <Collapse open={expanded}>
        <ol className="mt-1.5 ml-1.5 border-l border-slate-200 pl-3">
          {!working && thoughts && thoughts.length > 0 && (
            <li>
              <button
                type="button"
                aria-expanded={openRow === -1}
                onClick={() => setOpenRow(openRow === -1 ? null : -1)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-md py-1 text-left text-slate-600 transition-colors hover:text-slate-900"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  <IconCpu size={14} className="text-slate-400" />
                </span>
                <span className="font-medium">
                  {s !== undefined ? `${s}초 생각함` : "생각 과정"}
                </span>
                <IconChevronDown
                  size={12}
                  className={`text-slate-300 transition-transform duration-200 ${openRow === -1 ? "rotate-180" : ""}`}
                />
              </button>
              <Collapse open={openRow === -1}>
                <ul className="mb-1.5 ml-6 space-y-1 text-slate-500">
                  {thoughts.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </Collapse>
            </li>
          )}
          {rows.map((t, i) => {
            const detail = t.input || t.output;
            const on = openRow === i;
            return (
              <li key={`${i}-${t.text}`} className="agent-fade">
                <button
                  type="button"
                  disabled={!detail}
                  aria-expanded={detail ? on : undefined}
                  onClick={() => detail && setOpenRow(on ? null : i)}
                  className={`flex w-full items-center gap-2 rounded-md py-1 text-left text-slate-600 transition-colors ${
                    detail
                      ? "cursor-pointer hover:text-slate-900"
                      : "cursor-default"
                  }`}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    <TraceIcon step={t} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{t.text}</span>
                  {t.result && (
                    <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                      {t.result}
                    </span>
                  )}
                  {detail && (
                    <IconChevronDown
                      size={12}
                      className={`shrink-0 text-slate-300 transition-transform duration-200 ${on ? "rotate-180" : ""}`}
                    />
                  )}
                </button>
                {detail && (
                  <Collapse open={on}>
                    <dl className="mb-2 ml-6 space-y-1.5 text-[12px]">
                      {t.input && (
                        <div>
                          <dt className="text-[10px] font-semibold text-slate-400">
                            입력
                          </dt>
                          <dd className="mt-0.5 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[11.5px] text-slate-600">
                            {t.input}
                          </dd>
                        </div>
                      )}
                      {t.output && (
                        <div>
                          <dt className="text-[10px] font-semibold text-slate-400">
                            출력
                          </dt>
                          <dd className="mt-0.5 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[11.5px] text-slate-600">
                            {t.output}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </Collapse>
                )}
              </li>
            );
          })}
        </ol>
      </Collapse>
    </div>
  );
}
