"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { FieldRow } from "@/components/settings/settings-section";
import { Button, FIELD, FIELD_ERROR } from "@/components/ui";
import type { RoleDef } from "@/data/roles";

/**
 * 권한(역할) 만들기 팝업.
 *
 * **권한 내용은 여기서 정하지 않는다.** 이름과 부서만 받고, 만들면 그 역할이 선택된 채로
 * 편집기가 열린다 — 체크박스 31개를 팝업 안에 또 그리면 같은 목록이 두 벌이 되고, 만들자마자
 * 바로 옆에서 고칠 수 있는 걸 팝업에서 미리 정하게 할 이유가 없다.
 *
 * 기존 이름과 겹치면 막는다. `roleMemberCount`가 이름으로 구성원을 세기 때문에, 같은 이름이
 * 둘이면 두 역할의 구성원 수가 서로의 것까지 합쳐진다.
 *
 * **부모가 열 때만 마운트한다** (`{creating && <RoleCreateModal …>}`). `open` prop을 받아
 * 안에서 숨기면 닫아도 입력이 남아, 다시 열 때 지우는 effect가 필요해진다 — 그 effect가
 * 곧 `react-hooks/set-state-in-effect`다. 마운트 자체를 부모가 쥐면 `useState` 초기값이
 * 그 일을 대신한다.
 *
 * **BE 연동 seam**: `onCreate`가 역할 생성 API를 부른다. id는 지금 시각으로 만든다 —
 * BE가 생기면 서버가 준 id를 쓴다.
 */
export function RoleCreateModal({
  onClose,
  onCreate,
  depts,
  taken,
}: {
  onClose: () => void;
  onCreate: (role: RoleDef) => void;
  depts: readonly string[];
  /** 이미 쓰이고 있는 역할 이름 */
  taken: string[];
}) {
  const [name, setName] = useState("");
  const [dept, setDept] = useState<string>(depts[0] ?? "");

  const trimmed = name.trim();
  const duplicate = taken.some((t) => t === trimmed);
  const canSubmit = trimmed.length > 0 && !duplicate;

  function submit() {
    if (!canSubmit) return;
    onCreate({
      id: `role-${Date.now()}`,
      name: trimmed,
      system: false,
      dept,
      // 아무 권한 없이 시작한다 — 새 역할이 뭘 할 수 있는지는 만든 사람이 정한다
      perms: [],
      scope: "own",
      showAmounts: false,
      canDelegateInvite: false,
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="권한 만들기"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button disabled={!canSubmit} onClick={submit}>
            만들기
          </Button>
        </div>
      }
    >
      <div className="space-y-3 p-5">
        <FieldRow label="이름" htmlFor="rc-name">
          <input
            id="rc-name"
            autoFocus
            className={duplicate ? FIELD_ERROR : FIELD}
            value={name}
            placeholder="예: 생산 계획 담당"
            aria-invalid={duplicate}
            aria-describedby={duplicate ? "rc-name-err" : undefined}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        </FieldRow>

        {duplicate && (
          <p id="rc-name-err" className="pl-[132px] text-xs text-red-600">
            이미 있는 이름이에요. 다른 이름을 지어 주세요
          </p>
        )}

        <FieldRow label="부서" htmlFor="rc-dept">
          <select
            id="rc-dept"
            className={FIELD}
            value={dept}
            onChange={(e) => setDept(e.target.value)}
          >
            {depts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </FieldRow>

        <p className="pl-[132px] text-xs text-slate-400">
          만들면 권한을 아무것도 갖지 않은 상태로 시작해요. 이어서 오른쪽에서 골라 주세요.
        </p>
      </div>
    </Modal>
  );
}
