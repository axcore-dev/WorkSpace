"use client";

import { useId, useState } from "react";
import { Field } from "@/components/admin/form-parts";
import { IconX } from "@/components/icons";
import { Modal } from "@/components/modal";
import { Button, FIELD, FIELD_ERROR, FIELD_SM } from "@/components/ui";
import { MODULES } from "@/data/modules";
import { ApiRequestError } from "@/lib/api";
import { CONCEPT_ID } from "@/lib/concept-sql";
import {
  createConcept,
  previewConceptSql,
  updateConcept,
  type ConceptPreviewDto,
  type ExternalConceptAdminDto,
  type ExternalConceptInput,
  type ExternalSystemAdminDto,
} from "@/lib/admin-api";

export const TAB_OPTIONS = MODULES.flatMap((m) => m.subfunctions.map((s) => ({ value: s.id, label: `${m.name} · ${s.name}` })));

/** 시스템 종류(MES · ERP …)와 같은 externalSystem 을 가진 모듈의 첫 탭. 없으면 첫 탭. 초안 모달과 「개념 추가」 가 같이 쓴다 */
export function defaultTab(kind: string | undefined): string {
  const m = kind ? MODULES.find((x) => x.externalSystem === kind) : undefined;
  return m?.subfunctions[0]?.id ?? TAB_OPTIONS[0]?.value ?? "";
}

/** 관계 선택 칸의 후보 — 「이름 (id)」 로 보이고 원천별로 묶는다 */
export type ConceptOption = { id: string; name: string; system: string };

type Errors = Partial<Record<"conceptId" | "name" | "description" | "sql" | "orderBy" | "attrs", string>>;

/**
 * 개념 추가 · 수정 폼.
 *
 * `<form>` 이라 Enter 로도 저장된다. 저장 버튼은 늘 켜 두고, 누르면 빈 필수 칸마다 이유를 붙이고 첫 오류 칸으로 포커스를 옮긴다 —
 * 이유 없이 비활성인 버튼은 무엇을 채워야 하는지 말하지 않는다(#116 3번). 서버 오류는 토스트가 아니라 바닥 줄에 보인다.
 * 수정할 때 개념 id 는 읽기 전용이다 — 다른 개념의 관계가 id 로 이어져 있어 바꾸면 조용히 끊긴다(BE 도 막는다).
 */
export function ConceptForm({
  workspaceId,
  systems,
  systemId: initialSystemId,
  initial,
  conceptOptions,
  onClose,
  onSaved,
}: {
  workspaceId: number;
  systems: ExternalSystemAdminDto[];
  systemId: number;
  initial: ExternalConceptAdminDto | null;
  conceptOptions: ConceptOption[];
  onClose: () => void;
  onSaved: (d: ExternalConceptAdminDto) => Promise<void>;
}) {
  const formId = useId();
  const [systemId, setSystemId] = useState(initialSystemId);
  const systemKind = systems.find((s) => s.id === systemId)?.kind;
  const [d, setD] = useState<ExternalConceptInput>({
    conceptId: initial?.conceptId ?? "",
    name: initial?.name ?? "",
    synonyms: initial?.synonyms ?? [],
    // 새 개념의 기본 탭은 목록 첫 항목이 아니라 시스템 종류에 맞는 모듈(MES → 생산관리)의 첫 탭
    tab: initial?.tab ?? defaultTab(systemKind),
    description: initial?.description ?? "",
    attrs: initial?.attrs ?? {},
    relations: initial?.relations ?? [],
    formula: initial?.formula ?? null,
    sql: initial?.sql ?? "select * from ",
    filterColumns: initial?.filterColumns ?? [],
    orderBy: initial?.orderBy ?? "",
    sortOrder: initial?.sortOrder ?? 0,
  });
  const [synonymText, setSynonymText] = useState((initial?.synonyms ?? []).join(", "));
  const [preview, setPreview] = useState<ConceptPreviewDto | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const set = (patch: Partial<ExternalConceptInput>) => setD((p) => ({ ...p, ...patch }));
  const attrKeys = Object.keys(d.attrs);

  /** 입력 중에도 id 모양을 본다 — 저장을 눌러야 아는 것보다 낫다 */
  const idShapeError = !initial && d.conceptId.trim() !== "" && !CONCEPT_ID.test(d.conceptId.trim()) ? "영문 소문자로 시작하는 소문자 · 숫자 · 밑줄 2~50자예요" : undefined;

  function changeSystem(id: number) {
    setSystemId(id);
    // 탭을 손대지 않았으면 새 시스템 종류에 맞춰 따라간다
    const kind = systems.find((s) => s.id === id)?.kind;
    if (d.tab === defaultTab(systemKind)) set({ tab: defaultTab(kind) });
  }

  async function runPreview() {
    setPreviewing(true);
    setServerError(null);
    try {
      setPreview(await previewConceptSql(workspaceId, systemId, d.sql));
    } catch (e) {
      setServerError(e instanceof ApiRequestError ? e.message : "미리보기를 돌리지 못했어요");
    } finally {
      setPreviewing(false);
    }
  }

  /** 미리보기가 준 컬럼 중 attrs 에 없는 것을 라벨 비운 채로 더한다. 정렬이 비어 있으면 첫 컬럼으로 */
  function fillFromPreview() {
    if (!preview || preview.columns.length === 0) return;
    const next = { ...d.attrs };
    for (const c of preview.columns) if (!(c in next)) next[c] = "";
    set({ attrs: next, orderBy: d.orderBy || preview.columns[0] });
    setErrors((p) => ({ ...p, attrs: undefined, orderBy: undefined }));
  }

  function setAttr(key: string, label: string) {
    set({ attrs: { ...d.attrs, [key]: label } });
  }
  function removeAttr(key: string) {
    const next = { ...d.attrs };
    delete next[key];
    set({ attrs: next, filterColumns: d.filterColumns.filter((c) => c !== key), relations: d.relations.filter((r) => r.attr !== key) });
  }
  function toggleFilter(key: string) {
    set({ filterColumns: d.filterColumns.includes(key) ? d.filterColumns.filter((c) => c !== key) : [...d.filterColumns, key] });
  }
  function setRelation(key: string, to: string) {
    const rest = d.relations.filter((r) => r.attr !== key);
    set({ relations: to ? [...rest, { attr: key, to }] : rest });
  }

  /** 빈 필수 칸 → 이유. 첫 오류 칸의 id 도 같이 — 포커스를 거기로 옮긴다 */
  function check(): { errors: Errors; firstId: string | null } {
    const e: Errors = {};
    if (!d.conceptId.trim()) e.conceptId = "개념 id 를 적어 주세요";
    else if (idShapeError) e.conceptId = idShapeError;
    if (!d.name.trim()) e.name = "이름을 적어 주세요";
    if (!d.description.trim()) e.description = "어떤 질문에 쓰는지 한 줄 적어 주세요";
    if (!d.sql.trim()) e.sql = "SQL 을 적어 주세요";
    if (!d.orderBy.trim()) e.orderBy = "정렬할 컬럼을 적어 주세요";
    if (attrKeys.length === 0) e.attrs = "속성을 하나 이상 더해 주세요 — 미리보기를 돌린 뒤 「컬럼을 속성에 채우기」";
    const order: (keyof Errors)[] = ["conceptId", "name", "description", "sql", "orderBy", "attrs"];
    const first = order.find((k) => e[k]);
    const ids: Record<keyof Errors, string> = { conceptId: "c-id", name: "c-name", description: "c-desc", sql: "c-sql", orderBy: "c-order", attrs: "c-new-attr" };
    return { errors: e, firstId: first ? ids[first] : null };
  }

  async function save() {
    if (saving) return;
    const { errors: e, firstId } = check();
    setErrors(e);
    if (firstId) {
      document.getElementById(firstId)?.focus();
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      const input: ExternalConceptInput = {
        ...d,
        conceptId: d.conceptId.trim(),
        name: d.name.trim(),
        description: d.description.trim(),
        synonyms: synonymText.split(",").map((s) => s.trim()).filter(Boolean),
        formula: d.formula?.trim() || null,
        sql: d.sql.trim(),
        orderBy: d.orderBy.trim(),
      };
      const saved = initial ? await updateConcept(workspaceId, initial.id, input) : await createConcept(workspaceId, systemId, input);
      if (saved) await onSaved(saved);
      else setServerError("응답이 없어요. 잠시 뒤 다시 시도해 주세요");
    } catch (e) {
      setServerError(e instanceof ApiRequestError ? e.message : "저장하지 못했어요");
      // 실패해도 포커스가 BODY 로 빠지지 않게 — 저장 버튼에 남긴다
      document.getElementById(`${formId}-save`)?.focus();
    } finally {
      setSaving(false);
    }
  }

  const field = (key: keyof Errors, base = FIELD) => (errors[key] ? FIELD_ERROR : base);
  const optionGroups = groupBySystem(conceptOptions.filter((o) => o.id !== d.conceptId));

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? "개념 수정" : "개념 추가"}
      size="xl"
      footer={
        <div className="flex items-center gap-2">
          {serverError && (
            <p role="alert" className="mr-auto min-w-0 text-[13px] text-red-600">
              {serverError}
            </p>
          )}
          <Button variant="secondary" size="sm" onClick={onClose} className={serverError ? "" : "ml-auto"}>
            닫기
          </Button>
          <Button id={`${formId}-save`} size="sm" type="submit" form={formId} disabled={saving}>
            {saving ? "저장 중…" : "저장"}
          </Button>
        </div>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-4 p-5"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {!initial && (
            <Field id="c-system" label="시스템" required>
              <select id="c-system" value={systemId} onChange={(e) => changeSystem(Number(e.target.value))} className={`${FIELD} cursor-pointer`}>
                {systems.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.kind})
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field
            id="c-id"
            label="개념 id"
            required
            hint={initial ? "다른 개념의 관계가 이 id 로 이어져 있어 바꿀 수 없어요" : "모델이 고르는 값. 영문 소문자 · 숫자 · 밑줄. 예: mes_downtime"}
            error={errors.conceptId ?? idShapeError}
          >
            <input
              id="c-id"
              value={d.conceptId}
              readOnly={!!initial}
              aria-invalid={!!(errors.conceptId ?? idShapeError)}
              onChange={(e) => {
                set({ conceptId: e.target.value });
                setErrors((p) => ({ ...p, conceptId: undefined }));
              }}
              className={`${errors.conceptId || idShapeError ? FIELD_ERROR : FIELD} font-mono ${initial ? "bg-slate-50 text-slate-500" : ""}`}
            />
          </Field>
          <Field id="c-name" label="이름" required error={errors.name}>
            <input id="c-name" value={d.name} aria-invalid={!!errors.name} onChange={(e) => { set({ name: e.target.value }); setErrors((p) => ({ ...p, name: undefined })); }} className={field("name")} />
          </Field>
          <Field id="c-tab" label="권한 탭" required hint="이 탭이 없는 사람에게는 이름조차 보이지 않아요">
            <select id="c-tab" value={d.tab} onChange={(e) => set({ tab: e.target.value })} className={`${FIELD} cursor-pointer`}>
              {TAB_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="c-syn" label="동의어" hint="쉼표로 구분. 사용자가 쓰는 말">
            <input id="c-syn" value={synonymText} onChange={(e) => setSynonymText(e.target.value)} className={FIELD} />
          </Field>
          <div className="sm:col-span-2">
            <Field id="c-desc" label="설명" required hint="어떤 질문에 쓰는지 한 줄. 모델이 개념을 고를 때 읽어요" error={errors.description}>
              <textarea
                id="c-desc"
                rows={2}
                value={d.description}
                aria-invalid={!!errors.description}
                onChange={(e) => { set({ description: e.target.value }); setErrors((p) => ({ ...p, description: undefined })); }}
                className={field("description")}
              />
            </Field>
          </div>
        </div>

        <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">실행 정의</p>
        <Field id="c-sql" label="SQL" required hint="FROM 까지의 SELECT 하나. 서버가 서브쿼리로 감싸 WHERE · ORDER BY · LIMIT 를 붙여요" error={errors.sql}>
          <textarea
            id="c-sql"
            rows={5}
            value={d.sql}
            aria-invalid={!!errors.sql}
            onChange={(e) => { set({ sql: e.target.value }); setErrors((p) => ({ ...p, sql: undefined })); }}
            className={`${field("sql")} font-mono text-[12px]`}
            spellCheck={false}
          />
        </Field>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" type="button" disabled={previewing || !d.sql.trim()} onClick={() => void runPreview()}>
            {previewing ? "실행 중…" : "미리보기 (5행)"}
          </Button>
          {preview && !preview.error && preview.columns.length > 0 && (
            <Button size="sm" variant="ghost" type="button" onClick={fillFromPreview}>
              컬럼 {preview.columns.length}개를 속성에 채우기
            </Button>
          )}
          {preview?.error && <span className="text-[12px] text-red-600">{preview.error}</span>}
          {preview && !preview.error && preview.columns.length === 0 && <span className="text-[12px] text-slate-500">행이 없어요. 컬럼을 알 수 없어요</span>}
        </div>
        {preview && !preview.error && preview.columns.length > 0 && (
          <div className="thin-scroll mt-2 max-h-40 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-left font-mono text-[11px]">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {preview.columns.map((c) => (
                    <th key={c} className="whitespace-nowrap px-2 py-1 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-slate-600">
                {preview.rows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    {preview.columns.map((c) => (
                      <td key={c} className="max-w-[160px] truncate whitespace-nowrap px-2 py-1">
                        {r[c] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="c-order" label="정렬" required hint="출력 컬럼 이름으로. 예: started_at desc, id desc" error={errors.orderBy}>
            <input
              id="c-order"
              value={d.orderBy}
              aria-invalid={!!errors.orderBy}
              onChange={(e) => { set({ orderBy: e.target.value }); setErrors((p) => ({ ...p, orderBy: undefined })); }}
              className={`${field("orderBy")} font-mono`}
            />
          </Field>
          <Field id="c-formula" label="계산식" hint="파생값이면 사람이 읽는 식">
            <input id="c-formula" value={d.formula ?? ""} onChange={(e) => set({ formula: e.target.value })} className={FIELD} />
          </Field>
        </div>

        <p className="mb-1 mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
          속성 {attrKeys.length} <span className="font-normal normal-case tracking-normal text-slate-400">— 컬럼 이름 · 모델에게 보일 라벨 · 조건으로 쓰기 · 가리키는 개념</span>
        </p>
        <div className={`rounded-lg border ${errors.attrs ? "border-red-300" : "border-slate-200"}`}>
          {attrKeys.length === 0 ? (
            <p className="px-3 py-3 text-[12px] text-slate-500">미리보기를 돌린 뒤 「컬럼을 속성에 채우기」를 누르거나 아래에서 직접 더해요.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {attrKeys.map((k) => {
                const rel = d.relations.find((r) => r.attr === k)?.to ?? "";
                return (
                  <li key={k} className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_auto_minmax(0,1.2fr)_32px] items-center gap-2 px-2 py-1.5 text-[12px]">
                    <span className="truncate font-mono text-slate-900">{k}</span>
                    <input value={d.attrs[k]} onChange={(e) => setAttr(k, e.target.value)} placeholder="라벨" aria-label={`${k} 라벨`} className={FIELD_SM} />
                    <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-[12px] text-slate-600">
                      <input type="checkbox" checked={d.filterColumns.includes(k)} onChange={() => toggleFilter(k)} className="accent-slate-900" />
                      조건으로 쓰기
                    </label>
                    <select value={rel} onChange={(e) => setRelation(k, e.target.value)} aria-label={`${k} 가 가리키는 개념`} className={`${FIELD_SM} cursor-pointer`}>
                      <option value="">—</option>
                      {optionGroups.map(([system, list]) => (
                        <optgroup key={system} label={system}>
                          {list.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name} ({o.id})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeAttr(k)}
                      aria-label={`${k} 삭제`}
                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                    >
                      <IconX size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <NewAttrRow
            onAdd={(k) => {
              if (!(k in d.attrs)) setAttr(k, "");
              setErrors((p) => ({ ...p, attrs: undefined }));
            }}
          />
        </div>
        {errors.attrs && (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {errors.attrs}
          </p>
        )}
      </form>
    </Modal>
  );
}

function groupBySystem(options: ConceptOption[]): [string, ConceptOption[]][] {
  const map = new Map<string, ConceptOption[]>();
  for (const o of options) map.set(o.system, [...(map.get(o.system) ?? []), o]);
  return [...map.entries()];
}

function NewAttrRow({ onAdd }: { onAdd: (key: string) => void }) {
  const [v, setV] = useState("");
  const ok = /^[a-z_][a-z0-9_]*$/.test(v);
  return (
    <div className="flex items-center gap-2 border-t border-slate-100 px-2 py-1.5">
      <input
        id="c-new-attr"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          // 폼 안이라 Enter 가 저장으로 가지 않게 여기서 먹는다
          if (e.key === "Enter") {
            e.preventDefault();
            if (ok) {
              onAdd(v);
              setV("");
            }
          }
        }}
        placeholder="컬럼 이름 직접 추가"
        aria-label="컬럼 이름 직접 추가"
        className={`${FIELD_SM} max-w-[220px] font-mono`}
      />
      <Button size="sm" variant="ghost" type="button" disabled={!ok} onClick={() => { onAdd(v); setV(""); }}>
        추가
      </Button>
    </div>
  );
}
