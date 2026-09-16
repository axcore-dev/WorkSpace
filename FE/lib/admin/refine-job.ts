/**
 * 「AI 로 다듬기」 작업 — 화면 쪽 스토어. 작업은 서버가 든다(`shared.ai_refine_jobs`, `lib/ai/server/refine-jobs.ts`).
 * 여기는 그것을 폴링해 모달 · 스튜디오 헤더 버튼 · 사이드바 배지가 같은 값을 보게 한다.
 *
 * 새로고침 · 탭 닫기 · 다른 페이지 이동 어느 것에도 작업은 이어진다 — 서버에 있으니까. 구독자가 있을 때만 폴링하고, 도는 작업이
 * 있으면 2.5초, 없으면 20초 간격이다. 창이 다시 보일 때는 바로 한 번 받는다. 목록에는 결과(items)가 없다 — 검토 패널이 `loadJob` 으로.
 *
 * 시작 · 지우기 뒤에는 그 전에 나간 폴링 응답을 버린다(`version`) — 옛 응답이 방금 지운 작업을 되살리거나 방금 시작한 작업을 지우지 않게.
 * 로그인이 바뀌면(SESSION_CHANGED — 토큰 재발급에도 난다) 버리지 않고 다시 받는다. 운영자가 아니면 401/403 이라 그때 비운다.
 */
import { useSyncExternalStore } from "react";
import { deleteRefineJob, getRefineJob as fetchRefineJob, listRefineJobs, startRefineJob } from "@/lib/ai/ontology-refine";
import type { RefineJob, RefineTarget } from "@/lib/ai/refine-types";
import { ApiRequestError } from "@/lib/api";
import { SESSION_CHANGED } from "@/lib/session";

export type { RefineJob, RefineTarget };

const POLL_RUNNING_MS = 2_500;
const POLL_IDLE_MS = 20_000;

let jobs: RefineJob[] = [];
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
/** 시작 · 지우기마다 오른다. 그 전에 나간 폴링 응답은 버린다 */
let version = 0;

function commit(next: RefineJob[]) {
  jobs = next;
  listeners.forEach((l) => l());
}

async function refresh(): Promise<void> {
  const v = version;
  try {
    const list = await listRefineJobs();
    if (v === version) commit(list);
  } catch (e) {
    // 운영자가 아니거나 로그인이 끊겼으면 빈 목록 — 배지가 사라진다. 네트워크 실패는 이전 값을 둔다
    if (e instanceof ApiRequestError && (e.status === 401 || e.status === 403) && v === version) commit([]);
  }
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (listeners.size === 0) return;
  const running = jobs.some((j) => j.status === "running");
  timer = setTimeout(() => {
    void refresh().then(schedule);
  }, running ? POLL_RUNNING_MS : POLL_IDLE_MS);
}

/** 지금 받고, 다음 폴링을 다시 잡는다 */
function poke() {
  void refresh().then(schedule);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) poke();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

const getSnapshot = () => jobs;
const getServerSnapshot = (): RefineJob[] => [];

/** 가장 최근 작업(회사 무관) — 사이드바 배지 */
export function useRefineJob(): RefineJob | null {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return list[0] ?? null;
}

/** 이 회사의 작업 */
export function useRefineJobFor(workspaceId: number): RefineJob | null {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return list.find((j) => j.workspaceId === workspaceId) ?? null;
}

/** 폴링과 무관하게 지금 받아 둔 값 — 상세 페이지가 첫 탭을 정할 때 */
export function getRefineJob(workspaceId: number): RefineJob | null {
  return jobs.find((j) => j.workspaceId === workspaceId) ?? null;
}

/**
 * 사이드바 배지를 눌러 회사 상세로 갈 때 — 상세 페이지가 첫 탭을 연동으로 열게 하는 한 번짜리 표시. 폴링 값은 새로고침 직후엔
 * 아직 없을 수 있어(비동기) 이 표시로 정한다
 */
let pendingOpen: number | null = null;
export function openStudioFor(workspaceId: number): void {
  pendingOpen = workspaceId;
}
export function consumePendingOpen(): number | null {
  const v = pendingOpen;
  pendingOpen = null;
  return v;
}

/** 워크스페이스 id → 스키마 이름(운영 콘솔 URL 조각). `admin-api.workspaceIdFromSchema` 의 반대 */
export function schemaOf(workspaceId: number): string {
  return `ax_${String(workspaceId).padStart(5, "0")}`;
}

/** 끝난 작업의 결과까지 — 검토 패널이 한 번 */
export const loadJob = (id: string) => fetchRefineJob(id);

/** 시작. 그 회사에 도는 작업이 있으면 false. 그 밖의 실패는 던진다 */
export async function startRefine(workspaceId: number, targets: RefineTarget[], structureOnly: boolean): Promise<boolean> {
  try {
    const job = await startRefineJob(workspaceId, targets, structureOnly);
    version += 1;
    commit([job, ...jobs.filter((j) => j.workspaceId !== workspaceId)]);
    schedule();
    return true;
  } catch (e) {
    if (e instanceof ApiRequestError && e.status === 409) {
      poke();
      return false;
    }
    throw e;
  }
}

/**
 * 검토를 끝냈거나 버렸다 — 서버 행을 지우고 배지 · 버튼이 원래대로 돌아간다. 도는 작업은 서버가 지우지 않는다.
 * 지우기가 실패하면 한 번 더 해 보고, 그래도 안 되면 다시 받아 실제 상태를 보인다 — 지운 척하고 남겨 두면 다음에 열 때
 * 같은 제안을 두 번 저장하게 된다
 */
export async function clearRefine(workspaceId: number): Promise<void> {
  const job = jobs.find((j) => j.workspaceId === workspaceId);
  if (!job || job.status === "running") return;
  version += 1;
  commit(jobs.filter((j) => j.id !== job.id));
  try {
    await deleteRefineJob(job.id);
  } catch {
    await deleteRefineJob(job.id).catch(() => undefined);
  }
  poke();
}

if (typeof window !== "undefined") {
  window.addEventListener(SESSION_CHANGED, () => {
    if (listeners.size > 0) poke();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && listeners.size > 0) poke();
  });
}
