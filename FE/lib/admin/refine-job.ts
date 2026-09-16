/**
 * 「AI 로 다듬기」 작업 — 모달 밖에서 돈다.
 *
 * 모달 안에 두면 × 로 닫는 순간 컴포넌트와 함께 진행 중이던 결과가 사라진다. 여기(모듈 메모리)에 두면 모달을 닫아도, 운영 콘솔의
 * 다른 페이지로 갔다 와도 계속 돌고 끝난 결과가 남는다. 새로고침 · 탭 닫기에는 사라진다 — 서버에 작업 표를 두는 것은 다음 일이다.
 *
 * 한 번에 작업 하나다. 개념을 하나씩, 동시에 3개까지 보낸다(서버 `refineMany` 의 병렬 수와 같다). 모델 호출 수는 묶어 보낼 때와
 * 같고, 끝난 개수 / 전체가 곧 진행률이다. 한 개가 실패하면 그 개념만 실패 줄이 되고 나머지는 계속 간다.
 */
import { useSyncExternalStore } from "react";
import { refineConcepts } from "@/lib/ai/ontology-refine";
import type { RefineItem } from "@/lib/ai/refine-types";
import { ApiRequestError } from "@/lib/api";
import { SESSION_CHANGED } from "@/lib/session";

export type RefineTarget = { rowId: number; conceptId: string; name: string };

export type RefineJob = {
  /** 시작 시각(ms). 검토 체크 상태를 이 작업에 묶는 키 */
  id: number;
  workspaceId: number;
  targets: RefineTarget[];
  structureOnly: boolean;
  status: "running" | "done";
  done: number;
  /** 지금 도는 개념 이름(최대 3) */
  current: string[];
  doneIds: number[];
  /** 끝난 뒤 — targets 순서대로 */
  items: RefineItem[];
};

const PARALLEL = 3;

let job: RefineJob | null = null;
const listeners = new Set<() => void>();
/** 도는 작업을 멈추는 손잡이 — 로그인이 바뀌면 남은 개념을 더 보내지 않는다 */
let cancelCurrent: (() => void) | null = null;

function commit(next: RefineJob | null) {
  job = next;
  listeners.forEach((l) => l());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRefineJob(): RefineJob | null {
  return job;
}

export function useRefineJob(): RefineJob | null {
  return useSyncExternalStore(subscribe, getRefineJob, () => null);
}

/** 이 회사의 작업. 다른 회사 것은 null */
export function useRefineJobFor(workspaceId: number): RefineJob | null {
  const j = useRefineJob();
  return j && j.workspaceId === workspaceId ? j : null;
}

/** 워크스페이스 id → 스키마 이름(운영 콘솔 URL 조각). `admin-api.workspaceIdFromSchema` 의 반대 */
export function schemaOf(workspaceId: number): string {
  return `ax_${String(workspaceId).padStart(5, "0")}`;
}

/** 시작한다. 이미 도는 작업이 있으면 false — 한 번에 하나만 */
export function startRefine(workspaceId: number, targets: RefineTarget[], structureOnly: boolean): boolean {
  if (job?.status === "running") return false;
  if (targets.length === 0) return false;
  const id = Date.now();
  const results: RefineItem[] = new Array(targets.length);
  const running = new Set<string>();
  const doneIds: number[] = [];
  let next = 0;
  let done = 0;
  let cancelled = false;
  cancelCurrent = () => {
    cancelled = true;
  };
  const publish = (status: "running" | "done") => {
    // 이 작업이 아직 현재 작업일 때만 — 비워졌거나(로그아웃) 다른 작업으로 바뀐 것을 되살리지 않는다
    if (!job || job.id !== id) return;
    commit({
      id,
      workspaceId,
      targets,
      structureOnly,
      status,
      done,
      current: [...running],
      doneIds: [...doneIds],
      items: status === "done" ? results.filter((r): r is RefineItem => r !== undefined) : [],
    });
  };
  commit({ id, workspaceId, targets, structureOnly, status: "running", done: 0, current: [], doneIds: [], items: [] });

  const worker = async () => {
    while (!cancelled && next < targets.length) {
      const idx = next++;
      const t = targets[idx];
      running.add(t.name);
      publish("running");
      try {
        const r = await refineConcepts({ workspaceId, conceptRowIds: [t.rowId], structureOnly });
        results[idx] = r.items[0] ?? { conceptRowId: t.rowId, conceptId: t.conceptId, name: t.name, ok: false, error: "제안이 비어 있어요" };
      } catch (e) {
        results[idx] = {
          conceptRowId: t.rowId,
          conceptId: t.conceptId,
          name: t.name,
          ok: false,
          error: e instanceof ApiRequestError ? e.message : "제안을 받지 못했어요",
        };
      }
      running.delete(t.name);
      done += 1;
      doneIds.push(t.rowId);
      publish("running");
    }
  };
  void Promise.all(Array.from({ length: Math.min(PARALLEL, targets.length) }, worker)).then(() => publish("done"));
  return true;
}

/** 검토를 끝냈거나 버렸다 — 배지와 버튼이 원래대로 돌아간다. 도는 중에는 지우지 않는다(결과를 받을 곳이 없어진다) */
export function clearRefine() {
  if (job?.status === "running") return;
  commit(null);
}

// 로그인 · 로그아웃 · 회사 전환으로 토큰이 바뀌면 이전 사람의 작업과 결과(고객 DB 구조 · 값 목록)를 버린다. 도는 중이면 남은 개념을
// 더 보내지 않고, 이미 나간 요청의 결과는 publish 의 id 검사에서 걸려 되살아나지 않는다.
if (typeof window !== "undefined") {
  window.addEventListener(SESSION_CHANGED, () => {
    cancelCurrent?.();
    cancelCurrent = null;
    commit(null);
  });
}
