/**
 * 개념 SQL 이 읽는 표 — BE `OntologyRules.fromTable` 과 같은 규칙. 「같은 표를 읽는 개념이 있어요」 판정(#116 1번)을 템플릿 확인 목록과
 * DB 초안 모달이 화면에서 바로 하려고 둔다. 조인 · 서브쿼리가 있는 손 SQL 은 첫 FROM 을 잡고, `스키마.표` 꼴이 없으면 null.
 *
 * 한계: 템플릿 개념이 뷰(`mes.v_work_order_progress`)를 읽고 초안이 원본 표(`mes.work_orders`)를 읽으면 다른 표로 본다 — 그건 id 로만 잡힌다.
 */
const FROM_TABLE = /\bfrom\s+([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)/i;

export function fromTable(sql: string | null | undefined): string | null {
  const m = sql ? FROM_TABLE.exec(sql) : null;
  return m ? `${m[1].toLowerCase()}.${m[2].toLowerCase()}` : null;
}

/** 표 → 그 표를 읽는 개념들. 「같은 표를 읽는 개념이 있어요: 불량 기록 (mes_defects)」 문구의 재료 */
export function conceptsByTable<T extends { sql: string; conceptId: string; name: string }>(concepts: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const c of concepts) {
    const t = fromTable(c.sql);
    if (!t) continue;
    out.set(t, [...(out.get(t) ?? []), c]);
  }
  return out;
}

/** 개념 id 규칙 — BE `ExternalConceptRequest` 와 같다. 영문 소문자로 시작, 소문자 · 숫자 · 밑줄 2~50자 */
export const CONCEPT_ID = /^[a-z][a-z0-9_]{1,49}$/;
