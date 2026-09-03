"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  IconArrowUp,
  IconCheck,
  IconPlus,
  IconSparkles,
} from "@/components/icons";
import { BrandIcon } from "@/components/brand-icons";
import { CONNECTOR_LIB, SKILL_LIB } from "@/data/chat";

/** 겹친 스택에 얼굴을 내미는 앱 수 — 나머지는 +n으로 접는다 */
const STACK_MAX = 3;

/** 입력창 자동 높이 조절 */
function useAutoResizeTextarea(minHeight: number, maxHeight: number) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const adjust = useCallback(
    (reset?: boolean) => {
      const el = ref.current;
      if (!el) return;
      el.style.height = `${minHeight}px`;
      if (!reset)
        el.style.height = `${Math.max(minHeight, Math.min(el.scrollHeight, maxHeight))}px`;
    },
    [minHeight, maxHeight],
  );
  return { ref, adjust };
}

/**
 * 대화 입력바. 빈 화면(수직 중앙)과 대화 중(하단 고정) 두 자리에서 같은 것을 쓴다.
 *
 * 왼쪽 `+`는 소스 추가(파일 선택)이고, 그 옆 겹친 앱 스택은 커넥터·스킬 드롭다운을 연다.
 */
export function ChatComposer({
  value,
  onChange,
  onSend,
  thinking,
  onAddSource,
  onOpenConnectors,
  onOpenSkills,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  thinking: boolean;
  onAddSource: () => void;
  onOpenConnectors: () => void;
  onOpenSkills: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // border-box 기준 — pt-3.5(14px) + 한 줄(20px) = 최소 38px
  const { ref: inputRef, adjust } = useAutoResizeTextarea(38, 160);

  // 값이 밖에서 비워지면(전송 후) 높이도 같이 되돌린다
  useEffect(() => {
    adjust(value === "");
  }, [value, adjust]);

  useEffect(() => {
    if (!menu) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenu(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const connected = CONNECTOR_LIB.filter((c) => c.connected);
  const shown = connected.slice(0, STACK_MAX);
  const rest = connected.length - shown.length;
  const canSend = value.trim().length > 0 && !thinking;

  return (
    <div className="relative" ref={menuRef}>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors focus-within:border-slate-400">
        <label htmlFor="chat-input" className="sr-only">
          질문 입력
        </label>
        <textarea
          id="chat-input"
          ref={inputRef}
          rows={1}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            adjust();
          }}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="무엇을 시작할까요?"
          className="thin-scroll block w-full resize-none border-none bg-transparent px-4 pt-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
        <div className="flex items-center justify-between px-2.5 pb-2.5 pt-2">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onAddSource}
              aria-label="소스 추가"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <IconPlus size={17} />
            </button>
            {connected.length > 0 && (
              <>
                <span className="mx-1 h-4 w-px bg-slate-200" aria-hidden />
                <button
                  type="button"
                  onClick={() => setMenu((v) => !v)}
                  aria-label={`연결된 앱 ${connected.length}개 — 커넥터·스킬 열기`}
                  aria-expanded={menu}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg py-1 pl-1.5 pr-2 transition-colors hover:bg-slate-100"
                >
                  {/* 첫 앱이 맨 위로 겹치게 — 뒤로 갈수록 z-index를 낮춘다 */}
                  <span className="isolate flex">
                    {shown.map((c, i) => (
                      <span
                        key={c.slug}
                        style={{ zIndex: shown.length - i }}
                        title={c.name}
                        className={`flex h-6 w-6 items-center justify-center rounded-full bg-white ring-1 ring-slate-200 ${
                          i ? "-ml-2" : ""
                        }`}
                      >
                        <BrandIcon slug={c.slug} size={14} />
                      </span>
                    ))}
                  </span>
                  {rest > 0 && (
                    <span className="text-[13px] font-semibold text-slate-500">
                      +{rest}
                    </span>
                  )}
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onSend}
            aria-label="전송"
            disabled={!canSend}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-200 ${
              canSend
                ? "cursor-pointer bg-primary-600 text-white hover:bg-primary-700"
                : "cursor-not-allowed bg-slate-100 text-slate-300"
            }`}
          >
            <IconArrowUp size={16} />
          </button>
        </div>
      </div>

      {menu && (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-[300px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
          <p className="px-3 py-1.5 text-[13px] font-semibold text-slate-400">
            연결된 앱
          </p>
          {CONNECTOR_LIB.slice(0, 4).map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => {
                setMenu(false);
                onOpenConnectors();
              }}
              className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-slate-50"
            >
              <BrandIcon slug={c.slug} size={18} />
              <span className="flex-1 truncate text-[15px] text-slate-700">
                {c.name}
              </span>
              {c.connected ? (
                <IconCheck size={14} className="shrink-0 text-slate-400" />
              ) : (
                <span className="shrink-0 text-[13px] font-semibold text-slate-500">
                  연결
                </span>
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setMenu(false);
              onOpenConnectors();
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-[15px] text-slate-500 transition-colors hover:bg-slate-50"
          >
            <span className="flex h-[18px] w-[18px] items-center justify-center text-slate-400">
              <IconPlus size={14} />
            </span>
            앱 더 보기
          </button>

          <div className="my-1.5 h-px bg-slate-100" />
          <p className="px-3 py-1.5 text-[13px] font-semibold text-slate-400">
            스킬
          </p>
          {SKILL_LIB.slice(0, 2).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setMenu(false);
                onOpenSkills();
              }}
              className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-slate-50"
            >
              <IconSparkles size={18} className="shrink-0 text-slate-400" />
              <span className="flex-1 truncate text-[15px] text-slate-700">
                {s.name}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setMenu(false);
              onOpenSkills();
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-[15px] text-slate-500 transition-colors hover:bg-slate-50"
          >
            <span className="flex h-[18px] w-[18px] items-center justify-center text-slate-400">
              <IconPlus size={14} />
            </span>
            스킬 더 보기
          </button>
        </div>
      )}
    </div>
  );
}
