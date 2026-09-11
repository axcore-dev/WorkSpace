"use client";

import { useState } from "react";
import { Chip } from "@/components/multi-picker";
import { ActionRow, SettingsRow, SettingsRows, SettingsSection } from "@/components/settings/settings-section";
import { Button, FIELD_SM, FIELD_SM_ERROR, FIELD_SM_INLINE } from "@/components/ui";
import type { CodeSegment, DocRules } from "@/data/inventory";
import { previewCode, validateDocRules } from "@/lib/inventory-state";
import { ChipEditor } from "../chip-editor";
import { useInventory } from "../inventory-provider";

export const SEGMENT_LABEL: Record<CodeSegment, string> = {
  year: "연도",
  vendorInitial: "거래처 이니셜",
  model: "차종·모델",
  team: "팀·공정",
  seq: "순번",
};
const ALL_SEGMENTS = Object.keys(SEGMENT_LABEL) as CodeSegment[];
/** 발주서에 둘 수 있는 열. 품명 · 수량은 뺄 수 없다 */
const COLUMN_POOL = ["품명", "호칭", "규격", "수량", "단위", "도면번호", "납기", "비고"];
const REQUIRED_COLUMNS = ["품명", "수량"];
const SEPARATORS = [
  { value: "", label: "없음" },
  { value: " ", label: "공백" },
  { value: "-", label: "-" },
  { value: "_", label: "_" },
  { value: "/", label: "/" },
  { value: ".", label: "." },
];

type Section = "segments" | "separators" | "material" | "parts" | "tags";

/** 무채색 칩 목록 — 읽기 상태 */
function Chips({ items }: { items: string[] }) {
  return (
    <span className="flex flex-wrap justify-end gap-1.5">
      {items.map((t) => (
        <Chip key={t} label={t} />
      ))}
    </span>
  );
}

function EditActions({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="secondary" onClick={onClose}>
        닫기
      </Button>
      <Button size="sm" onClick={onSave}>
        저장
      </Button>
    </div>
  );
}

/**
 * 문서 규칙 — 관리번호(조각 순서 · 구분자 · 미리보기) · 발주서 서식(자재/부품 열) · 가공 요청 태그.
 * 섹션마다 [수정] → 그 자리에서 고치고 [저장]. 한 번에 한 섹션만. 미리보기는 고치는 동안 바로 따라온다.
 * 태그를 지워도 이미 붙은 라인의 글자는 남는다(마스터에서만 사라진다) · 이름을 바꾸면 전파된다 — Phase 5 발주서 작성에서 쓴다.
 */
export function RulesTab() {
  const { state, dispatch, notify } = useInventory();
  const r = state.docRules;
  const [editing, setEditing] = useState<Section | null>(null);
  const [draft, setDraft] = useState<DocRules>(r);
  const [error, setError] = useState("");
  const [newTag, setNewTag] = useState("");
  const [renaming, setRenaming] = useState<{ index: number; value: string } | null>(null);

  const shown = editing ? draft : r;

  function start(section: Section) {
    setDraft(r);
    setError("");
    setNewTag("");
    setRenaming(null);
    setEditing(section);
  }

  function save(next: DocRules) {
    const e = validateDocRules(next);
    const key = editing === "segments" ? "codeSegments" : editing ?? "";
    if (e[key]) {
      setError(e[key]);
      return;
    }
    void dispatch({ type: "setDocRules", rules: next }).then((ok) => {
      if (!ok) return;
      notify("저장했어요");
      setEditing(null);
    });
  }

  const editBtn = (section: Section) => (
    <Button size="sm" variant="secondary" disabled={editing !== null} onClick={() => start(section)}>
      수정
    </Button>
  );

  /* ── 태그 편집 ── */
  function addTag() {
    const t = newTag.trim();
    if (!t) return;
    if (draft.processTags.some((x) => x.toLowerCase() === t.toLowerCase())) {
      setError("이미 있는 태그예요");
      return;
    }
    setError("");
    setDraft({ ...draft, processTags: [...draft.processTags, t] });
    setNewTag("");
  }
  function commitRename() {
    if (!renaming) return;
    const t = renaming.value.trim();
    if (t && !draft.processTags.some((x, i) => i !== renaming.index && x.toLowerCase() === t.toLowerCase())) {
      setDraft({ ...draft, processTags: draft.processTags.map((x, i) => (i === renaming.index ? t : x)) });
    }
    setRenaming(null);
  }

  const formatRow = (key: "material" | "parts", name: string) => (
    <SettingsRow>
      <ActionRow name={name}>
        {editing === key ? (
          <div className="flex flex-col items-end gap-3">
            <ChipEditor
              label={`${name} 열`}
              items={draft.formats[key].map((c) => ({ id: c, label: c, locked: REQUIRED_COLUMNS.includes(c) }))}
              onChange={(cols) => setDraft({ ...draft, formats: { ...draft.formats, [key]: cols } })}
              addable={COLUMN_POOL.filter((c) => !draft.formats[key].includes(c)).map((c) => ({ id: c, label: c }))}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <EditActions onClose={() => setEditing(null)} onSave={() => save(draft)} />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Chips items={r.formats[key]} />
            {editBtn(key)}
          </div>
        )}
      </ActionRow>
    </SettingsRow>
  );

  return (
    <div className="max-w-3xl">
      <SettingsSection title="관리번호">
        <SettingsRows>
          <SettingsRow>
            <ActionRow name="조각 순서">
              {editing === "segments" ? (
                <div className="flex flex-col items-end gap-3">
                  <ChipEditor
                    label="관리번호 조각"
                    items={draft.codeSegments.map((s) => ({ id: s, label: SEGMENT_LABEL[s], locked: s === "seq" }))}
                    onChange={(ids) => setDraft({ ...draft, codeSegments: ids as CodeSegment[] })}
                    addable={ALL_SEGMENTS.filter((s) => !draft.codeSegments.includes(s)).map((s) => ({ id: s, label: SEGMENT_LABEL[s] }))}
                  />
                  {error && <p className="text-xs text-red-600">{error}</p>}
                  <EditActions onClose={() => setEditing(null)} onSave={() => save(draft)} />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Chips items={r.codeSegments.map((s) => SEGMENT_LABEL[s])} />
                  {editBtn("segments")}
                </div>
              )}
            </ActionRow>
          </SettingsRow>
          <SettingsRow>
            <ActionRow name="구분자">
              {editing === "separators" ? (
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-sm text-slate-600">
                    팀 앞
                    <select
                      aria-label="팀 앞 구분자"
                      value={draft.separators.beforeTeam}
                      onChange={(e) => setDraft({ ...draft, separators: { ...draft.separators, beforeTeam: e.target.value } })}
                      className={FIELD_SM_INLINE}
                    >
                      {SEPARATORS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-slate-600">
                    공정 앞
                    <select
                      aria-label="공정 앞 구분자"
                      value={draft.separators.beforeOp}
                      onChange={(e) => setDraft({ ...draft, separators: { ...draft.separators, beforeOp: e.target.value } })}
                      className={FIELD_SM_INLINE}
                    >
                      {SEPARATORS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <EditActions onClose={() => setEditing(null)} onSave={() => save(draft)} />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600">
                    팀 앞 <code className="rounded bg-slate-100 px-1">{SEPARATORS.find((s) => s.value === r.separators.beforeTeam)?.label ?? r.separators.beforeTeam}</code> · 공정 앞{" "}
                    <code className="rounded bg-slate-100 px-1">{SEPARATORS.find((s) => s.value === r.separators.beforeOp)?.label ?? r.separators.beforeOp}</code>
                  </span>
                  {editBtn("separators")}
                </div>
              )}
            </ActionRow>
          </SettingsRow>
          <SettingsRow>
            <ActionRow name="미리보기">
              <span className="font-mono text-sm text-slate-900">{previewCode(shown)}</span>
            </ActionRow>
          </SettingsRow>
        </SettingsRows>
      </SettingsSection>

      <SettingsSection title="발주서 서식">
        <SettingsRows>
          {formatRow("material", "자재 발주서")}
          {formatRow("parts", "부품 발주서")}
        </SettingsRows>
      </SettingsSection>

      <SettingsSection
        title="가공 요청 태그"
        aside={
          editing === "tags" ? (
            <EditActions onClose={() => setEditing(null)} onSave={() => save(draft)} />
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">{r.processTags.length}개</span>
              {editBtn("tags")}
            </div>
          )
        }
      >
        <SettingsRows>
          <SettingsRow>
            {editing === "tags" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-1.5" role="list" aria-label="가공 요청 태그">
                  {draft.processTags.map((t, i) =>
                    renaming?.index === i ? (
                      <input
                        key={`edit-${i}`}
                        autoFocus
                        aria-label={`${t} 이름 바꾸기`}
                        value={renaming.value}
                        onChange={(e) => setRenaming({ index: i, value: e.target.value })}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename();
                          if (e.key === "Escape") setRenaming(null);
                        }}
                        className={`${FIELD_SM} w-32`}
                      />
                    ) : (
                      <span role="listitem" key={t}>
                        <Chip label={t} onClick={() => setRenaming({ index: i, value: t })} onRemove={() => setDraft({ ...draft, processTags: draft.processTags.filter((_, k) => k !== i) })} removeLabel={`${t} 빼기`} />
                      </span>
                    ),
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    aria-label="새 태그"
                    aria-invalid={!!error}
                    placeholder="+ 태그"
                    value={newTag}
                    onChange={(e) => {
                      setNewTag(e.target.value);
                      setError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && addTag()}
                    className={`${error ? FIELD_SM_ERROR : FIELD_SM} w-40`}
                  />
                  <Button size="sm" variant="secondary" onClick={addTag} disabled={!newTag.trim()}>
                    추가
                  </Button>
                  {error && <p className="text-xs text-red-600">{error}</p>}
                </div>
              </div>
            ) : (
              <Chips items={r.processTags} />
            )}
          </SettingsRow>
        </SettingsRows>
      </SettingsSection>
    </div>
  );
}
