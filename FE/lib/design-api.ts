import { apiGet, apiPostAuthed, apiPut, ApiRequestError } from "@/lib/api";
import type { Drawing, DrawingBomLine } from "@/data/drawings";
import type { DesignAction, DesignData } from "@/lib/design-state";

/**
 * 제품설계 API. 회사를 고른 토큰이어야 하고, 탭 권한이 없거나 회사가 탭을 끄면 403 이 온다.
 *
 * BE 는 `BE/src/main/java/com/axcore/workspace/design` 이다. 읽기는 모듈 단위, 쓰기는 탭 단위(`ModuleTabAccess`).
 * 재고·물류도 `getDrawings` 로 같은 목록을 읽어 발주서의 소요를 뽑는다 — 그쪽은 권한이 없으면 빈 목록으로 간다.
 */
const BASE = "/api/workspace/design";
const seg = encodeURIComponent;

export async function getAll(): Promise<DesignData> {
  return { drawings: (await apiGet<Drawing[]>(`${BASE}/drawings`)) ?? [] };
}

/**
 * 재고·물류가 부른다. 제품설계 권한이 없거나(403) 회사가 그 기능을 껐거나 BE 가 옛 버전이면(404) 도면 없이 간다 —
 * 발주서는 도면 없이도 쓸 수 있고, 여기서 막으면 재고 화면 전체가 오류가 된다.
 */
export async function getDrawingsOrNone(): Promise<Drawing[]> {
  try {
    return (await apiGet<Drawing[]>(`${BASE}/drawings`)) ?? [];
  } catch (e) {
    if (e instanceof ApiRequestError && (e.status === 403 || e.status === 404)) return [];
    throw e;
  }
}

const toLines = (lines: DrawingBomLine[]) => lines.map((l) => ({ item: l.item, spec: l.spec, size: l.size, qty: l.qty, itemCode: l.itemCode }));

/** 동작 하나를 서버에 보낸다. 성공 뒤 호출한 쪽이 `getAll` 로 다시 받는다 — 낙관적 갱신 없음 */
export async function send(action: DesignAction, current: DesignData): Promise<void> {
  switch (action.type) {
    case "register": {
      const a = action.drawing;
      await apiPostAuthed(`${BASE}/drawings`, {
        code: a.code,
        name: a.name,
        parent: a.parent ?? null,
        parentRev: a.parentRev ?? null,
        vehicle: a.vehicle ?? "",
        projectCode: a.projectCode ?? "",
        excel: a.excel,
        change: a.change,
        requester: a.requester,
        lines: toLines(action.lines),
      });
      return;
    }
    case "revise":
      await apiPostAuthed(`${BASE}/drawings/${seg(action.code)}/revisions`, {
        change: action.change,
        requester: action.requester,
        excel: action.excel,
        lines: toLines(action.lines),
      });
      return;
    case "rename":
      await apiPut(`${BASE}/drawings/${seg(action.code)}/name`, { name: action.name });
      return;
    case "discard":
      await apiPostAuthed(`${BASE}/drawings/${seg(action.code)}/discard`);
      return;
    case "acknowledge":
      await apiPostAuthed(`${BASE}/drawings/${seg(action.code)}/acknowledge`);
      return;
    case "mapBom": {
      // 화면은 배열 위치로 말하고 서버는 줄 id 로 듣는다 — 현재 상태에서 id 를 찾아 보낸다
      const line = current.drawings.find((d) => d.code === action.code && d.rev === action.rev)?.bom[action.index];
      if (line?.id === undefined) throw new Error("서버가 준 BOM 줄이 아니에요. 새로고침한 뒤 다시 시도해 주세요");
      await apiPut(`${BASE}/drawings/${seg(action.code)}/bom/${line.id}`, { itemCode: action.itemCode });
      return;
    }
  }
}
