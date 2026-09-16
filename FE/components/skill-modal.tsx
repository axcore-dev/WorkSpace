"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/modal";
import { Button, FIELD } from "@/components/ui";
import { IconCheck, IconPencil, IconPlus, IconSearch, IconTrash } from "@/components/icons";
import { SKILL_CATEGORIES, type Skill, type SkillCategory } from "@/data/chat";
import { ApiRequestError } from "@/lib/api";
import { createSkill, deleteSkill, updateSkill, type SkillInput } from "@/lib/ai/skills";

const EMPTY: SkillInput = { name: "", desc: "", category: "other", instructions: "" };

/**
 * 스킬 고르기 팝업 — 기본 스킬(코드)과 회사 스킬(`ai_skills`)을 분야별로 묶어 보이고, 관리자는 여기서 회사 스킬을 만들고 고치고
 * 지운다. 별도 설정 화면을 두지 않는 이유: 스킬은 쓰는 자리에서 다듬는 것이 가장 빠르고, 관리자가 아니면 버튼이 없을 뿐 목록은 같다.
 *
 * 쓰기 권한은 `canEdit`(화면 잠금)와 서버(`principal.admin`, 403) 두 겹이다. 잠금을 우회해 보내도 서버가 막는다.
 */
export function SkillModal({
  open,
  onClose,
  selected,
  onToggle,
  skills,
  canEdit,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  /** 이 턴에 물린 스킬 id */
  selected: string[];
  onToggle: (id: string) => void;
  /** 기본 + 회사 스킬. `lib/ai/skills.ts` listSkills */
  skills: Skill[];
  /** 회사 관리자인가 — 만들기 · 고치기 · 지우기 버튼을 보인다 */
  canEdit: boolean;
  /** 회사 스킬이 바뀐 뒤 — 부모가 목록을 다시 받는다 */
  onChanged: () => void;
}) {
  const [q, setQ] = useState("");
  /** 분야 칩 — null 은 전체 */
  const [cat, setCat] = useState<SkillCategory | null>(null);
  /** 편집 중인 것 — "new" 는 만들기, 그 밖은 회사 스킬 id */
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [form, setForm] = useState<SkillInput>(EMPTY);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needle = q.trim().toLowerCase();
  const matches = (s: Skill) =>
    (!cat || s.category === cat) &&
    (!needle || s.name.toLowerCase().includes(needle) || s.desc.toLowerCase().includes(needle) || s.id.includes(needle));
  // 분야 순서대로 묶는다. 검색 · 칩으로 비는 분야는 머리도 내지 않는다
  const groups = SKILL_CATEGORIES.map((c) => ({ ...c, items: skills.filter((s) => s.category === c.id && matches(s)) })).filter(
    (g) => g.items.length > 0,
  );
  const countOf = (id: SkillCategory) => skills.filter((s) => s.category === id).length;

  const startEdit = (target: "new" | Skill) => {
    setEditing(target === "new" ? "new" : target.id);
    setForm(
      target === "new"
        ? { ...EMPTY, category: cat ?? "other" }
        : { name: target.name, desc: target.desc, category: target.category, instructions: target.instructions },
    );
    setConfirmId(null);
    setError(null);
  };
  const stopEdit = () => {
    setEditing(null);
    setError(null);
  };

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      onChanged();
      return true;
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.body.message : "저장하지 못했어요. 잠시 후 다시 시도해 주세요");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const ok = await run(() => (editing === "new" ? createSkill(form) : updateSkill(editing, form)));
    if (ok) stopEdit();
  };

  const remove = async (id: string) => {
    const ok = await run(() => deleteSkill(id));
    if (ok) {
      setConfirmId(null);
      if (selected.includes(id)) onToggle(id);
    }
  };

  const editor = (
    <form onSubmit={submit} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex gap-2">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="이름 (예: 주간 안전 점검 보고)"
          maxLength={60}
          required
          autoFocus
          className={FIELD}
        />
        <label className="sr-only" htmlFor="skill-category">
          분야
        </label>
        <select
          id="skill-category"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value as SkillCategory })}
          className={`${FIELD} w-auto shrink-0`}
        >
          {SKILL_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <input
        value={form.desc}
        onChange={(e) => setForm({ ...form, desc: e.target.value })}
        placeholder="한 줄 설명 — 목록에 보인다"
        maxLength={200}
        required
        className={FIELD}
      />
      <textarea
        value={form.instructions}
        onChange={(e) => setForm({ ...form, instructions: e.target.value })}
        placeholder="AI 에게 주는 작업 방식 — 양식 · 순서 · 하지 말 것. 예: 제목 → 요약 3줄 → 항목별 표 → 결재선 자리. 수치는 업무 데이터에서 조회해 출처를 적는다"
        maxLength={4000}
        required
        rows={5}
        className={`${FIELD} resize-y leading-relaxed`}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-slate-500">{form.instructions.length.toLocaleString()} / 4,000</p>
        <div className="flex gap-1.5">
          <Button type="button" variant="ghost" size="sm" onClick={stopEdit} disabled={busy}>
            취소
          </Button>
          <Button type="submit" size="sm" disabled={busy}>
            {editing === "new" ? "만들기" : "저장"}
          </Button>
        </div>
      </div>
      {error && <p className="text-[13px] text-red-600">{error}</p>}
    </form>
  );

  const chip = (label: string, active: boolean, onClick: () => void, count?: number) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`cursor-pointer whitespace-nowrap rounded-lg border px-2.5 py-1 text-[13px] transition-colors ${
        active ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}
    >
      {label}
      {count !== undefined && <span className={`ml-1 ${active ? "text-slate-300" : "text-slate-400"}`}>{count}</span>}
    </button>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="스킬 사용"
      headerAccessory={
        canEdit && editing !== "new" ? (
          <Button variant="secondary" size="sm" onClick={() => startEdit("new")}>
            <IconPlus size={13} />
            회사 스킬 만들기
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-2.5 border-b border-slate-100 px-4 py-3">
        <label htmlFor="skill-search" className="sr-only">
          스킬 검색
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 focus-within:border-slate-400">
          <IconSearch size={15} className="shrink-0 text-slate-400" />
          <input
            id="skill-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="스킬 검색"
            className="w-full border-none bg-transparent text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        {/* 분야 칩 — 스킬이 하나도 없는 분야는 칩도 없다 */}
        <div className="flex flex-wrap gap-1.5">
          {chip("전체", cat === null, () => setCat(null), skills.length)}
          {SKILL_CATEGORIES.filter((c) => countOf(c.id) > 0).map((c) => (
            <span key={c.id}>{chip(c.name, cat === c.id, () => setCat(cat === c.id ? null : c.id), countOf(c.id))}</span>
          ))}
        </div>
      </div>
      {editing === "new" && <div className="px-3 pt-3">{editor}</div>}
      <div className="p-2">
        {groups.length === 0 && <p className="px-3 py-8 text-center text-[15px] text-slate-400">찾는 스킬이 없어요.</p>}
        {groups.map((g) => (
          <section key={g.id} className="mb-1">
            <h3 className="px-3 pb-1 pt-3 text-[13px] font-semibold text-slate-500">
              {g.name} <span className="font-normal text-slate-400">{g.items.length}</span>
            </h3>
            <ul className="divide-y divide-slate-100">
              {g.items.map((s) => {
                const on = selected.includes(s.id);
                if (editing === s.id) {
                  return (
                    <li key={s.id} className="px-1 py-2">
                      {editor}
                    </li>
                  );
                }
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[15px] font-semibold text-slate-900">
                        {s.name}
                        <span className="rounded border border-slate-200 px-1.5 text-[13px] font-normal text-slate-400">
                          {s.official ? "기본 제공" : "회사"}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">{s.desc}</p>
                      {confirmId === s.id && (
                        <p className="mt-1.5 flex items-center gap-2 text-[13px] text-slate-600">
                          이 스킬을 지울까요?
                          <button
                            type="button"
                            onClick={() => void remove(s.id)}
                            disabled={busy}
                            className="cursor-pointer font-semibold text-red-600"
                          >
                            지우기
                          </button>
                          <button type="button" onClick={() => setConfirmId(null)} className="cursor-pointer text-slate-500">
                            취소
                          </button>
                        </p>
                      )}
                      {error && confirmId === s.id && <p className="mt-1 text-[13px] text-red-600">{error}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {canEdit && !s.official && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(s)}
                            aria-label={`${s.name} 고치기`}
                            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
                          >
                            <IconPencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmId(s.id);
                              setError(null);
                            }}
                            aria-label={`${s.name} 지우기`}
                            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
                          >
                            <IconTrash size={14} />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => onToggle(s.id)}
                        aria-pressed={on}
                        className={`inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                          on ? "bg-slate-800 text-white hover:bg-slate-700" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {on ? <IconCheck size={13} /> : <IconPlus size={13} />}
                        {on ? "사용 중" : "사용"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  );
}
