"use client";

import { useEffect, useMemo, useState } from "react";
import { Field } from "@/components/admin/form-parts";
import { Modal } from "@/components/modal";
import { Button, FIELD } from "@/components/ui";
import { MODULES } from "@/data/modules";
import { ApiRequestError } from "@/lib/api";
import { draftConcepts, introspectSystem, type ExternalSystemAdminDto, type IntrospectionDto } from "@/lib/admin-api";

const TAB_OPTIONS = MODULES.flatMap((m) => m.subfunctions.map((s) => ({ value: s.id, label: `${m.name} · ${s.name}` })));

/** 시스템 종류(MES · ERP …)와 같은 externalSystem 을 가진 모듈의 첫 탭. 없으면 첫 탭 */
function defaultTab(kind: string | undefined): string {
  const m = kind ? MODULES.find((x) => x.externalSystem === kind) : undefined;
  return m?.subfunctions[0]?.id ?? TAB_OPTIONS[0]?.value ?? "";
}

/**
 * 「DB 에서 초안 만들기」 — 외부 DB 의 표를 읽어 고른 표를 개념 초안으로 넣는다.
 *
 * 구조(속성 · 관계)는 규칙으로 맞게 나오고 말(이름 · 설명)은 컬럼 이름 그대로다. 넣은 뒤 스튜디오에서 다듬는다.
 * 이미 있는 개념 id 는 서버가 건너뛴다.
 */
export function DraftModal({
  workspaceId,
  systems,
  existingIds,
  onClose,
  onDone,
}: {
  workspaceId: number;
  systems: ExternalSystemAdminDto[];
  existingIds: string[];
  onClose: () => void;
  onDone: (added: number) => Promise<void>;
}) {
  const [systemId, setSystemId] = useState(systems[0]?.id ?? 0);
  const [schema, setSchema] = useState<string | undefined>(undefined);
  /** 읽은 구조와 그때의 요청 키. 키가 지금 요청과 다르면 아직 읽는 중이다 — effect 안에서 setState 를 따로 부르지 않으려고 */
  const [loaded, setLoaded] = useState<{ key: string; info: IntrospectionDto; failure: string | null } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
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
        setPicked(new Set(r.tables.filter((t) => !t.view).map((t) => t.name)));
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setLoaded({ key, info: { schemas: [], schema: null, tables: [], error: null }, failure: e instanceof ApiRequestError ? e.message : "구조를 읽지 못했어요" });
      });
    return () => {
      alive = false;
    };
  }, [workspaceId, systemId, schema]);

  const willAdd = useMemo(() => {
    const ids = [...picked].map((t) => `${prefix}${t.toLowerCase().replace(/[^a-z0-9_]/g, "_")}`);
    return { total: ids.length, skipped: ids.filter((id) => existingIds.includes(id)).length };
  }, [picked, prefix, existingIds]);

  function toggle(name: string) {
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });
  }

  async function run() {
    if (!info?.schema) return;
    setSaving(true);
    setRunError(null);
    try {
      const added = await draftConcepts(workspaceId, systemId, { schema: info.schema, tables: [...picked], prefix, tab });
      await onDone(added);
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
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button disabled={saving || loading || picked.size === 0 || !info?.schema} onClick={() => void run()}>
            {saving ? "넣는 중…" : `초안 ${willAdd.total - willAdd.skipped}개 넣기`}
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
          표 {info?.tables.length ?? 0} · 고른 것 {picked.size}
          {willAdd.skipped > 0 && <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">이미 있는 {willAdd.skipped}개는 건너뛰어요</span>}
        </p>
        {info && info.tables.length > 0 && (
          <span className="flex gap-2 text-[12px]">
            <button type="button" className="text-slate-600 hover:text-slate-900" onClick={() => setPicked(new Set(info.tables.map((t) => t.name)))}>
              전부
            </button>
            <button type="button" className="text-slate-600 hover:text-slate-900" onClick={() => setPicked(new Set(info.tables.filter((t) => !t.view).map((t) => t.name)))}>
              표만
            </button>
            <button type="button" className="text-slate-600 hover:text-slate-900" onClick={() => setPicked(new Set())}>
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
            const id = `${prefix}${t.name.toLowerCase().replace(/[^a-z0-9_]/g, "_")}`;
            const exists = existingIds.includes(id);
            return (
              <li key={t.name} className={`flex items-start gap-3 px-3 py-2 ${exists ? "opacity-55" : ""}`}>
                <input type="checkbox" id={`d-t-${t.name}`} checked={picked.has(t.name)} onChange={() => toggle(t.name)} className="mt-1" />
                <label htmlFor={`d-t-${t.name}`} className="min-w-0 flex-1 cursor-pointer">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[13px] text-slate-900">{t.name}</span>
                    {t.view && <span className="rounded border border-slate-200 px-1 font-mono text-[10px] text-slate-500">view</span>}
                    {exists && <span className="text-[11px] text-slate-500">이미 {id}</span>}
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
