"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Breadcrumb } from "@/components/admin/breadcrumb";
import { IconCheckCircle } from "@/components/icons";
import { Badge, Button, Card } from "@/components/ui";
import {
  ADMIN_WORKSPACES,
  TASK_ACTION,
  TASK_LABEL,
  pendingTasks,
  type Task,
  type TaskKind,
} from "@/data/admin";

/** 신호별 색 — 고객이 지금 피해를 보는 것과 돈이 걸린 것만 빨강 */
const TONE: Record<TaskKind, "red" | "amber" | "slate"> = {
  integration: "red",
  link: "amber",
  overdue: "red",
  limit: "slate",
};

const ORDER: TaskKind[] = ["integration", "link", "overdue", "limit"];

export default function AdminDashboardPage() {
  const [kind, setKind] = useState<TaskKind | "all">("all");

  const tasks = useMemo(() => pendingTasks(), []);
  const counts = useMemo(
    () =>
      ORDER.reduce(
        (acc, k) => ({ ...acc, [k]: tasks.filter((t) => t.kind === k).length }),
        {} as Record<TaskKind, number>,
      ),
    [tasks],
  );

  const shown = kind === "all" ? tasks : tasks.filter((t) => t.kind === kind);
  const groups = ORDER.map((k) => ({ kind: k, rows: shown.filter((t) => t.kind === k) })).filter(
    (g) => g.rows.length > 0,
  );

  const live = ADMIN_WORKSPACES.filter((w) => w.status === "live").length;

  return (
    <div>
      <Breadcrumb items={[{ label: "대시보드" }]} />
      <h1 className="text-xl font-bold tracking-tight text-slate-900">대시보드</h1>
      <p className="mt-0.5 text-sm text-slate-500">
        {tasks.length > 0
          ? `지금 손볼 것 ${tasks.length}건이에요.`
          : "지금 손볼 것이 없어요."}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ORDER.map((k) => {
          const n = counts[k];
          const on = kind === k;
          return (
            <button
              key={k}
              type="button"
              disabled={n === 0}
              aria-pressed={on}
              onClick={() => setKind(on ? "all" : k)}
              className={`cursor-pointer rounded-xl border px-4 py-3.5 text-left transition-colors disabled:cursor-default disabled:opacity-50 ${
                on
                  ? "border-slate-400 bg-slate-50"
                  : "border-slate-200 bg-white hover:border-slate-300 enabled:hover:bg-slate-50/70"
              }`}
            >
              <p className="truncate text-sm text-slate-500">{TASK_LABEL[k]}</p>
              <p
                className={`mt-1 text-2xl font-bold tabular-nums ${
                  n === 0
                    ? "text-slate-400"
                    : TONE[k] === "red"
                      ? "text-red-700"
                      : TONE[k] === "amber"
                        ? "text-amber-700"
                        : "text-slate-900"
                }`}
              >
                {n}
              </p>
            </button>
          );
        })}
      </div>

      {kind !== "all" && (
        <div className="mt-3">
          <Button variant="ghost" size="sm" onClick={() => setKind("all")}>
            {TASK_LABEL[kind]}만 보는 중 · 전체 보기
          </Button>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {groups.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <IconCheckCircle size={36} className="text-emerald-600" />
              <p className="mt-3 text-sm font-semibold text-slate-900">밀린 일이 없어요</p>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                연동 실패·미개봉 링크·미수금·한도 임박이 모두 없습니다.
              </p>
              <Button variant="secondary" className="mt-5" href="/admin/workspaces">
                워크스페이스 목록
              </Button>
            </div>
          </Card>
        ) : (
          groups.map((g) => <TaskGroup key={g.kind} kind={g.kind} rows={g.rows} />)
        )}
      </div>

      <p className="mt-5 text-sm text-slate-500">
        운영 중 <span className="font-semibold text-slate-800">{live}곳</span> · 전체{" "}
        <span className="font-semibold text-slate-800">{ADMIN_WORKSPACES.length}곳</span> ·{" "}
        <Link
          href="/admin/workspaces"
          className="font-medium text-primary-700 transition-colors hover:text-primary-800"
        >
          워크스페이스 목록
        </Link>
      </p>
    </div>
  );
}

function TaskGroup({ kind, rows }: { kind: TaskKind; rows: Task[] }) {
  return (
    <Card padding={false}>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3.5">
        <Badge tone={TONE[kind]}>{TASK_LABEL[kind]}</Badge>
        <span className="text-xs tabular-nums text-slate-400">{rows.length}건</span>
        <span className="ml-auto text-xs text-slate-500">{TASK_ACTION[kind]}</span>
      </div>

      <ul className="divide-y divide-slate-100">
        {rows.map((t, i) => (
          <li
            key={`${t.kind}-${t.slug}-${i}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-slate-50/70"
          >
            <div className="min-w-0 flex-1 basis-64">
              <p className="truncate text-sm font-medium text-slate-900">{t.company}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">{t.detail}</p>
            </div>
            <span className="shrink-0 text-xs text-slate-400">{t.since}</span>
            <Button variant="secondary" size="sm" href={`/admin/workspaces/${t.slug}`}>
              열기
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
