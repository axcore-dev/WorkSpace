"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { ProfilePhoto } from "@/components/settings/account/profile-photo";
import {
  ActionRow,
  SettingsRow,
  SettingsRows,
  SettingsSection,
} from "@/components/settings/settings-section";
import { Button, FIELD } from "@/components/ui";
import { DEMO_USER, DEPARTMENTS, SITES } from "@/data/org";

/**
 * 고칠 수 있는 프로필 항목.
 *
 * 목록을 데이터로 두는 이유: 행 5개와 수정 팝업이 같은 정의를 봐야 한다. 나눠 놓으면
 * 항목을 하나 더할 때 두 곳을 고쳐야 하고, 한쪽만 고치면 팝업이 안 열리는 행이 생긴다.
 */
const FIELDS = [
  { key: "name", label: "이름" },
  { key: "empNo", label: "사번" },
  { key: "dept", label: "부서", options: DEPARTMENTS },
  { key: "title", label: "직책" },
  { key: "site", label: "기본 사업장", options: SITES },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

/**
 * 계정 › 프로필.
 *
 * **행마다 수정 버튼 + 팝업이다** (수정요청 v12). 전에는 5칸이 다 열린 입력이고 섹션 하단에
 * 저장 버튼 하나였는데, 계정 페이지의 다른 섹션(계정 보안·기기)은 전부 「값을 읽고, 고칠 건
 * 버튼을 눌러 팝업에서」라 프로필만 폼이었다.
 *
 * 팝업은 **하나만 만들고 어느 항목이냐를 state로 받는다.** 5개를 만들면 같은 코드가 5벌 된다.
 *
 * **BE 연동 seam**: 프로필 PATCH API가 아직 없다. 생기면 `save`에서 부르고, 실패할 때
 * `onSaved` 대신 에러 톤으로 알린다 (`onSaved`가 tone을 받는다).
 */
export function ProfileSection({
  onSaved,
}: {
  onSaved: (message: string, tone?: "ink" | "error") => void;
}) {
  const [form, setForm] = useState<Record<FieldKey, string>>({
    name: DEMO_USER.name,
    empNo: DEMO_USER.empNo,
    dept: DEMO_USER.dept,
    title: DEMO_USER.title,
    site: DEMO_USER.site,
  });
  /** 지금 고치고 있는 항목. `null`이면 팝업이 닫혀 있다 */
  const [editing, setEditing] = useState<FieldKey | null>(null);
  /** 팝업 안 입력값 — 저장 전에는 `form`에 쓰지 않는다. 취소하면 버려야 한다 */
  const [draft, setDraft] = useState("");

  const field = FIELDS.find((f) => f.key === editing) ?? null;

  function open(key: FieldKey) {
    setDraft(form[key]);
    setEditing(key);
  }

  function save() {
    if (!field) return;
    const next = draft.trim();
    if (!next) {
      onSaved(`${field.label}을 비워 둘 수 없어요`, "error");
      return;
    }
    setForm((f) => ({ ...f, [field.key]: next }));
    setEditing(null);
    onSaved(`${field.label}을 바꿨어요`);
  }

  return (
    <SettingsSection title="프로필">
      <SettingsRows>
        <SettingsRow>
          <ProfilePhoto onSaved={onSaved} />
        </SettingsRow>

        {FIELDS.map((f) => (
          <SettingsRow key={f.key}>
            <ActionRow name={f.label} value={form[f.key]}>
              <Button variant="secondary" size="sm" onClick={() => open(f.key)}>
                수정
              </Button>
            </ActionRow>
          </SettingsRow>
        ))}
      </SettingsRows>

      <Modal
        open={field !== null}
        onClose={() => setEditing(null)}
        size="sm"
        title={field ? `${field.label} 수정` : ""}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              취소
            </Button>
            <Button onClick={save}>저장하기</Button>
          </div>
        }
      >
        {field && (
          <div className="p-5">
            <label htmlFor="pf-edit" className="sr-only">
              {field.label}
            </label>
            {"options" in field ? (
              <select
                id="pf-edit"
                className={FIELD}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              >
                {field.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="pf-edit"
                autoFocus
                className={FIELD}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                }}
              />
            )}
          </div>
        )}
      </Modal>
    </SettingsSection>
  );
}
