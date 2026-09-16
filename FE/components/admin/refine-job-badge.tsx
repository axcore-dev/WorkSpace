"use client";

import Link from "next/link";
import { IconSparkles } from "@/components/icons";
import { schemaOf, useRefineJob } from "@/lib/admin/refine-job";

/**
 * 사이드바 아래 「AI 로 다듬기」 진행 표시 — 운영 콘솔 어느 페이지에서든 보인다. 누르면 그 회사 상세로 간다(상세는 작업이
 * 있으면 연동 탭으로 연다). 작업이 없으면 아무것도 그리지 않는다.
 */
export function RefineJobBadge({ collapsed }: { collapsed: boolean }) {
  const job = useRefineJob();
  if (!job) return null;
  const done = job.status === "done";
  const label = done ? "다듬기 완료" : `다듬는 중 ${job.done} / ${job.targets.length}`;
  return (
    <Link
      href={`/admin/workspaces/${schemaOf(job.workspaceId)}`}
      aria-label={done ? "AI 다듬기 완료 — 검토하러 가기" : `AI 다듬기 진행 중 ${job.done} / ${job.targets.length}`}
      className={`mx-3 mb-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition-colors ${
        done ? "border-slate-800 bg-slate-800 text-white hover:bg-slate-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      } ${collapsed ? "lg:mx-2 lg:justify-center lg:px-0" : ""}`}
    >
      {done ? <IconSparkles size={14} /> : <span className="spinner" aria-hidden />}
      <span className={`min-w-0 truncate ${collapsed ? "lg:hidden" : ""}`}>
        <span className="font-medium">{label}</span>
        {done && <span className="ml-1.5 text-slate-300">검토하기</span>}
      </span>
    </Link>
  );
}
