/**
 * 「AI 로 다듬기」 — 초안 개념 하나를 모델에 묻고, 답을 검증해 제안으로 만든다.
 *
 * 흐름: BE `GET …/concepts/{id}/refine-input`(사용자 토큰 — 관리자가 아니면 BE 가 403) → 프롬프트 → `generateObject`(zod 스키마)
 * → 검증(컬럼 · 개념 id 범위, 집계 SQL 은 BE 미리보기로 실제 5행) → `RefineItem`. 어디에도 저장하지 않는다 — 저장은 사람이 검토 패널에서
 * 필드마다 체크한 것만 기존 저장 API 로.
 *
 * 고객 데이터: BE 가 준 프로파일에 값이 있는 곳은 열거형 컬럼의 값 목록뿐이다. `structureOnly` 면 그것도 지운다.
 */
import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { BUILTIN } from "@/lib/ai/ontology";
import type { AggregateProposal, ConceptProposal, RefineInputDto, RefineItem, TableProfileDto } from "@/lib/ai/refine-types";
import { DRAFT_MARK } from "@/lib/ai/refine-types";
import { beConfig } from "./env";
import { chatModel, providerOptions } from "./models";

const MODEL_TIMEOUT_MS = 60_000;
const BE_TIMEOUT_MS = 30_000;
const MAX_AGGREGATES = 2;
const MAX_SYNONYMS = 8;
const CONCEPT_ID = /^[a-z][a-z0-9_]{1,49}$/;

/** 모델 출력. 이 밖은 버린다 — 자유 서술 없음, 권한 탭 없음 */
const proposalSchema = z.object({
  name: z.string().min(1).max(30).describe("개념 이름. 화면 머리글처럼 짧게"),
  synonyms: z.array(z.string().min(1).max(20)).max(MAX_SYNONYMS).describe("사용자가 채팅에 칠 법한 말. 준말 · 영문 약어 · 현장 말"),
  description: z.string().min(1).max(160).describe("무엇 · 어떤 항목 · 어떤 질문에. 한 문장, 「…을 물을 때」 로 끝낸다"),
  // record 가 아니라 배열 — OpenAI 구조화 출력이 record(JSON Schema propertyNames)를 거부한다. 선택 필드도 두지 않는다(strict 모드)
  attrs: z.array(z.object({ column: z.string(), label: z.string().min(1).max(60) })).describe("컬럼 이름 → 라벨. 주어진 컬럼만"),
  filterColumns: z.array(z.string()).describe("거르기에 쓸 컬럼. rules 를 바탕으로 더하거나 뺀다"),
  filterReason: z.string().max(200).describe("rules 와 다르게 정했으면 한 줄 이유. 같으면 빈 문자열"),
  relations: z.array(z.object({ attr: z.string(), to: z.string() })).describe("attr → 개념 id. conceptIds 안에서만"),
  keep: z.boolean().describe("이 표를 개념으로 둘 가치가 있는가"),
  keepReason: z.string().max(200),
  aggregates: z
    .array(z.object({ id: z.string(), name: z.string().max(30), description: z.string().max(160), sql: z.string().max(2000) }))
    .max(MAX_AGGREGATES)
    .describe("자주 물을 집계 개념. 없으면 빈 배열"),
});

const INSTRUCTIONS = `당신은 제조 · 경영 업무 시스템의 데이터 온톨로지를 정리하는 사람입니다. 회사의 외부 시스템(MES · ERP) 표 하나를 「개념」 으로 다듬습니다.
개념은 AI 비서가 사용자의 질문을 데이터 조회로 바꿀 때 고르는 단위입니다. 사용자는 한국어로 업무 말을 씁니다.

규칙:
- 한국어 업무 용어로 씁니다. 컬럼 이름은 바꾸지 않고 라벨만 답니다. 라벨은 화면 머리글처럼 짧게(사번 · 입사일 · 실지급액).
- 값 목록(values)이 8개 이하인 컬럼은 라벨 뒤 괄호에 값을 적습니다 — 예: 재직 상태(재직 · 휴직 · 퇴직). 9개 이상이면 「코드」 라고만 적습니다.
- 값 목록이 없는 컬럼은 이름 · 타입 · 주석 · 모양(shape)으로 라벨을 답니다. 지어내지 않습니다. masked 컬럼은 이름만 보고 답니다.
- 숫자 라벨에는 단위를 추정해 적되 확실하지 않으면 적지 않습니다.
- synonyms 는 사용자가 채팅에 칠 법한 말 3~8개: 준말 · 영문 약어 · 현장 말(WO · 작지 · 직원 · 인원). 이름과 같은 말은 넣지 않고, siblings(다른 개념)의 이름과 겹치는 말은 피합니다.
- description 은 「무엇 · 어떤 항목 · 어떤 질문에」 한 문장으로, 「…을 물을 때」 로 끝냅니다. 표 이름 · 스키마 이름을 넣지 않습니다.
- filterColumns 는 rules.addFilters 를 더하고 rules.removeFilters 를 뺀 것을 기본으로 하되, 업무상 자주 거를 컬럼을 판단해 조정합니다. attrs 의 키만 씁니다.
- relations 는 rules.relations 를 그대로 넣고, 그 밖에 이름 · 값으로 확실한 것만 더합니다. to 는 conceptIds 에 있는 id 만.
- keep=false 는 코드성 매핑 표 · 로그 · 임시 표에만. 이유를 한 줄 적습니다.
- aggregates 는 사람이 자주 물을 집계(월별 · 부서별 · 상태별 건수 · 합계) 두 개까지. SQL 은 이 표의 컬럼만 쓰고, 조인은 relations 에 있는 표에만, select 로 시작하고 세미콜론 없이, group by 가 있어야 합니다. id 는 영문 소문자 · 숫자 · 밑줄, 같은 접두어로.
- JSON 스키마대로만 답합니다.`;

function stripValues(p: TableProfileDto): TableProfileDto {
  return { ...p, columns: p.columns.map((c) => ({ ...c, values: null, min: null, max: null })) };
}

function beHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function beGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${beConfig().baseUrl}${path}`, { headers: beHeaders(token), signal: AbortSignal.timeout(BE_TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `BE 응답 ${res.status}`);
  }
  return (await res.json()) as T;
}

async function bePreview(workspaceId: number, systemId: number, sql: string, token: string): Promise<{ columns: string[]; error: string | null }> {
  const res = await fetch(`${beConfig().baseUrl}/api/admin/workspaces/${workspaceId}/systems/${systemId}/concepts/preview`, {
    method: "POST",
    headers: beHeaders(token),
    body: JSON.stringify({ sql }),
    signal: AbortSignal.timeout(BE_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    return { columns: [], error: err?.message ?? `미리보기 실패 (${res.status})` };
  }
  return (await res.json()) as { columns: string[]; error: string | null };
}

export async function fetchRefineInput(workspaceId: number, conceptRowId: number, token: string): Promise<RefineInputDto> {
  return beGet<RefineInputDto>(`/api/admin/workspaces/${workspaceId}/concepts/${conceptRowId}/refine-input`, token);
}

/** 모델에 주는 입력 — BE 가 준 것 중 tab · sql · 시스템 접속 같은 건 뺀다 */
function promptFor(input: RefineInputDto, structureOnly: boolean): string {
  const profile = structureOnly ? stripValues(input.profile) : input.profile;
  const c = input.concept;
  const payload = {
    system: input.system,
    concept: { id: c.conceptId, name: c.name, synonyms: c.synonyms, description: c.description.replace(DRAFT_MARK, ""), attrs: c.attrs, relations: c.relations, filterColumns: c.filterColumns, orderBy: c.orderBy },
    table: {
      schema: input.table.schema,
      name: input.table.name,
      comment: input.table.comment,
      approxRows: input.table.approxRows,
      primaryKey: input.table.primaryKey,
      foreignKeys: input.table.foreignKeys,
      columns: input.table.columns
        .filter((col) => col.name in c.attrs)
        .map((col) => {
          const p = profile.columns.find((x) => x.name === col.name);
          return { name: col.name, type: col.type, dataType: col.dataType, comment: col.comment, ...(p ? { distinct: p.distinct, masked: p.masked, longText: p.longText, values: p.values, shape: p.shape, avgLen: p.avgLen, min: p.min, max: p.max } : {}) };
        }),
    },
    sampledRows: profile.sampledRows,
    rules: input.rules,
    siblings: input.siblings,
    conceptIds: allowedConceptIds(input),
  };
  return JSON.stringify(payload);
}

/** 관계 상대로 허용되는 개념 id — 자기 자신과 같은 표를 읽는 쌍둥이는 뺀다(자기 표를 가리키는 관계가 되니까) */
function allowedConceptIds(input: RefineInputDto): string[] {
  const excluded = new Set([input.concept.conceptId, ...input.duplicates.map((d) => d.id)]);
  return [...new Set([...input.conceptIds, ...BUILTIN.map((b) => b.id)])].filter((id) => !excluded.has(id));
}

type Raw = z.infer<typeof proposalSchema>;

/** 모델 답 → 저장 가능한 제안. 범위 밖은 버리고 `dropped` 에 이유를 남긴다 */
export async function validate(raw: Raw, input: RefineInputDto, token: string, workspaceId: number): Promise<{ proposal: ConceptProposal; dropped: string[] }> {
  const dropped: string[] = [];
  const cur = input.concept;
  const keys = new Set(Object.keys(cur.attrs));
  const allowedIds = new Set(allowedConceptIds(input));

  const attrs: Record<string, string> = {};
  for (const { column: k, label: v } of raw.attrs) {
    if (!keys.has(k)) {
      dropped.push(`라벨 ${k}: 없는 컬럼`);
      continue;
    }
    const label = v.trim();
    if (label && label !== cur.attrs[k]) attrs[k] = label;
  }

  const name = raw.name.trim();
  const synonyms = [...new Set(raw.synonyms.map((s) => s.trim()).filter((s) => s && s !== name))].slice(0, MAX_SYNONYMS);
  const description = raw.description.trim();

  const filterColumns = [...new Set(raw.filterColumns.map((s) => s.trim()))].filter((k) => {
    if (keys.has(k) && /^[a-z_][a-z0-9_]*$/.test(k)) return true;
    dropped.push(`필터 ${k}: 없는 컬럼`);
    return false;
  });

  const existingRel = new Set(cur.relations.map((r) => r.attr));
  const overlapOf = new Map(input.rules.relations.map((r) => [r.attr, r.overlap]));
  const relations = raw.relations
    .filter((r) => {
      if (existingRel.has(r.attr)) return false;
      if (!keys.has(r.attr)) {
        dropped.push(`관계 ${r.attr}: 없는 컬럼`);
        return false;
      }
      if (!allowedIds.has(r.to)) {
        dropped.push(`관계 ${r.attr} → ${r.to}: 없는 개념`);
        return false;
      }
      return true;
    })
    .map((r) => ({ attr: r.attr, to: r.to, overlap: overlapOf.get(r.attr) ?? null }));

  const aggregates: AggregateProposal[] = [];
  const taken = new Set(input.conceptIds);
  for (const a of raw.aggregates.slice(0, MAX_AGGREGATES)) {
    const sql = a.sql.trim();
    let id = a.id.trim();
    if (!CONCEPT_ID.test(id)) {
      dropped.push(`집계 ${id || "(id 없음)"}: id 모양`);
      continue;
    }
    if (taken.has(id)) id = `${id}_2`;
    if (!/^select\b/i.test(sql) || sql.includes(";") || !/\bgroup\s+by\b/i.test(sql)) {
      dropped.push(`집계 ${id}: SQL 모양 (select · group by · 세미콜론 없음)`);
      continue;
    }
    const preview = await bePreview(workspaceId, cur.systemId, sql, token);
    if (preview.error || preview.columns.length === 0) {
      dropped.push(`집계 ${id}: 미리보기 실패 — ${preview.error ?? "컬럼 없음"}`);
      continue;
    }
    taken.add(id);
    aggregates.push({ id, name: a.name.trim(), description: a.description.trim(), sql, columns: preview.columns });
  }

  return {
    proposal: {
      name,
      synonyms,
      description,
      attrs,
      filterColumns,
      relations,
      orderBy: input.rules.orderBy,
      keep: raw.keep,
      keepReason: raw.keepReason.trim(),
      aggregates,
    },
    dropped,
  };
}

/** 개념 하나. 실패는 던지지 않고 `ok: false` 로 — 다른 표는 계속 간다 */
export async function refineOne(workspaceId: number, conceptRowId: number, structureOnly: boolean, token: string): Promise<RefineItem> {
  let input: RefineInputDto;
  try {
    input = await fetchRefineInput(workspaceId, conceptRowId, token);
  } catch (e) {
    return { conceptRowId, conceptId: "", name: "", ok: false, error: e instanceof Error ? e.message : "재료를 받지 못했어요" };
  }
  const base = { conceptRowId, conceptId: input.concept.conceptId, name: input.concept.name };
  const model = chatModel();
  if (!model) return { ...base, ok: false, error: "대화 모델이 설정되지 않았어요" };

  try {
    const { object } = await generateObject({
      model,
      schema: proposalSchema,
      instructions: INSTRUCTIONS,
      prompt: promptFor(input, structureOnly),
      maxOutputTokens: 4_000,
      abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
      providerOptions: providerOptions("medium"),
    });
    const { proposal, dropped } = await validate(object, input, token, workspaceId);
    return { ...base, ok: true, current: input.concept, proposal, rules: input.rules, duplicates: input.duplicates, dropped };
  } catch (e) {
    console.warn("[ai-refine] 제안 실패", base.conceptId, e instanceof Error ? e.message : e);
    // 운영자만 보는 화면이라 이유를 짧게 붙인다 — 스키마 · 프로바이더 문제를 로그 없이 알 수 있게
    const why = e instanceof Error ? e.message.replace(/\s+/g, " ").slice(0, 160) : "";
    return { ...base, ok: false, error: e instanceof Error && e.name === "TimeoutError" ? "시간이 걸려 멈췄어요. 다시 시도해 주세요" : `제안을 받지 못했어요${why ? ` — ${why}` : ""}` };
  }
}

/** 여러 개념을 동시에 `parallel` 개씩 */
export async function refineMany(workspaceId: number, ids: number[], structureOnly: boolean, token: string, parallel = 3): Promise<RefineItem[]> {
  const out: RefineItem[] = new Array(ids.length);
  let next = 0;
  async function worker() {
    while (next < ids.length) {
      const i = next++;
      out[i] = await refineOne(workspaceId, ids[i], structureOnly, token);
    }
  }
  await Promise.all(Array.from({ length: Math.min(parallel, ids.length) }, worker));
  return out;
}
