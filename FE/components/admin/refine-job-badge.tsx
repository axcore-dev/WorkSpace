"use client";

import Link from "next/link";
import { IconAlertCircle, IconSparkles } from "@/components/icons";
import { openStudioFor, schemaOf, useRefineJob } from "@/lib/admin/refine-job";

/**
 * 사이드바 아래 「AI 로 다듬기」 진행 표시 — 운영 콘솔 어느 페이지에서든 보인다. 누르면 그 회사 상세로 간다(상세는 작업이
 * 있으면 연동 탭으로 연다). 작업이 없으면 아무것도 그리지 않는다. 세 상태: 도는 중 · 완료(검토 대기) · 실패.
 */
export function RefineJobBadge({ collapsed }: { collapsed: boolean }) {
  const job = useRefineJob();
  if (!job) return null;
  const total = job.targets.length;
  const label = job.status === "done" ? "다듬기 완료" : job.status === "failed" ? "다듬기 실패" : `다듬는 중 ${job.done} / ${total}`;
  const aria = job.status === "done" ? "AI 다듬기 완료 — 검토하러 가기" : job.status === "failed" ? "AI 다듬기 실패 — 보러 가기" : `AI 다듬기 진행 중 ${job.done} / ${total}`;
  const tone =
    job.status === "done"
      ? "border-slate-800 bg-slate-800 text-white hover:bg-slate-700"
      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
  return (
    <Link
      href={`/admin/workspaces/${schemaOf(job.workspaceId)}`}
      onClick={() => openStudioFor(job.workspaceId)}
      aria-label={aria}
      className={`mx-3 mb-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition-colors ${tone} ${collapsed ? "lg:mx-2 lg:justify-center lg:px-0" : ""}`}
    >
      {job.status === "done" ? (
        <IconSparkles size={14} />
      ) : job.status === "failed" ? (
        <IconAlertCircle size={14} className="text-red-600" />
      ) : (
        <span className="spinner" aria-hidden />
      )}
      <span className={`min-w-0 truncate ${collapsed ? "lg:hidden" : ""}`}>
        <span className="font-medium">{label}</span>
        {job.status === "done" && <span className="ml-1.5 text-slate-300">검토하기</span>}
        {job.status === "failed" && <span className="ml-1.5 text-slate-500">보기</span>}
      </span>
    </Link>
  );
}
