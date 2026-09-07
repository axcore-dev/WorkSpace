"use client";

import { useState } from "react";
import { ActionRow } from "@/components/settings/settings-section";
import { IconPencil } from "@/components/icons";
import { Button, FIELD } from "@/components/ui";

/**
 * 그 자리에서 고치는 값 — 팝업을 열지 않는다.
 *
 * 짧은 값(이름·사번·사업장) 하나를 바꾸는 데 팝업을 띄우면 열고·고치고·저장하고·닫는
 * 네 동작이 붙는다. 절차가 있는 것(비밀번호·2단계 인증·이메일)만 팝업으로 남긴다.
 *
 * 두 모양을 쓴다:
 * - `row` — 「이름 · 값 · 수정」 한 줄. 프로필 아래쪽 항목
 * - `text` — 값 글자 자체가 버튼. 아이덴티티 헤더의 이름·부서
 *
 * Enter로 저장, Esc로 취소한다. 빈 값은 막는다 — 이름이 사라지면 목록에서 사람을 못 찾는다.
 */
export function InlineField({
  label,
  value,
  options,
  onSave,
  variant = "row",
  className = "",
}: {
  label: string;
  value: string;
  /** 주면 select, 없으면 input */
  options?: readonly string[];
  onSave: (next: string) => void;
  variant?: "row" | "text";
  /** `text` 모양에서 값 글자에 붙일 클래스 */
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function open() {
    setDraft(value);
    setEditing(true);
  }

  function save() {
    const next = draft.trim();
    if (!next) return;
    onSave(next);
    setEditing(false);
  }

  const input = options ? (
    <select
      autoFocus
      aria-label={label}
      className={`${FIELD} py-1.5 text-[13px] md:max-w-[220px]`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  ) : (
    <input
      autoFocus
      aria-label={label}
      className={`${FIELD} py-1.5 text-[13px] md:max-w-[220px]`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          save();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setEditing(false);
        }
      }}
    />
  );

  const actions = (
    <>
      <Button size="sm" onClick={save} disabled={!draft.trim()}>
        저장
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
        취소
      </Button>
    </>
  );

  if (variant === "text") {
    if (editing) {
      return (
        <span className="flex flex-wrap items-center gap-1.5">
          {input}
          {actions}
        </span>
      );
    }
    return (
      <button
        type="button"
        onClick={open}
        aria-label={`${label} 수정`}
        className={`group -mx-1 inline-flex cursor-pointer items-center gap-1.5 rounded px-1 text-left transition-colors duration-150 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${className}`}
      >
        {value}
        {/* 평소에는 숨긴다 — 아이콘 다섯 개가 늘 떠 있으면 헤더가 공구함처럼 보인다 */}
        <IconPencil
          size={13}
          className="shrink-0 text-slate-300 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
        />
      </button>
    );
  }

  return (
    <ActionRow name={label} value={editing ? undefined : value}>
      {editing ? (
        <span className="flex flex-wrap items-center justify-end gap-1.5">
          {input}
          {actions}
        </span>
      ) : (
        <Button variant="secondary" size="sm" onClick={open}>
          수정
        </Button>
      )}
    </ActionRow>
  );
}
