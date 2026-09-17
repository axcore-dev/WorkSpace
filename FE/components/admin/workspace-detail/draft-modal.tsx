"use client";

import { useEffect, useMemo, useState } from "react";
import { Field } from "@/components/admin/form-parts";
import { Modal } from "@/components/modal";
import { Button, FIELD } from "@/components/ui";
import { ApiRequestError } from "@/lib/api";
import { draftConcepts, introspectSystem, type ExternalConceptAdminDto, type ExternalSystemAdminDto, type IntrospectionDto } from "@/lib/admin-api";
import { conceptsByTable } from "@/lib/concept-sql";
import { TAB_OPTIONS, defaultTab } from "./concept-form";

/**
 * 「DB 에서 초안 만들기」 — 외부 DB 의 표를 읽어 고른 표를 개념 초안으로 넣는다.
 *
 * 구조(속성 · 관계)는 규칙으로 맞게 나오고 말(이름 · 설명)은 컬럼 이름 그대로다. 넣은 뒤 스튜디오에서 다듬는다.
 * 이미 있는 개념 id 는 서버가 건너뛴다. 같은 표를 읽는 개념이 이미 있으면(템플릿이 먼저 넣은 경우) 표시하고 기본 체크를 푼다(#116 1번).
 */
export function DraftModal({
  workspaceId,
  systems,
  existing,
  onClose,
  onDone,
}: {
  workspaceId: number;
  systems: ExternalSystemAdminDto[];
  /** 지금 있는 외부 개념 전부 — id · 표 겹침 판정 */
  existing: ExternalConceptAdminDto[];
  onClose: () => void;
  /** 넣은 수와 행 id. id 는 「되돌리기」 가 지운다 */
  onDone: (added: number, ids: number[]) => Promise<void>;
}) {
  const existingIds = useMemo(() => existing.map((c) => c.conceptId), [existing]);
  const [systemId, setSystemId] = useState(systems[0]?.id ?? 0);
  const [schema, setSchema] = useState<string | undefined>(undefined);
  /** 읽은 구조와 그때의 요청 키. 키가 지금 요청과 다르면 아직 읽는 중이다 — effect 안에서 setState 를 따로 부르지 않으려고 */
  const [loaded, setLoaded] = useState<{ key: string; info: IntrospectionDto; failure: string | null } | null>(null);
  /** 사용자가 손댄 체크. 없는 표는 판정의 기본값(표는 켜짐 · 뷰 · 같은 id · 같은 표는 꺼짐)을 따른다 */
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  /** 사용자가 손댄 접두어. null 이면 시스템 종류에서 만든 기본값(mes_)을 쓴다 */
  const [prefixInput, setPrefixInput] = useState<string | null>(null);
  /** 사용자가 고른 탭. null 이면 시스템 종류에 맞는 모듈(MES → 생산관리)의 첫 탭 */
  const [tabInput, setTabInput] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const system = systems.find((s) => s.id === systemId);
  const requestKey = `${systemId}:${schema ?? ""}`;
  const loading = systemId !== 0 && loaded?.key !== requestKey;
  const info = loaded?.key === requestKey ? loaded.info : null;
  const error = runError ?? (loaded?.key === requestKey ? (loaded.failure ?? loaded.info.error) : null);
  const tab = tabInput ?? defaultTab(system?.kind);
  const setTab = (v: string) => setTabInput(v);
  const prefix = prefixInput ?? (system ? `${system.kind.toLowerCase().replace(/[^a-z0-9]/g, "")}_` : "");
  const setPrefix = (v: string) => setPrefixInput(v);

  // 시스템 · 스키마가 바뀌면 구조를 다시 읽는다. 뷰는 기본으로 빼 둔다 — 대개 표가 개념이고 뷰는 파생값이라 사람이 고른다
  useEffect(() => {
    if (!systemId) return;
    let alive = true;
    const key = `${systemId}:${schema ?? ""}`;
    introspectSystem(workspaceId, systemId, schema)
      .then((r) => {
        if (!alive) return;
        setLoaded({ key, info: r, failure: null });
        setOverrides({});
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setLoaded({ key, info: { schemas: [], schema: null, tables: [], error: null }, failure: e instanceof ApiRequestError ? e.message : "구조를 읽지 못했어요" });
      });
    return () => {
      alive = false;
    };
  }, [workspaceId, systemId, schema]);

  /** 같은 시스템에서 같은 표를 이미 읽는 개념 — 「같은 표를 읽는 개념이 있어요: 불량 기록 (mes_defect)」 */
  const byTable = useMemo(() => conceptsByTable(existing.filter((c) => c.systemId === systemId)), [existing, systemId]);
  const idOf = (table: string) => `${prefix}${table.toLowerCase().replace(/[^a-z0-9_]/g, "_")}`;
  type Status = { kind: "new" } | { kind: "same-id"; id: string } | { kind: "same-table"; other: { conceptId: string; name: string } };
  const statusOf = (t: { name: string; schema: string }): Status => {
    const id = idOf(t.name);
    if (existingIds.includes(id)) return { kind: "same-id", id };
    const twin = byTable.get(`${t.schema.toLowerCase()}.${t.name.toLowerCase()}`)?.[0];
    return twin ? { kind: "same-table", other: { conceptId: twin.conceptId, name: twin.name } } : { kind: "new" };
  };
  const isOn = (t: { name: string; schema: string; view: boolean }) => {
    const s = statusOf(t);
    if (s.kind === "same-id") return false;
    return overrides[t.name] ?? (!t.view && s.kind === "new");
  };
  const chosen = (info?.tables ?? []).filter(isOn).map((t) => t.name);
  const sameIdCount = (info?.tables ?? []).filter((t) => statusOf(t).kind === "same-id").length;

  const toggle = (name: string, on: boolean) => setOverrides((p) => ({ ...p, [name]: on }));
  const setAll = (pick: (t: { name: string; view: boolean }) => boolean) =>
    setOverrides(Object.fromEntries((info?.tables ?? []).map((t) => [t.name, pick(t)])));

  async function run() {
    if (!info?.schema || saving || chosen.length === 0) return;
    setSaving(true);
    setRunError(null);
    try {
      const r = await draftConcepts(workspaceId, systemId, { schema: info.schema, tables: chosen, prefix, tab });
      await onDone(r.added, r.ids);
    } catch (e) {
      setRunError(e instanceof ApiRequestError ? e.message : "초안을 넣지 못했어요");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="DB 에서 초안 만들기"
      desc="외부 DB 의 표 · 컬럼 · 키만 읽어 개념 초안을 넣어요. 데이터는 읽지 않아요. 넣은 뒤 이름 · 설명을 다듬어 주세요."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            닫기
          </Button>
          <Button disabled={saving || loading || chosen.length === 0 || !info?.schema} onClick={() => void run()}>
            {saving ? "넣는 중…" : `초안 ${chosen.length}개 넣기`}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field id="d-system" label="시스템">
          <select id="d-system" value={systemId} onChange={(e) => { setSystemId(Number(e.target.value)); setSchema(undefined); }} className={`${FIELD} cursor-pointer`}>
            {systems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.kind})
              </option>
            ))}
          </select>
        </Field>
        <Field id="d-schema" label="스키마">
          <select id="d-schema" value={info?.schema ?? ""} onChange={(e) => setSchema(e.target.value)} disabled={loading || !info?.schemas.length} className={`${FIELD} cursor-pointer`}>
            {(info?.schemas ?? []).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field id="d-prefix" label="개념 id 접두어" hint="예: mes_ → mes_downtime_events">
          <input id="d-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} className={`${FIELD} font-mono`} />
        </Field>
        <div className="sm:col-span-3">
          <Field id="d-tab" label="권한 탭 (초안 전부)" hint="넣은 뒤 개념마다 바꿀 수 있어요">
            <select id="d-tab" value={tab} onChange={(e) => setTab(e.target.value)} className={`${FIELD} cursor-pointer`}>
              {TAB_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          표 {info?.tables.length ?? 0} · 고른 것 {chosen.length}
          {sameIdCount > 0 && <span className="ml-2 font-normal normal-case tracking-normal text-slate-500">같은 id 가 있는 {sameIdCount}개는 건너뛰어요</span>}
        </p>
        {info && info.tables.length > 0 && (
          <span className="flex gap-2 text-[12px]">
            <button type="button" className="cursor-pointer text-slate-600 hover:text-slate-900" onClick={() => setAll(() => true)}>
              전부
            </button>
            <button type="button" className="cursor-pointer text-slate-600 hover:text-slate-900" onClick={() => setAll((t) => !t.view)}>
              표만
            </button>
            <button type="button" className="cursor-pointer text-slate-600 hover:text-slate-900" onClick={() => setAll(() => false)}>
              없음
            </button>
          </span>
        )}
      </div>

      {error && <p className="mt-2 text-[13px] text-red-600">{error}</p>}
      {loading ? (
        <p className="mt-3 text-sm text-slate-500">구조를 읽는 중…</p>
      ) : (
        <ul className="thin-scroll mt-2 max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
          {(info?.tables ?? []).map((t) => {
            const s = statusOf(t);
            const on = isOn(t);
            return (
              <li key={t.name} className={`flex items-start gap-3 px-3 py-2 ${s.kind === "same-id" ? "opacity-55" : ""}`}>
                <input
                  type="checkbox"
                  id={`d-t-${t.name}`}
                  checked={on}
                  disabled={s.kind === "same-id"}
                  onChange={() => toggle(t.name, !on)}
                  className="mt-1 accent-slate-900"
                />
                <label htmlFor={`d-t-${t.name}`} className="min-w-0 flex-1 cursor-pointer">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[13px] text-slate-900">{t.name}</span>
                    {t.view && <span className="rounded border border-slate-200 px-1 font-mono text-[11px] text-slate-500">view</span>}
                    <span className="font-mono text-[11px] text-slate-500">→ {idOf(t.name)}</span>
                    {s.kind === "same-id" && <span className="text-[11px] text-amber-700">같은 id 가 있어요 — 건너뛰어요</span>}
                    {s.kind === "same-table" && (
                      <span className="text-[11px] text-amber-700">
                        같은 표를 읽는 개념이 있어요: {s.other.name} ({s.other.conceptId})
                      </span>
                    )}
                  </span>
                  <span className="block text-[12px] text-slate-500">
                    {t.comment ? `${t.comment} · ` : ""}컬럼 {t.columns.length}
                    {t.primaryKey.length > 0 && ` · PK ${t.primaryKey.join(", ")}`}
                    {t.foreignKeys.length > 0 && ` · FK ${t.foreignKeys.map((f) => `${f.column}→${f.refTable}`).join(", ")}`}
                    {t.approxRows > 0 && ` · 약 ${t.approxRows.toLocaleString()}행`}
                  </span>
                </label>
              </li>
            );
          })}
          {info && info.tables.length === 0 && !error && <li className="px-3 py-4 text-sm text-slate-500">이 스키마에 표가 없어요.</li>}
        </ul>
      )}
    </Modal>
  );
}
