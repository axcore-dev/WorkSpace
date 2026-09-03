"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  IconArrowUp,
  IconCheck,
  IconChevronRight,
  IconFile,
  IconPlus,
  IconSparkles,
} from "@/components/icons";
import { BrandIcon } from "@/components/brand-icons";
import { CONNECTOR_LIB } from "@/data/chat";

/** 겹친 스택에 얼굴을 내미는 앱 수 — 나머지는 +n으로 접는다 */
const STACK_MAX = 3;

/** 드롭다운 항목 — 두 메뉴가 같은 모양을 쓴다 */
const MENU_ITEM =
  "flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-[15px] text-slate-700 transition-colors hover:bg-slate-50";

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
 * 왼쪽 `+`는 추가 메뉴(로컬 파일·스킬 사용)를 열고, 그 옆 겹친 앱 스택은 연결된 앱 메뉴를 연다.
 * 두 메뉴는 하나의 상태를 나눠 써서 **동시에 열리지 않는다**. 메뉴가 열리는 방향은 입력바 자리를 따라간다 —
 * 첫 화면(가운데)에서는 아래로, 대화 중(바닥)에서는 위로.
 */
export function ChatComposer({
  value,
  onChange,
  onSend,
  thinking,
  onAddSource,
  onOpenConnectors,
  onOpenSkills,
  menuBelow = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  thinking: boolean;
  onAddSource: () => void;
  onOpenConnectors: () => void;
  onOpenSkills: () => void;
  /** 입력바가 화면 가운데에 있을 때 true — 메뉴를 아래로 연다 */
  menuBelow?: boolean;
}) {
  const [menu, setMenu] = useState<"plus" | "apps" | null>(null);
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
        setMenu(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(null);
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
              onClick={() => setMenu((m) => (m === "plus" ? null : "plus"))}
              aria-label="추가"
              aria-haspopup="menu"
              aria-expanded={menu === "plus"}
              className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-slate-100 hover:text-slate-600 ${
                menu === "plus"
                  ? "bg-slate-100 text-slate-700"
                  : "text-slate-400"
              }`}
            >
              <IconPlus size={17} />
            </button>
            {connected.length > 0 && (
              <>
                <span className="mx-1 h-4 w-px bg-slate-200" aria-hidden />
                <button
                  type="button"
                  onClick={() => setMenu((m) => (m === "apps" ? null : "apps"))}
                  aria-label={`연결된 앱 ${connected.length}개`}
                  aria-haspopup="menu"
                  aria-expanded={menu === "apps"}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg py-1 pl-1.5 pr-2 transition-colors hover:bg-slate-100 ${
                    menu === "apps" ? "bg-slate-100" : ""
                  }`}
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
        // 메뉴 방향은 입력바 자리를 따라간다 — 첫 화면은 아래로, 대화 중은 위로
        <div
          role="menu"
          className={`thin-scroll absolute left-0 z-30 max-h-[min(22rem,50vh)] w-[300px] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg ${
            menuBelow ? "top-full mt-2" : "bottom-full mb-2"
          }`}
        >
          {menu === "plus" ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  onAddSource();
                }}
                className={MENU_ITEM}
              >
                <IconFile size={17} className="shrink-0 text-slate-400" />
                로컬 파일에서 추가
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  onOpenSkills();
                }}
                className={MENU_ITEM}
              >
                <IconSparkles size={17} className="shrink-0 text-slate-400" />
                스킬 사용
                <IconChevronRight
                  size={14}
                  className="ml-auto shrink-0 text-slate-300"
                />
              </button>
            </>
          ) : (
            <>
              <p className="px-3 py-1.5 text-[13px] font-semibold text-slate-400">
                연결된 앱
              </p>
              {CONNECTOR_LIB.slice(0, 6).map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(null);
                    onOpenConnectors();
                  }}
                  className={MENU_ITEM}
                >
                  <BrandIcon slug={c.slug} size={18} />
                  <span className="flex-1 truncate">{c.name}</span>
                  {c.connected ? (
                    <IconCheck size={14} className="shrink-0 text-slate-400" />
                  ) : (
                    <span className="shrink-0 text-[13px] font-semibold text-slate-500">
                      연결하기
                    </span>
                  )}
                </button>
              ))}
              <div className="my-1.5 h-px bg-slate-100" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  onOpenConnectors();
                }}
                className={`${MENU_ITEM} text-slate-500`}
              >
                <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center text-slate-400">
                  <IconPlus size={14} />
                </span>
                커넥터 추가
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
