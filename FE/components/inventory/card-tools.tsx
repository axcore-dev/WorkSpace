"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconDownload, IconSearch, IconX } from "@/components/icons";
import { FIELD_SM, Segmented } from "@/components/ui";
import { useInventory, type Density } from "./inventory-provider";

/**
 * 카드 헤더의 도구 자리 — 탭 줄 오른쪽에는 버튼을 두지 않는다(스펙 「공통 골격」).
 *
 * 검색은 아이콘 하나. 누르면 오른쪽으로 입력창이 200ms(모션 사다리 base) 폭·투명도로 펼쳐지고 포커스가
 * 옮겨 간다. ESC 는 항상 접기(검색어도 지운다). × 는 검색어가 있으면 지우기, 비어 있으면 접기 — 그래서 두 번째 × 가 접는다.
 * 빈 채로 포커스가 나가면 접힌다. 검색어는 탭 로컬 상태다 — 탭을 바꾸면 사라진다.
 */
const TOOL_BTN =
  "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-600 ring-1 ring-inset ring-slate-300 transition-colors duration-200 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400";

const DENSITY_OPTIONS: { value: Density; label: string }[] = [
  { value: "simple", label: "간단" },
  { value: "detail", label: "상세" },
];

export function CardTools({
  search,
  density = false,
  onExport,
  children,
}: {
  search?: { value: string; onChange: (v: string) => void; placeholder: string };
  /** 간단/상세 세그먼트 — 값은 provider 가 쥔다(localStorage) */
  density?: boolean;
  onExport?: () => void;
  /** 보조 버튼(secondary) — 오른쪽 끝 */
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      {search && <SearchTool {...search} />}
      {density && <DensityTool />}
      {onExport && (
        <button type="button" onClick={onExport} aria-label="내보내기" title="내보내기" className={TOOL_BTN}>
          <IconDownload size={15} />
        </button>
      )}
      {children}
    </div>
  );
}

function DensityTool() {
  const { density, setDensity } = useInventory();
  return <Segmented options={DENSITY_OPTIONS} value={density} onChange={setDensity} label="표시 밀도" />;
}

function SearchTool({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function close() {
    onChange("");
    setOpen(false);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-label="검색"
        title="검색"
        className={`${TOOL_BTN} ${open ? "bg-slate-100" : ""}`}
      >
        <IconSearch size={15} />
      </button>
      <div
        className={`relative overflow-hidden transition-[width,opacity] duration-200 ease-out motion-reduce:transition-none ${
          open ? "w-60 opacity-100" : "w-0 opacity-0"
        }`}
        aria-hidden={!open}
      >
        <input
          ref={inputRef}
          tabIndex={open ? 0 : -1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
          onBlur={() => {
            if (!value.trim()) setOpen(false);
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className={`${FIELD_SM} pr-8`}
        />
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          // 포커스가 입력에서 이 버튼으로 옮겨 가는 사이 blur 가 접지 않게 — mousedown 을 막는다
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => (value ? onChange("") : close())}
          aria-label={value ? "검색어 지우기" : "검색 접기"}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-slate-500 transition-colors duration-150 hover:text-slate-700"
        >
          <IconX size={14} />
        </button>
      </div>
    </div>
  );
}
