"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/modal";
import { Button, ProgressBar } from "@/components/ui";
import { createConcept, deleteConcept, updateConcept, type ExternalConceptInput } from "@/lib/admin-api";
import { DRAFT_MARK, type RefineItem } from "@/lib/ai/refine-types";
import { clearRefine, startRefine, useRefineJobFor, type RefineTarget } from "@/lib/admin/refine-job";
import { ApiRequestError } from "@/lib/api";

/**
 * 「AI 로 다듬기」 검토 패널 — 통계 · 모델이 낸 제안을 필드마다 지금 값 · 제안 값으로 놓고, 체크한 것만 저장한다.
 *
 * 세 단계: 안내(값 표본 전송 · 구조만 모드) → 진행(표마다) → 검토. 저장은 개념마다 기존 `updateConcept` 한 번, 집계 개념은
 * `createConcept`, 표를 버리기로 하면 `deleteConcept`. 저장한 개념은 설명 끝의 초안 표시가 빠진다 — 그것이 「검토 완료」.
 *
 * 기본 체크: 이름 · 설명 · 라벨 · 동의어 · 필터 · 정렬은 켜짐, 관계는 값 겹침 근거가 있으면 켜짐, 집계 추가 · 표 삭제는 꺼짐.
 *
 * 저장 오류는 토스트가 아니라 이 모달 바닥에 보인다 — 토스트와 모달이 같은 층이라 모달 뒤에 깔린다(#116 3번). 개념 여러 개를 차례로
 * 저장하다 중간에 실패하면 이미 저장된 개념은 `done` 에 남겨, 다시 누를 때 건너뛴다(집계 개념을 두 번 만들거나 지운 표를 또 지우지 않게).
 */
export function RefinePanel({
  workspaceId,
  targets,
  onClose,
  onApplied,
}: {
  workspaceId: number;
  /** 다듬을 개념들 — 행 id · 이름. 작업이 이미 돌고 있거나 끝나 있으면 그 작업의 대상이 우선이다 */
  targets: RefineTarget[];
  onClose: () => void;
  /** 저장이 끝났을 때. 바꾼 개념 수 · 새로 만든 수 · 지운 수 (다시 시도한 것까지 누적) */
  onApplied: (n: { updated: number; created: number; deleted: number }) => Promise<void>;
}) {
  /** 작업은 모달 밖(`lib/admin/refine-job`)에 있다. 이 모달은 그것을 보여 주고, 끝난 결과를 검토해 저장할 뿐이다 */
  const job = useRefineJobFor(workspaceId);
  const [applying, setApplying] = useState(false);
  const [structureOnly, setStructureOnly] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  /** 저장 실패 — 모달 바닥 한 줄. 어느 개념에서 막혔고 그 전까지 몇 개가 저장됐는지 */
  const [applyError, setApplyError] = useState<string | null>(null);
  /** 체크 상태. 키는 rowId:필드. 어느 작업의 체크인지 checkedFor 로 묶는다 */
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const checkedFor = useRef<number | null>(null);
  /** 이미 저장이 끝난 개념(행 id)과 누적 개수 — 실패 뒤 다시 누르면 이어서 간다 */
  const done = useRef<{ rows: Set<number>; updatedRows: Set<number>; updated: number; created: number; deleted: number }>({
    rows: new Set(),
    updatedRows: new Set(),
    updated: 0,
    created: 0,
    deleted: 0,
  });

  const items = job?.status === "done" ? job.items : [];
  // 작업이 끝나는 순간(또는 끝난 작업을 다시 열었을 때) 기본 체크를 한 번 채운다
  useEffect(() => {
    if (job?.status === "done" && checkedFor.current !== job.id) {
      checkedFor.current = job.id;
      setChecked(defaultChecks(job.items));
      done.current = { rows: new Set(), updatedRows: new Set(), updated: 0, created: 0, deleted: 0 };
      setApplyError(null);
    }
  }, [job]);

  function run() {
    setRunError(null);
    if (!startRefine(workspaceId, targets, structureOnly)) setRunError("다른 다듬기가 아직 돌고 있어요. 끝나면 다시 눌러 주세요");
  }

  const toggle = (key: string) => setChecked((p) => ({ ...p, [key]: !p[key] }));
  const on = (key: string) => checked[key] === true;
  const checkedCount = Object.values(checked).filter(Boolean).length;

  async function apply() {
    setApplying(true);
    setApplyError(null);
    const d = done.current;
    let failedAt: Extract<RefineItem, { ok: true }> | null = null;
    try {
      for (const it of items) {
        if (!it.ok || d.rows.has(it.conceptRowId)) continue;
        failedAt = it;
        const k = (f: string) => `${it.conceptRowId}:${f}`;
        if (on(k("skip"))) {
          await deleteConcept(workspaceId, it.conceptRowId);
          d.deleted++;
          d.rows.add(it.conceptRowId);
          continue;
        }
        const input = buildInput(it, on);
        if (input && !d.updatedRows.has(it.conceptRowId)) {
          await updateConcept(workspaceId, it.conceptRowId, input);
          d.updated++;
          d.updatedRows.add(it.conceptRowId);
        }
        for (const a of it.proposal.aggregates) {
          if (!on(k(`agg.${a.id}`))) continue;
          const attrs: Record<string, string> = {};
          for (const c of a.columns) attrs[c] = c;
          await createConcept(workspaceId, it.current.systemId, {
            conceptId: a.id,
            name: a.name,
            synonyms: [],
            tab: it.current.tab,
            description: a.description,
            attrs,
            relations: [],
            formula: null,
            sql: a.sql,
            filterColumns: [],
            orderBy: a.columns[0],
            sortOrder: it.current.sortOrder + 1,
          });
          d.created++;
          // 집계 하나가 만들어진 뒤 다음 것이 실패하면, 다시 누를 때 이 집계는 건너뛴다 — 체크를 풀어 둔다
          setChecked((p) => ({ ...p, [k(`agg.${a.id}`)]: false }));
        }
        d.rows.add(it.conceptRowId);
      }
      clearRefine();
      await onApplied({ updated: d.updated, created: d.created, deleted: d.deleted });
    } catch (e) {
      const why = e instanceof ApiRequestError ? e.message : "저장하지 못했어요";
      const savedSoFar = d.updated + d.created + d.deleted;
      setApplyError(`${failedAt?.conceptId ?? "개념"} 저장에서 막혔어요 — ${why}${savedSoFar > 0 ? ` · 그 전까지 ${savedSoFar}건은 저장됐어요. 다시 누르면 이어서 해요` : ""}`);
    } finally {
      setApplying(false);
    }
  }

  const title = "AI 로 다듬기";
  const okItems = items.filter((i) => i.ok);
  const running = job?.status === "running";
  const shown = job ? job.targets : targets;

  if (job?.status !== "done") {
    const pct = job && shown.length ? (job.done / shown.length) * 100 : 0;
    return (
      <Modal
        open
        onClose={onClose}
        title={title}
        desc={
          running
            ? "닫아도 계속 돌아요. 끝나면 온톨로지 헤더의 버튼과 왼쪽 메뉴 아래 표시가 「완료」 로 바뀌어요."
            : `개념 ${shown.length}개의 이름 · 동의어 · 설명 · 라벨 · 필터 · 관계를 제안받아요. 제안은 검토하고 체크한 것만 저장돼요.`
        }
        size="lg"
        footer={
          <div className="flex items-center gap-2">
            {running && <span className="mr-auto text-[13px] text-slate-500">개념마다 30초 안팎 · 3개씩 같이 가요</span>}
            <Button variant="secondary" onClick={onClose}>
              {running ? "닫기" : "취소"}
            </Button>
            {!running && <Button onClick={run}>제안 받기</Button>}
          </div>
        }
      >
        <div className="space-y-5 px-5 py-5">
          {running && job ? (
            <section role="status" aria-live="polite" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="spinner" aria-hidden />
                <p className="text-[15px] font-semibold text-slate-900">
                  {job.done} / {shown.length} 다듬는 중
                </p>
                <span className="ml-auto text-[13px] tabular-nums text-slate-500">{Math.round(pct)}%</span>
              </div>
              <ProgressBar value={pct} className="mt-3 h-2" />
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {job.current.length ? (
                  <>
                    지금:{" "}
                    {job.current.map((n, i) => (
                      <span key={`${i}-${n}`} className="mr-1.5 inline-block rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[13px] text-slate-700">
                        {n}
                      </span>
                    ))}
                  </>
                ) : (
                  "정리하는 중…"
                )}
              </p>
            </section>
          ) : (
            <section className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-relaxed text-slate-700">
              <p className="text-[15px] font-semibold text-slate-900">고객 데이터가 어디까지 나가나요</p>
              <p className="mt-2">
                표마다 앞 2,000행을 읽어 BE 메모리에서 통계만 내고 버려요. AI 모델로 나가는 값은{" "}
                <b className="font-semibold text-slate-900">고유값이 30개 이하인 컬럼의 값 목록</b>(상태 · 종류 · 코드)과{" "}
                <b className="font-semibold text-slate-900">숫자 · 날짜 컬럼의 최솟값 · 최댓값</b>이에요.
              </p>
              <p className="mt-2">
                거래처명처럼 고유값이 많은 컬럼은 길이와 모양만 나가고, 사람 이름 · 급여 · 이메일 · 전화 · 주민번호 · 비밀번호로 보이는 컬럼은
                아무것도 나가지 않아요.
              </p>
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
                <input type="checkbox" id="refine-structure-only" checked={structureOnly} onChange={(e) => setStructureOnly(e.target.checked)} className="mt-1" />
                <span>
                  <span className="font-semibold text-slate-900">구조만 보내기</span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-slate-500">
                    값을 한 개도 보내지 않아요. 컬럼 이름 · 타입 · 주석 · 모양만으로 제안해서 라벨의 괄호(재직 · 휴직 · 퇴직) 같은 건 못 채워요.
                  </span>
                </span>
              </label>
            </section>
          )}

          <section>
            <p className="mb-2 text-[13px] font-semibold text-slate-500">다듬을 개념 {shown.length}개</p>
            <ul className="thin-scroll max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
              {shown.map((t) => {
                const isDone = job?.doneIds.includes(t.rowId) ?? false;
                const isNow = job?.current.includes(t.name) ?? false;
                return (
                  <li key={t.rowId} className={`flex items-center gap-3 px-4 py-2 text-sm ${isDone ? "text-slate-400" : "text-slate-700"}`}>
                    <span className="w-4 shrink-0 text-center text-[13px]" aria-hidden>
                      {isDone ? "✓" : isNow ? "·" : ""}
                    </span>
                    <span className={`truncate ${isNow ? "font-semibold text-slate-900" : ""}`}>{t.name}</span>
                    <span className="ml-auto shrink-0 font-mono text-[12px] text-slate-400">{t.conceptId}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          {runError && (
            <p role="alert" className="text-sm text-red-600">
              {runError}
            </p>
          )}
        </div>
      </Modal>
    );
  }

  const dismiss = () => {
    // 저장 없이 닫는다 — 검토를 버리는 것이라 작업도 비운다. 다시 누르면 처음부터 제안을 받는다
    clearRefine();
    onClose();
  };

  return (
    <Modal
      open
      onClose={dismiss}
      title={title}
      desc="지금 값과 제안 값을 나란히 놓았어요. 체크한 것만 저장돼요. 집계 개념 추가와 표 삭제는 직접 켜야 해요."
      size="xl"
      footer={
        <div className="flex items-center gap-2">
          {applyError ? (
            <p role="alert" className="mr-auto min-w-0 text-[13px] text-red-600">
              {applyError}
            </p>
          ) : (
            <span className="mr-auto text-[13px] text-slate-500">체크 {checkedCount}개</span>
          )}
          <Button variant="secondary" onClick={dismiss} disabled={applying}>
            {applyError ? "닫기" : "건너뛰기"}
          </Button>
          <Button onClick={() => void apply()} disabled={applying || checkedCount === 0}>
            {applying ? "저장 중…" : applyError ? "이어서 저장" : "체크한 것 저장"}
          </Button>
        </div>
      }
    >
      <div className="thin-scroll max-h-[70vh] space-y-5 overflow-y-auto px-5 py-5">
        {items.map((it) =>
          it.ok ? <ItemCard key={it.conceptRowId} item={it} on={on} toggle={toggle} /> : (
            <div key={it.conceptRowId} className="rounded-xl border border-slate-200 px-5 py-3 text-sm leading-relaxed">
              <span className="font-mono text-slate-900">{shown.find((t) => t.rowId === it.conceptRowId)?.conceptId ?? it.conceptRowId}</span>
              <span className="ml-2 text-red-600">{it.error}</span>
            </div>
          ),
        )}
        {okItems.length === 0 && <p className="py-6 text-center text-sm text-slate-500">제안을 받은 개념이 없어요. 다시 시도해 주세요.</p>}
      </div>
    </Modal>
  );
}

/* ─────────────────────────── 개념 하나 ─────────────────────────── */

function ItemCard({ item, on, toggle }: { item: Extract<RefineItem, { ok: true }>; on: (k: string) => boolean; toggle: (k: string) => void }) {
  const { current: cur, proposal: p, rules } = item;
  const k = (f: string) => `${item.conceptRowId}:${f}`;
  const curDesc = cur.description.replace(DRAFT_MARK, "");
  const filterAdd = p.filterColumns.filter((c) => !cur.filterColumns.includes(c));
  const filterRemove = cur.filterColumns.filter((c) => !p.filterColumns.includes(c));
  const rows: { key: string; field: string; before: React.ReactNode; after: React.ReactNode }[] = [];

  if (p.name && p.name !== cur.name) rows.push({ key: "name", field: "이름", before: cur.name, after: p.name });
  if (p.synonyms.length && p.synonyms.join("|") !== cur.synonyms.join("|")) rows.push({ key: "synonyms", field: "동의어", before: cur.synonyms.join(" · ") || "—", after: p.synonyms.join(" · ") });
  if (p.description && p.description !== curDesc) rows.push({ key: "description", field: "설명", before: curDesc, after: p.description });
  for (const [col, label] of Object.entries(p.attrs)) rows.push({ key: `attr.${col}`, field: `라벨 ${col}`, before: cur.attrs[col], after: label });
  for (const c of filterAdd) rows.push({ key: `filter+.${c}`, field: "필터 추가", before: "—", after: <>{c} <Hint text={rules.reason[c]} /></> });
  for (const c of filterRemove) rows.push({ key: `filter-.${c}`, field: "필터 제거", before: c, after: <>— <Hint text="사실상 유일값" /></> });
  for (const r of p.relations) rows.push({ key: `rel.${r.attr}`, field: "관계", before: "—", after: <>{r.attr} → {r.to} <Hint text={r.overlap !== null ? `값 겹침 ${Math.round(r.overlap * 100)}%` : "모델 추정"} /></> });
  if (p.orderBy && p.orderBy !== cur.orderBy) rows.push({ key: "orderBy", field: "정렬", before: cur.orderBy, after: p.orderBy });
  for (const a of p.aggregates) rows.push({ key: `agg.${a.id}`, field: "집계 추가", before: "—", after: <>{a.id} · {a.name} <Hint text={`미리보기 통과 · 컬럼 ${a.columns.length}`} /><span className="mt-1 block font-mono text-[12px] leading-relaxed text-slate-500">{a.sql}</span></> });
  // 같은 표를 읽는 쌍둥이(템플릿 + DB 초안)가 있으면 둘 중 하나는 지워야 한다 — 「표 삭제」 를 꺼진 채로 내놓는다
  const twins = item.duplicates.map((d) => `${d.name} (${d.id})`).join(" · ");
  if (!p.keep || rules.skip || item.duplicates.length > 0) {
    const why = p.keepReason || rules.skipReason || (twins ? `같은 표를 읽는 개념이 있어요: ${twins}` : "");
    rows.push({ key: "skip", field: "표 삭제", before: cur.conceptId, after: <>이 개념을 지운다 <Hint text={why} /></> });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-slate-100 px-5 py-3">
        <span className="text-[15px] font-semibold text-slate-900">{p.name || cur.name}</span>
        <span className="font-mono text-[12px] text-slate-500">{cur.conceptId}</span>
        <span className="ml-auto text-[13px] text-slate-500">
          제안 {rows.length}
          {item.dropped.length > 0 && <span title={item.dropped.join("\n")}> · 버린 것 {item.dropped.length}</span>}
        </span>
      </header>
      {item.duplicates.length > 0 && (
        <p className="border-b border-slate-100 bg-amber-50 px-5 py-2.5 text-[13px] leading-relaxed text-amber-700">
          같은 표를 읽는 개념이 또 있어요: <span className="font-medium">{twins}</span>. AI 가 둘 중 어느 쪽을 고를지 흔들리니 한쪽은 지워 주세요 — 아래 「표 삭제」 를 켜거나 스튜디오에서
          다른 쪽을 지우면 돼요.
        </p>
      )}
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">바꿀 제안이 없어요 — 지금 값이 그대로 좋아요.</p>
      ) : (
        <ul>
          <li className="grid grid-cols-[20px_112px_1fr_1fr] gap-x-4 px-5 py-2 text-[12px] font-semibold uppercase tracking-wider text-slate-400">
            <span />
            <span>필드</span>
            <span>지금</span>
            <span>제안</span>
          </li>
          {rows.map((r) => {
            const id = `rf-${item.conceptRowId}-${r.key}`;
            return (
              <li key={r.key} className="grid grid-cols-[20px_112px_1fr_1fr] items-start gap-x-4 border-t border-slate-100 px-5 py-2.5 text-sm leading-relaxed">
                <input type="checkbox" id={id} checked={on(k(r.key))} onChange={() => toggle(k(r.key))} className="mt-1" />
                <label htmlFor={id} className="cursor-pointer pt-0.5 font-mono text-[12px] text-slate-600">
                  {r.field}
                </label>
                <span className="min-w-0 break-words text-slate-400 line-through decoration-slate-300">{r.before}</span>
                <label htmlFor={id} className="min-w-0 cursor-pointer break-words text-slate-900">
                  {r.after}
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Hint({ text }: { text: string | undefined }) {
  return text ? <span className="text-[12px] text-slate-500">({text})</span> : null;
}

/** 기본 체크 규칙 — 말 · 라벨 · 필터 · 정렬은 켜짐, 관계는 값 겹침 근거가 있을 때만, 집계 추가 · 표 삭제는 꺼짐 */
function defaultChecks(items: RefineItem[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const it of items) {
    if (!it.ok) continue;
    const { current: cur, proposal: p } = it;
    const k = (f: string) => `${it.conceptRowId}:${f}`;
    if (p.name && p.name !== cur.name) out[k("name")] = true;
    if (p.synonyms.length) out[k("synonyms")] = true;
    if (p.description && p.description !== cur.description.replace(DRAFT_MARK, "")) out[k("description")] = true;
    for (const col of Object.keys(p.attrs)) out[k(`attr.${col}`)] = true;
    for (const c of p.filterColumns) if (!cur.filterColumns.includes(c)) out[k(`filter+.${c}`)] = true;
    for (const c of cur.filterColumns) if (!p.filterColumns.includes(c)) out[k(`filter-.${c}`)] = true;
    for (const r of p.relations) if (r.overlap !== null && r.overlap >= 0.9) out[k(`rel.${r.attr}`)] = true;
    if (p.orderBy && p.orderBy !== cur.orderBy) out[k("orderBy")] = true;
  }
  return out;
}

/** 체크한 것을 지금 값 위에 얹는다. 아무것도 안 골랐으면 null — 저장하지 않는다 */
function buildInput(it: Extract<RefineItem, { ok: true }>, on: (k: string) => boolean): ExternalConceptInput | null {
  const { current: cur, proposal: p } = it;
  const k = (f: string) => `${it.conceptRowId}:${f}`;
  let touched = false;
  const next: ExternalConceptInput = {
    conceptId: cur.conceptId,
    name: cur.name,
    synonyms: cur.synonyms,
    tab: cur.tab,
    description: cur.description.replace(DRAFT_MARK, ""),
    attrs: { ...cur.attrs },
    relations: [...cur.relations],
    formula: cur.formula,
    sql: cur.sql,
    filterColumns: [...cur.filterColumns],
    orderBy: cur.orderBy,
    sortOrder: cur.sortOrder,
  };
  if (on(k("name"))) { next.name = p.name; touched = true; }
  if (on(k("synonyms"))) { next.synonyms = p.synonyms; touched = true; }
  if (on(k("description"))) { next.description = p.description; touched = true; }
  for (const [col, label] of Object.entries(p.attrs)) if (on(k(`attr.${col}`))) { next.attrs[col] = label; touched = true; }
  for (const c of p.filterColumns) if (!next.filterColumns.includes(c) && on(k(`filter+.${c}`))) { next.filterColumns.push(c); touched = true; }
  for (const c of cur.filterColumns) if (!p.filterColumns.includes(c) && on(k(`filter-.${c}`))) { next.filterColumns = next.filterColumns.filter((x) => x !== c); touched = true; }
  for (const r of p.relations) if (on(k(`rel.${r.attr}`))) { next.relations.push({ attr: r.attr, to: r.to }); touched = true; }
  if (p.orderBy && on(k("orderBy"))) { next.orderBy = p.orderBy; touched = true; }
  return touched ? next : null;
}
