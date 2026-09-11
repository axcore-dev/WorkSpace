"use client";

import { Chip, useChipReorder } from "@/components/multi-picker";

/**
 * 순서가 뜻인 칩 목록 편집 — 문서 규칙(관리번호 조각 · 발주서 서식 열)이 쓴다.
 * 드래그(키보드 Alt+←/→)로 순서를 바꾸고, `locked` 가 아닌 칩은 × 로 뺀다. 아래에 더할 수 있는 항목이 점선 칩으로 뜬다.
 */
export function ChipEditor({
  items,
  onChange,
  addable = [],
  label,
}: {
  items: { id: string; label: string; locked?: boolean }[];
  /** 새 순서(빼기 · 더하기 포함) */
  onChange: (ids: string[]) => void;
  addable?: { id: string; label: string }[];
  label: string;
}) {
  const ids = items.map((i) => i.id);
  const reorder = useChipReorder(ids, onChange);
  return (
    <div className="space-y-2">
      <div role="list" aria-label={label} className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => (
          <span role="listitem" key={it.id}>
            <Chip
              label={it.label}
              dragging={reorder.dragging === i}
              dragProps={reorder.dragProps(i)}
              onKeyDown={(e) => {
                if (reorder.keyReorder(i, e)) return;
                if (!it.locked && (e.key === "Backspace" || e.key === "Delete")) {
                  e.preventDefault();
                  onChange(ids.filter((x) => x !== it.id));
                }
              }}
              onRemove={it.locked ? undefined : () => onChange(ids.filter((x) => x !== it.id))}
              removeLabel={`${it.label} 빼기`}
            />
          </span>
        ))}
      </div>
      {addable.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {addable.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onChange([...ids, a.id])}
              className="cursor-pointer rounded border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-500 transition-colors duration-150 hover:border-slate-400 hover:text-slate-700"
            >
              + {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
