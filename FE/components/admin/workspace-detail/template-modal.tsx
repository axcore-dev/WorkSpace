"use client";

import { useMemo, useState } from "react";
import { Field } from "@/components/admin/form-parts";
import { Modal } from "@/components/modal";
import { Button, FIELD } from "@/components/ui";
import { ApiRequestError } from "@/lib/api";
import { applyConceptTemplate, type ConceptTemplateDto, type ExternalConceptAdminDto, type ExternalSystemAdminDto } from "@/lib/admin-api";
import { conceptsByTable } from "@/lib/concept-sql";

/** 개념 하나의 판정. 「같은 표」 는 SQL 의 FROM 표로 본다 — id 만 비교하면 DB 초안 `mes_defects` 와 템플릿 `mes_defect` 가 둘 다 들어간다(#116 1번) */
type Status = { kind: "new" } | { kind: "same-id" } | { kind: "same-table"; other: { conceptId: string; name: string } };

/**
 * 「템플릿 적용」 — DB 초안 모달처럼 확인 목록을 거친다. 개념마다 체크 · 이름 · id · 상태를 보이고, 상태가
 * 「같은 표를 읽는 개념이 있어요」 면 기본 체크 해제, 「같은 id 가 있어요」 면 아예 못 고른다. 버튼은 「개념 N개 넣기」.
 * 넣는 동안 버튼을 잠가 두 번 눌러 요청이 두 번 가는 일을 막는다.
 */
export function TemplateModal({
  workspaceId,
  systems,
  templates,
  existing,
  initialSystemId,
  onClose,
  onDone,
}: {
  workspaceId: number;
  systems: ExternalSystemAdminDto[];
  templates: ConceptTemplateDto[];
  /** 지금 있는 외부 개념 전부 — id · 표 겹침 판정 */
  existing: ExternalConceptAdminDto[];
  initialSystemId: number;
  onClose: () => void;
  /** 넣은 행들(비어 있으면 넣은 게 없다). 되돌리기가 이 id 로 지운다 */
  onDone: (inserted: ExternalConceptAdminDto[]) => Promise<void>;
}) {
  const [systemId, setSystemId] = useState(initialSystemId);
  const [templateKey, setTemplateKey] = useState(templates[0]?.key ?? "");
  const template = templates.find((t) => t.key === templateKey) ?? null;
  /** 사용자가 손댄 체크. 없는 키는 판정의 기본값을 따른다 */
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statuses = useMemo(() => {
    const ids = new Set(existing.map((c) => c.conceptId));
    const byTable = conceptsByTable(existing.filter((c) => c.systemId === systemId));
    const out = new Map<string, Status>();
    for (const c of template?.concepts ?? []) {
      if (ids.has(c.conceptId)) out.set(c.conceptId, { kind: "same-id" });
      else if (c.table && byTable.get(c.table)?.length) {
        const o = byTable.get(c.table)![0];
        out.set(c.conceptId, { kind: "same-table", other: { conceptId: o.conceptId, name: o.name } });
      } else out.set(c.conceptId, { kind: "new" });
    }
    return out;
  }, [template, existing, systemId]);

  const isOn = (id: string) => {
    const s = statuses.get(id);
    if (!s || s.kind === "same-id") return false;
    return picked[id] ?? s.kind === "new";
  };
  const chosen = (template?.concepts ?? []).filter((c) => isOn(c.conceptId)).map((c) => c.conceptId);

  async function run() {
    if (!template || chosen.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      const inserted = await applyConceptTemplate(workspaceId, systemId, template.key, chosen);
      await onDone(inserted);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "템플릿을 적용하지 못했어요");
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="템플릿 적용"
      desc="템플릿의 개념을 시스템에 넣어요. 같은 id 가 있거나 같은 표를 읽는 개념이 이미 있으면 표시해요."
      size="lg"
      footer={
        <div className="flex items-center gap-2">
          {error && (
            <p role="alert" className="mr-auto min-w-0 text-[13px] text-red-600">
              {error}
            </p>
          )}
          <Button variant="secondary" onClick={onClose} disabled={saving} className={error ? "" : "ml-auto"}>
            닫기
          </Button>
          <Button onClick={() => void run()} disabled={saving || chosen.length === 0}>
            {saving ? "넣는 중…" : `개념 ${chosen.length}개 넣기`}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="tpl-system" label="시스템">
          <select id="tpl-system" value={systemId} onChange={(e) => { setSystemId(Number(e.target.value)); setPicked({}); }} className={`${FIELD} cursor-pointer`}>
            {systems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.kind})
              </option>
            ))}
          </select>
        </Field>
        <Field id="tpl-key" label="템플릿">
          <select id="tpl-key" value={templateKey} onChange={(e) => { setTemplateKey(e.target.value); setPicked({}); }} className={`${FIELD} cursor-pointer`}>
            {templates.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name} · {t.kind} · 개념 {t.conceptCount}개
              </option>
            ))}
          </select>
        </Field>
      </div>

      <ul className="thin-scroll mt-4 max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
        {(template?.concepts ?? []).map((c) => {
          const s = statuses.get(c.conceptId) ?? { kind: "new" as const };
          const on = isOn(c.conceptId);
          const id = `tpl-c-${c.conceptId}`;
          return (
            <li key={c.conceptId} className={`flex items-start gap-3 px-3 py-2 ${s.kind === "same-id" ? "opacity-55" : ""}`}>
              <input
                type="checkbox"
                id={id}
                checked={on}
                disabled={s.kind === "same-id"}
                onChange={() => setPicked((p) => ({ ...p, [c.conceptId]: !on }))}
                className="mt-1 accent-slate-900"
              />
              <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[13px] font-medium text-slate-900">{c.name}</span>
                  <span className="font-mono text-[11px] text-slate-500">{c.conceptId}</span>
                  {c.table && <span className="font-mono text-[11px] text-slate-500">← {c.table}</span>}
                </span>
                <span className={`block text-[12px] ${s.kind === "new" ? "text-slate-500" : "text-amber-700"}`}>
                  {s.kind === "new" && "새로 넣어요"}
                  {s.kind === "same-id" && "같은 id 가 있어요 — 건너뛰어요"}
                  {s.kind === "same-table" && `같은 표를 읽는 개념이 있어요: ${s.other.name} (${s.other.conceptId})`}
                </span>
              </label>
            </li>
          );
        })}
        {template && template.concepts.length === 0 && <li className="px-3 py-4 text-sm text-slate-500">이 템플릿에 개념이 없어요.</li>}
      </ul>
    </Modal>
  );
}
