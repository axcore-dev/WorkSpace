"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { IconX } from "@/components/icons";

/**
 * 다중 선택 — Notion 의 다중 선택 속성을 따른다.
 *
 * 칸을 누르면 칩 뒤에 캐럿이 서고 바로 타이핑 → 아래 목록이 걸러진다 → Enter/클릭으로 칩 추가. 없는 이름은 맨 아래
 * 「만들기 [입력값]」(onCreate 가 있을 때). 칩은 × 로 빼고 드래그(키보드는 Alt+←/→)로 순서를 바꾼다.
 * **첫 칩이 기본**(`firstTag`) — 순서가 뜻이라 따로 토글이 없다. 못 고르는 항목(거래 중지)은 옅게 보이되 선택되지 않는다.
 * 색 알약은 쓰지 않는다 — 무채색 칩(`ring-slate-200`). 팝오버만 떠 있는 표면이라 `shadow-lg`.
 *
 * 접근성: 입력이 `role="combobox"` + `aria-expanded` + `aria-activedescendant`, 목록은 `listbox/option`.
 *
 * 목록은 `document.body` 포털에 `position: fixed` 로 띄운다 — 칸 아래 `absolute` 로 두면 모달 본문(`overflow-y-auto`)이나
 * 편집기 표 래퍼(`overflow-x-auto`)가 잘라서 발주처 목록이 1% 만 보였다. 아래 공간이 240px 이 안 되고 위가 더 넓으면 위로 편다.
 * ESC 는 목록이 열려 있을 때만 여기서 멈춘다 — 닫혀 있으면 모달로 올라가 모달이 닫힌다.
 */
export interface PickerOption {
  id: string;
  label: string;
  /** 오른쪽 내림 메타 — 구분 · 리드타임 */
  meta?: string;
  disabled?: boolean;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/** 목록이 필요로 하는 세로 공간(최대 높이 240 + 여백). 이보다 적으면 위로 편다 */
const LIST_SPACE = 256;

/**
 * 열려 있는 동안 기준 요소의 화면 좌표를 따라간다 — 스크롤(모달 본문 포함, capture) · 리사이즈마다 다시 잰다.
 * 측정은 rAF 안에서 해서 한 프레임에 한 번만 상태를 바꾼다. 닫히면 null.
 */
function useAnchorRect(open: boolean, ref: RefObject<HTMLElement | null>) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setRect(ref.current?.getBoundingClientRect() ?? null));
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, ref]);
  return open ? rect : null;
}

/** 기준 칸 바로 아래(공간이 없으면 위)에 같은 폭으로 — fixed 좌표. 최대 높이 240 = 항목 7개가 스크롤 없이 들어가는 값 */
function listStyle(rect: DOMRect): CSSProperties {
  const below = window.innerHeight - rect.bottom;
  const flip = below < LIST_SPACE && rect.top > below;
  const room = (flip ? rect.top : below) - 8;
  return {
    position: "fixed",
    left: rect.left,
    width: rect.width,
    maxHeight: Math.max(96, Math.min(240, room)),
    ...(flip ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
  };
}

export const CHIP = "inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-xs text-slate-700 ring-1 ring-inset ring-slate-200";

/** 칩 순서 바꾸기 — 마우스는 드래그, 키보드는 Alt+←/→. `MultiPicker` 와 문서 규칙의 `ChipEditor` 가 같이 쓴다 */
export function useChipReorder(order: string[], onChange: (next: string[]) => void) {
  const [dragging, setDragging] = useState<number | null>(null);

  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= order.length) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  return {
    dragging,
    move,
    dragProps: (i: number) => ({
      draggable: true,
      onDragStart: (e: DragEvent) => {
        setDragging(i);
        e.dataTransfer.effectAllowed = "move";
      },
      onDragOver: (e: DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        if (dragging !== null) move(dragging, i);
        setDragging(null);
      },
      onDragEnd: () => setDragging(null),
    }),
    /** Alt+←/→ 면 순서를 바꾸고 true */
    keyReorder: (i: number, e: KeyboardEvent) => {
      if (!e.altKey) return false;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        move(i, i - 1);
        return true;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        move(i, i + 1);
        return true;
      }
      return false;
    },
  };
}

export function Chip({
  label,
  tag,
  dragging = false,
  dragProps,
  onKeyDown,
  onRemove,
  removeLabel,
  onClick,
}: {
  label: ReactNode;
  /** 라벨 뒤 작은 표기 — 「기본」 */
  tag?: string;
  dragging?: boolean;
  dragProps?: ReturnType<ReturnType<typeof useChipReorder>["dragProps"]>;
  onKeyDown?: (e: KeyboardEvent<HTMLSpanElement>) => void;
  onRemove?: () => void;
  removeLabel?: string;
  onClick?: () => void;
}) {
  return (
    <span
      tabIndex={0}
      {...dragProps}
      onKeyDown={onKeyDown}
      onClick={onClick}
      // 새 칩은 fade-in 으로 나타난다(마운트에만 — 순서를 바꿔도 key 가 같아 다시 돌지 않는다). 빼기는 즉시
      className={`${CHIP} fade-in ${dragProps ? "cursor-grab active:cursor-grabbing" : ""} ${onClick ? "cursor-pointer hover:bg-slate-50" : ""} ${dragging ? "opacity-50" : ""} focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-400`}
    >
      {label}
      {tag && <span className="text-[10px] text-slate-500">{tag}</span>}
      {onRemove && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={removeLabel ?? "빼기"}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="-mr-0.5 cursor-pointer rounded p-px text-slate-500 transition-colors duration-150 hover:text-slate-900"
        >
          <IconX size={12} />
        </button>
      )}
    </span>
  );
}

export function MultiPicker({
  id,
  label,
  options,
  value,
  onChange,
  onCreate,
  placeholder = "",
  invalid = false,
  firstTag = "기본",
  single = false,
}: {
  id?: string;
  label: string;
  options: PickerOption[];
  /** 고른 id 순서 — `[0]` 이 기본 */
  value: string[];
  onChange: (ids: string[]) => void;
  /** 없는 이름을 「만들기」 — 없으면 만들기 항목이 안 뜬다 */
  onCreate?: (name: string) => void;
  placeholder?: string;
  invalid?: boolean;
  /** 첫 칩 뒤 표기. null 이면 없음 */
  firstTag?: string | null;
  /** 하나만 — 고르면 바꿔 끼운다(발주처 고르기). 첫 칩 표기 없음 */
  single?: boolean;
}) {
  const autoId = useId();
  const baseId = id ?? autoId;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const anchor = useAnchorRect(open, rootRef);
  const reorder = useChipReorder(value, onChange);

  const selected = value.map((v) => options.find((o) => o.id === v) ?? { id: v, label: v });
  const filtered = options.filter((o) => !value.includes(o.id) && (!query.trim() || norm(o.label).includes(norm(query))));
  const exact = options.some((o) => norm(o.label) === norm(query));
  const canCreate = !!onCreate && query.trim() !== "" && !exact;
  const count = filtered.length + (canCreate ? 1 : 0);
  const activeIdx = Math.min(active, Math.max(0, count - 1));

  function focusInput() {
    inputRef.current?.focus();
  }
  function add(optionId: string) {
    onChange(single ? [optionId] : [...value, optionId]);
    setQuery("");
    setActive(0);
    if (single) setOpen(false);
    else focusInput();
  }
  function create() {
    onCreate?.(query.trim());
    setQuery("");
    setActive(0);
    focusInput();
  }
  function pick(i: number) {
    if (i < filtered.length) {
      if (!filtered[i].disabled) add(filtered[i].id);
    } else if (canCreate) create();
  }
  function remove(optionId: string) {
    onChange(value.filter((v) => v !== optionId));
    focusInput();
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, Math.max(0, count - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      if (open && count > 0) {
        e.preventDefault();
        pick(activeIdx);
      }
    } else if (e.key === "Escape") {
      // 목록만 닫는다. 닫혀 있을 때의 ESC 는 모달 몫이라 그대로 올려 보낸다
      if (open) {
        e.stopPropagation();
        setOpen(false);
      }
    } else if (e.key === "Backspace" && query === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <div
        onMouseDown={(e) => {
          // 칸의 빈 자리를 눌러도 캐럿이 서게 — 칩 · 입력 자체를 누른 건 그대로 둔다
          if (e.target === e.currentTarget) {
            e.preventDefault();
            focusInput();
            setOpen(true);
          }
        }}
        className={`flex min-h-[42px] w-full cursor-text flex-wrap items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 transition-colors focus-within:outline-2 ${
          invalid
            ? "border-red-300 focus-within:border-red-400 focus-within:outline-red-200/60"
            : "border-slate-300 focus-within:border-slate-400 focus-within:outline-slate-300/60"
        }`}
      >
        {selected.map((o, i) => (
          <Chip
            key={o.id}
            label={o.label}
            tag={i === 0 && firstTag && !single ? firstTag : undefined}
            dragging={reorder.dragging === i}
            dragProps={reorder.dragProps(i)}
            onKeyDown={(e) => {
              if (reorder.keyReorder(i, e)) return;
              if (e.key === "Backspace" || e.key === "Delete") {
                e.preventDefault();
                remove(o.id);
              }
            }}
            onRemove={() => remove(o.id)}
            removeLabel={`${o.label} 빼기`}
          />
        ))}
        <input
          ref={inputRef}
          id={baseId}
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={`${baseId}-list`}
          aria-activedescendant={open && count > 0 ? `${baseId}-opt-${activeIdx}` : undefined}
          aria-autocomplete="list"
          aria-invalid={invalid || undefined}
          value={query}
          placeholder={value.length === 0 ? placeholder : ""}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          // 이미 포커스가 있는 칸을 다시 눌러도 목록이 열려야 한다 — ESC 로 닫은 뒤 다시 고르는 흐름
          onClick={() => setOpen(true)}
          onKeyDown={onKey}
          className="min-w-[8ch] flex-1 bg-transparent py-0.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
      </div>

      {open &&
        anchor &&
        createPortal(
          <ul
            id={`${baseId}-list`}
            role="listbox"
            aria-label={`${label} 목록`}
            style={listStyle(anchor)}
            // 모달(z-50) 위에 떠야 한다. 등장은 fade-in(150ms)
            className="fade-in thin-scroll z-[60] overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          >
          {filtered.map((o, i) => (
            <li
              key={o.id}
              id={`${baseId}-opt-${i}`}
              role="option"
              aria-selected={i === activeIdx}
              aria-disabled={o.disabled || undefined}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => !o.disabled && add(o.id)}
              className={`flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-sm ${
                o.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              } ${i === activeIdx ? "bg-slate-100" : ""}`}
            >
              <span className={CHIP}>{o.label}</span>
              {o.meta && <span className="text-xs text-slate-500">{o.meta}</span>}
            </li>
          ))}
          {canCreate && (
            <li
              id={`${baseId}-opt-${filtered.length}`}
              role="option"
              aria-selected={activeIdx === filtered.length}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(filtered.length)}
              onClick={create}
              className={`flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-slate-700 ${activeIdx === filtered.length ? "bg-slate-100" : ""}`}
            >
              만들기
              <span className={CHIP}>{query.trim()}</span>
            </li>
          )}
          {count === 0 && <li className="px-2.5 py-1.5 text-sm text-slate-500">고를 수 있는 항목이 없어요</li>}
          </ul>,
          document.body,
        )}
    </div>
  );
}
