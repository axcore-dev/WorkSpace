/**
 * 「AI 로 다듬기」 — 클라이언트 절반. 작업은 AI 서버가 든다(`app/ai/ontology/refine/jobs/*`, `shared.ai_refine_jobs`).
 * 화면은 시작 · 폴링 · 결과 받기 · 지우기만 한다. 저장은 검토 패널이 기존 `updateConcept` · `createConcept` · `deleteConcept` 으로.
 */
import { aiCall } from "./client";
import type { RefineJob, RefineTarget } from "./refine-types";
import { ONTOLOGY_REFINE_JOBS_ENDPOINT } from "./transport";

/** 도는 · 끝난 작업 전부(회사당 하나), 결과(items) 없이. 사이드바 배지와 스튜디오가 폴링한다 */
export const listRefineJobs = () => aiCall<RefineJob[]>(ONTOLOGY_REFINE_JOBS_ENDPOINT, {}, "작업 상태를 받지 못했어요");

/** 한 건, 결과까지 — 검토 패널이 끝난 작업을 열 때 */
export const getRefineJob = (id: string) =>
  aiCall<RefineJob>(`${ONTOLOGY_REFINE_JOBS_ENDPOINT}/${encodeURIComponent(id)}`, {}, "제안을 받지 못했어요");

/** 시작. 그 회사에 도는 작업이 있으면 409 `REFINE_RUNNING` */
export const startRefineJob = (workspaceId: number, targets: RefineTarget[], structureOnly: boolean) =>
  aiCall<RefineJob>(ONTOLOGY_REFINE_JOBS_ENDPOINT, { method: "POST", body: JSON.stringify({ workspaceId, targets, structureOnly }) }, "제안을 받지 못했어요");

/** 검토를 끝냈거나 버렸다. 도는 작업이면 서버가 지우지 않고 204 만 준다 */
export const deleteRefineJob = (id: string) =>
  aiCall<void>(`${ONTOLOGY_REFINE_JOBS_ENDPOINT}/${encodeURIComponent(id)}`, { method: "DELETE" }, "작업을 지우지 못했어요");
