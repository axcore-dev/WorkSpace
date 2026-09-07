"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { Button, FIELD } from "@/components/ui";
import { withJosa } from "@/data/ko";

/**
 * 부서·직급을 만들고 지우는 팝업들.
 *
 * 넷 다 **열 때만 마운트한다** — `open` prop을 받아 안에서 숨기면 닫아도 입력이 남아,
 * 다시 열 때 지우는 effect가 필요해진다. 그 effect가 곧
 * `react-hooks/set-state-in-effect`다 (`role-create-modal.tsx`와 같은 이유).
 */

/** 이름 하나만 받는 팝업 — 부서 만들기·이름 바꾸기, 직급 만들기가 같이 쓴다 */
export function NameModal({
  title,
  label,
  placeholder,
  initial = "",
  hint,
  taken,
  onClose,
  onSubmit,
}: {
  title: string;
  label: string;
  placeholder?: string;
  initial?: string;
  hint?: string;
  /** 이미 쓰이고 있는 이름 — 같은 이름이 둘이면 어느 쪽인지 못 가린다 */
  taken: string[];
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  const trimmed = name.trim();
  const dup = trimmed !== initial && taken.some((t) => t === trimmed);
  const ok = trimmed.length > 0 && !dup;

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button disabled={!ok} onClick={() => ok && onSubmit(trimmed)}>
            {initial ? "저장" : "만들기"}
          </Button>
        </div>
      }
    >
      <div className="p-5">
        <label htmlFor="nm-input" className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </label>
        <input
          id="nm-input"
          autoFocus
          className={FIELD}
          value={name}
          placeholder={placeholder}
          aria-invalid={dup}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && ok) onSubmit(trimmed);
          }}
        />
        {dup ? (
          <p className="mt-1.5 text-xs text-red-600">이미 있는 이름이에요</p>
        ) : (
          hint && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>
        )}
      </div>
    </Modal>
  );
}

/**
 * 부서 지우기.
 *
 * 직급이 남아 있으면 **바로 못 지운다** — 옮길 부서를 고르거나 직급을 먼저 지워야 한다.
 * 부서만 지우고 직급을 떠돌게 두면 어느 부서에도 없는 직급이 생긴다.
 */
export function DeptDeleteModal({
  dept,
  ranks,
  blocked,
  others,
  onClose,
  onDelete,
}: {
  dept: string;
  /** 이 부서에 남은 직급 이름 */
  ranks: string[];
  /** 바로 지울 수 없는가 — 판정은 `data/roles.ts`의 `deptDeletable`이 한다 */
  blocked: boolean;
  /** 옮길 수 있는 다른 부서 */
  others: string[];
  onClose: () => void;
  /** `moveTo`가 있으면 직급을 그 부서로 옮기고 지운다 */
  onDelete: (moveTo: string | null) => void;
}) {
  const [moveTo, setMoveTo] = useState("");
  const ok = !blocked || moveTo !== "";

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`${withJosa(dept, "을/를")} 지울까요?`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button variant="danger" disabled={!ok} onClick={() => onDelete(moveTo || null)}>
            {blocked ? "옮기고 지우기" : "지우기"}
          </Button>
        </div>
      }
    >
      <div className="p-5">
        {blocked ? (
          <>
            <p className="text-[13.5px] text-slate-600">
              이 부서에 직급 {ranks.length}개가 남아 있어요 — {ranks.join(" · ")}
            </p>
            <p className="mt-3 border-l-2 border-slate-200 pl-3 text-xs leading-relaxed text-slate-500">
              직급이 남은 부서는 지울 수 없어요. 옮길 부서를 고르거나, 직급을 먼저 지워 주세요.
            </p>
            <label htmlFor="dd-move" className="mb-1.5 mt-4 block text-sm font-medium text-slate-700">
              직급을 옮길 부서
            </label>
            <select
              id="dd-move"
              className={FIELD}
              value={moveTo}
              onChange={(e) => setMoveTo(e.target.value)}
            >
              <option value="">고르지 않음 — 직급을 직접 지울게요</option>
              {others.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </>
        ) : (
          <p className="text-[13.5px] text-slate-600">
            직급이 없는 부서라 바로 지울 수 있어요.
          </p>
        )}
      </div>
    </Modal>
  );
}

/**
 * 직급 지우기.
 *
 * 구성원이 있으면 **옮길 직급을 골라야** 지운다. 직급이 없는 사람은 로그인해도 볼 화면이 없다.
 */
export function RankDeleteModal({
  rank,
  members,
  others,
  onClose,
  onDelete,
}: {
  rank: string;
  /** 이 직급을 가진 사람 수 */
  members: number;
  /** 옮길 수 있는 다른 직급 — `이름 (부서)` */
  others: { name: string; label: string }[];
  onClose: () => void;
  onDelete: (moveTo: string | null) => void;
}) {
  const [moveTo, setMoveTo] = useState(others[0]?.name ?? "");
  const needsMove = members > 0;
  const ok = !needsMove || moveTo !== "";

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`${withJosa(rank, "을/를")} 지울까요?`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button variant="danger" disabled={!ok} onClick={() => onDelete(needsMove ? moveTo : null)}>
            {needsMove ? "옮기고 지우기" : "지우기"}
          </Button>
        </div>
      }
    >
      <div className="p-5">
        {needsMove ? (
          <>
            <p className="text-[13.5px] text-slate-600">
              이 직급을 가진 구성원이 {members}명 있어요.
            </p>
            <p className="mt-3 border-l-2 border-slate-200 pl-3 text-xs leading-relaxed text-slate-500">
              지우면 그 사람은 어느 탭도 볼 수 없게 돼요. 옮길 직급을 골라 주세요.
            </p>
            <label htmlFor="rd-move" className="mb-1.5 mt-4 block text-sm font-medium text-slate-700">
              이 사람들의 새 직급
            </label>
            <select
              id="rd-move"
              className={FIELD}
              value={moveTo}
              onChange={(e) => setMoveTo(e.target.value)}
            >
              {others.map((o) => (
                <option key={o.name} value={o.name}>
                  {o.label}
                </option>
              ))}
            </select>
          </>
        ) : (
          <p className="text-[13.5px] text-slate-600">
            이 직급을 가진 구성원이 없어요. 바로 지울 수 있어요.
          </p>
        )}
      </div>
    </Modal>
  );
}
