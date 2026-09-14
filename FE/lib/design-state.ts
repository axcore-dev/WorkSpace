import type { Drawing, DrawingBomLine, DrawingStatus } from "../data/drawings";
import type { Item } from "../data/inventory";
import type { Cell } from "../data/types";

/**
 * 제품설계 화면 상태 — 순수 규칙. BE 가 안 떠 있을 때(폴백) 리듀서로 쓰고, 서버에 붙으면 `design-api.ts` 가 같은
 * 동작을 보낸다. 서버(`DesignWriteService`)와 같은 규칙이어야 두 화면이 어긋나지 않는다.
 *
 * 도면 하나 = `code + rev`. 같은 code 의 다음 리비전은 앞 리비전에서 파생된 별도 도면이다(`data/drawings.ts`).
 */

/** Rev.A → Rev.B. 서버(`DesignCodes.nextRev`)와 같은 규칙 */
export function nextRev(rev: string): string {
  const c = rev.replace("Rev.", "");
  return "Rev." + String.fromCharCode(c.charCodeAt(0) + 1);
}

export const drawingKey = (d: Pick<Drawing, "code" | "rev">) => `${d.code} ${d.rev}`;
/** 파생 도면(가공도 등) — 다른 도면번호를 근거로 삼는다. 같은 code 의 리비전 파생과는 다르다 */
export const isDerived = (d: Drawing) => !!d.parent;

/** 같은 code 의 리비전들 — 최신이 앞 */
export const revisionsOf = (drawings: Drawing[], code: string) => drawings.filter((d) => d.code === code).sort((a, b) => b.rev.localeCompare(a.rev));
/** 「지금 도면」 — 같은 code 중 리비전이 가장 높은 것 */
export const latestOf = (drawings: Drawing[], code: string): Drawing | undefined => revisionsOf(drawings, code)[0];
export const isLatest = (drawings: Drawing[], d: Drawing) => latestOf(drawings, d.code) === d;
/** 도면번호마다 지금 도면 하나 — 폐기는 뺀다. 발주서 · BOM 관리 · 품목 마스터 칩이 보는 목록 */
export const liveLatest = (drawings: Drawing[]) => drawings.filter((d) => d.status !== "폐기" && isLatest(drawings, d));

export interface DesignData {
  drawings: Drawing[];
}

export type DesignAction =
  | {
      type: "register";
      drawing: {
        code: string;
        name: string;
        /** 파생이면 근거 도면 code · 리비전. 리비전이 비면 그 도면의 지금 리비전 */
        parent?: string;
        parentRev?: string;
        vehicle?: string;
        projectCode?: string;
        excel: boolean;
        change: string;
        requester: string;
      };
      lines: DrawingBomLine[];
    }
  /** 지금 리비전에서 다음 리비전 도면을 딴다 */
  | { type: "revise"; code: string; change: string; requester: string; excel: boolean; lines: DrawingBomLine[] }
  /** 이름 · 폐기는 도면번호 전체(모든 리비전) */
  | { type: "rename"; code: string; name: string }
  | { type: "discard"; code: string }
  /** 파생 도면의 지금 리비전이 상위의 개정을 확인한다 */
  | { type: "acknowledge"; code: string }
  /** BOM 한 줄 ↔ 품목. index 는 그 도면의 bom 배열 위치(서버는 줄 id 를 쓴다) */
  | { type: "mapBom"; code: string; rev: string; index: number; itemCode: string | null };

const patchCode = (state: DesignData, code: string, f: (d: Drawing) => Drawing): DesignData => ({
  drawings: state.drawings.map((d) => (d.code === code ? f(d) : d)),
});
const patchOne = (state: DesignData, target: Drawing, f: (d: Drawing) => Drawing): DesignData => ({
  drawings: state.drawings.map((d) => (d === target ? f(d) : d)),
});

/** 폴백 리듀서 — 서버가 하는 일을 화면에서 같은 규칙으로 한다. `today` 는 YYYY-MM-DD, `actor` 는 등록자 이름 */
export function reduce(state: DesignData, action: DesignAction, today: string, actor: string): DesignData {
  switch (action.type) {
    case "register": {
      const a = action.drawing;
      if (state.drawings.some((d) => d.code === a.code)) return state;
      let parent: Drawing | undefined;
      if (a.parent) {
        parent = a.parentRev ? state.drawings.find((d) => d.code === a.parent && d.rev === a.parentRev) : latestOf(state.drawings, a.parent);
        if (!parent || parent.status === "폐기") return state;
      }
      const created: Drawing = {
        code: a.code,
        rev: "Rev.A",
        name: a.name,
        parent: parent ? parent.code : null,
        parentRev: parent ? parent.rev : null,
        vehicle: parent ? null : a.vehicle || null,
        projectCode: parent ? null : a.projectCode || null,
        excel: a.excel,
        author: actor,
        updated: today,
        status: "승인",
        change: a.change || "최초 등록",
        requester: a.requester,
        bom: action.lines,
      };
      return { drawings: [...state.drawings, created] };
    }
    case "revise": {
      const cur = latestOf(state.drawings, action.code);
      if (!cur || cur.status === "폐기") return state;
      const next: Drawing = {
        ...cur,
        rev: nextRev(cur.rev),
        excel: cur.excel || action.excel,
        author: actor || cur.author,
        updated: today,
        status: "승인",
        change: action.change || "변경 내용 미기재",
        requester: action.requester,
        bom: action.lines,
      };
      // 원본이 바뀌었다 — 이 원본을 근거로 삼은 파생 도면(지금 리비전)은 다시 봐야 한다
      const flagged = state.drawings.map((d) =>
        d.parent === action.code && d.status !== "폐기" && isLatest(state.drawings, d) ? { ...d, status: "확인 필요" as DrawingStatus } : d,
      );
      return { drawings: [...flagged, next] };
    }
    case "rename":
      return patchCode(state, action.code, (d) => ({ ...d, name: action.name || d.name }));
    case "discard":
      return patchCode(state, action.code, (d) => ({ ...d, status: "폐기", updated: today }));
    case "acknowledge": {
      const target = latestOf(state.drawings, action.code);
      const parent = target?.parent ? latestOf(state.drawings, target.parent) : undefined;
      if (!target || !parent) return state;
      return patchOne(state, target, (d) => ({ ...d, status: "승인", parentRev: parent.rev }));
    }
    case "mapBom": {
      const target = state.drawings.find((d) => d.code === action.code && d.rev === action.rev);
      if (!target) return state;
      return patchOne(state, target, (d) => ({
        ...d,
        bom: d.bom.map((l, i) => (i === action.index ? { ...l, itemCode: action.itemCode } : l)),
      }));
    }
  }
}

/** 미매핑 BOM 줄 수. 0 이어야 발주서 작성이 이 도면을 받는다(`inventory-state` `validateDraft`) */
export const unmappedCount = (d: Drawing) => d.bom.filter((l) => !l.itemCode).length;

/** 품목 마스터에서 BOM 줄에 맞는 품목 — 호칭+규격 → 품명 순. 서버(`DesignWriteService.resolveItem`)와 같은 순서 */
export function autoMap(line: Pick<DrawingBomLine, "item" | "spec" | "size">, items: Item[]): string | null {
  const live = items.filter((it) => !it.discontinued);
  const hit = live.find((it) => it.spec === line.spec && it.size === line.size) ?? live.find((it) => it.name === line.item);
  return hit?.code ?? null;
}

/** 아직 매핑이 없는 줄만 품목 마스터에서 찾아 채운다. 사람이 이미 맺은 줄은 두고 */
export const autoMapLines = (lines: DrawingBomLine[], items: Item[]): DrawingBomLine[] =>
  lines.map((l) => (l.itemCode ? l : { ...l, itemCode: autoMap(l, items) }));

/* ───────────── BOM 관리 트리 ───────────── */

export interface BomTreeLine {
  drawing: Drawing;
  index: number;
  line: DrawingBomLine;
}
/** 원본 도면(지금 리비전) 하나 — 자기 BOM 줄과, 이 도면을 근거로 한 파생 도면들의 BOM 줄(현장 제작) */
export interface BomTreeGroup {
  drawing: Drawing;
  lines: BomTreeLine[];
  derived: BomTreeLine[];
}

const linesOf = (d: Drawing): BomTreeLine[] => d.bom.map((line, index) => ({ drawing: d, index, line }));

/** 폐기되지 않은 원본 도면의 지금 리비전마다 한 묶음. `query` 는 도면번호 · 도면명 · 품명 · 호칭 · 규격 · 품목 코드에 건다 */
export function bomTree(drawings: Drawing[], query = ""): BomTreeGroup[] {
  const q = query.trim().toLowerCase();
  const hit = (l: BomTreeLine) => !q || [l.line.item, l.line.spec, l.line.size, l.line.itemCode ?? ""].some((v) => v.toLowerCase().includes(q));
  const live = liveLatest(drawings);
  return live
    .filter((d) => !isDerived(d))
    .map((d) => {
      const all = [d.code, d.name].some((v) => v.toLowerCase().includes(q));
      const lines = linesOf(d).filter((l) => all || hit(l));
      const derived = live.filter((x) => x.parent === d.code).flatMap(linesOf).filter((l) => all || hit(l));
      return { drawing: d, lines, derived };
    })
    .filter((g) => g.lines.length + g.derived.length > 0);
}

export const BOM_EXPORT_COLUMNS = ["도면번호", "리비전", "품명", "호칭", "규격", "수량", "매핑 품목"];

/** 내보내기 행 — 트리에 보이는 줄 그대로 */
export const bomExportRows = (groups: BomTreeGroup[]): Cell[][] =>
  groups
    .flatMap((g) => [...g.lines, ...g.derived])
    .map(({ drawing, line }) => [drawing.code, drawing.rev, line.item, line.spec, line.size, `${line.qty} EA`, line.itemCode ?? "미매핑"]);

export const BOM_SHEET_COLUMNS = ["품명", "호칭", "규격", "수량"];

const normalizeName = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/**
 * 정제 엑셀의 행 → BOM 줄. 첫 행이 머리글이다. 「품명」 · 「수량」 열은 있어야 하고, 수량이 숫자가 아니거나 0 이하인
 * 행은 이유와 함께 버린다. 실제 도면(dwg) 파싱은 하지 않는다 — 추출은 정제 엑셀이 담당한다는 것이 이 화면의 전제다.
 */
export function parseBomRows(rows: string[][]): { lines: DrawingBomLine[]; errors: string[] } {
  const [header = [], ...body] = rows;
  const col = (name: string) => header.findIndex((h) => normalizeName(h) === normalizeName(name));
  const at = (r: string[], name: string) => {
    const k = col(name);
    return k >= 0 ? (r[k] ?? "").trim() : "";
  };
  if (col("품명") < 0 || col("수량") < 0) {
    return { lines: [], errors: ["머리글에 「품명」 · 「수량」 열이 있어야 해요"] };
  }
  const lines: DrawingBomLine[] = [];
  const errors: string[] = [];
  body.forEach((r, i) => {
    if (r.every((c) => !c || !String(c).trim())) return;
    const row = i + 2;
    const item = at(r, "품명");
    const qty = Number(at(r, "수량").replace(/,/g, ""));
    if (!item) errors.push(`${row}행: 품명이 비어 있어요`);
    else if (!Number.isInteger(qty) || qty <= 0) errors.push(`${row}행: 수량은 1 이상의 정수여야 해요`);
    else lines.push({ item, spec: at(r, "호칭"), size: at(r, "규격"), qty, itemCode: null });
  });
  return { lines, errors };
}
