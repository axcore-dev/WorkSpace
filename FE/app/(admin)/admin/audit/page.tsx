"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminTable, TD, TD_KEY, TR } from "@/components/admin/admin-table";
import { Breadcrumb } from "@/components/admin/breadcrumb";
import { IconAlertTriangle } from "@/components/icons";
import { Button, Card, FIELD_INLINE } from "@/components/ui";
import { AUDIT_ACTION_LABEL, type AuditAction, type AuditEntry } from "@/data/admin";
import { listAuditLogs } from "@/lib/admin-api";

const PAGE_SIZE = 20;

type ActionFilter = AuditAction | "all";

export default function AdminAuditPage() {
  /**
   * 서버 기록을 한 번에 받아 두고 거르기·페이지는 화면에서 한다.
   *
   * 감사 기록은 지우지 않아서 계속 쌓인다. 지금은 최근 500건까지만 보고, 그 이상을 뒤져야
   * 하는 시점이 오면 기간 필터와 서버 페이지네이션이 함께 필요하다.
   */
  const [log, setLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listAuditLogs({ size: 200 })
      .then((r) => {
        if (alive) setLog(r.entries);
      })
      .catch(() => {
        if (alive) setError("감사 기록을 불러오지 못했어요.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  /** 실제로 등장하는 운영자만 고른다 — 목록과 필터가 어긋나지 않게 */
  const operators = useMemo(() => [...new Set(log.map((e) => e.operator))].sort(), [log]);

  const [action, setAction] = useState<ActionFilter>("all");
  const [operator, setOperator] = useState("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () =>
      log.filter(
        (e) =>
          (action === "all" || e.action === action) &&
          (operator === "all" || e.operator === operator),
      )
        // `at`이 "YYYY-MM-DD HH:MM" 고정 폭이라 문자열 비교가 곧 시각 비교다.
        // `new Date()`를 쓰지 않는 이유는 프리렌더와 하이드레이션이 갈리기 때문이다.
        .sort((a, b) => b.at.localeCompare(a.at)),
    [log, action, operator],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  /** 필터를 바꾸면 1페이지로 */
  function reset<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "감사 로그" }]} />
      <h1 className="text-xl font-bold tracking-tight text-slate-900">감사 로그</h1>

      {error && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
          <IconAlertTriangle size={16} className="mt-0.5 shrink-0 text-red-600" />
          <p className="min-w-0 flex-1 text-sm text-red-700">{error}</p>
        </div>
      )}

      <Card className="mt-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={action}
            onChange={(e) => reset(setAction)(e.target.value as ActionFilter)}
            aria-label="동작 필터"
            className={`${FIELD_INLINE} cursor-pointer`}
          >
            <option value="all">동작: 전체</option>
            {(Object.keys(AUDIT_ACTION_LABEL) as AuditAction[]).map((a) => (
              <option key={a} value={a}>
                {AUDIT_ACTION_LABEL[a]}
              </option>
            ))}
          </select>
          <select
            value={operator}
            onChange={(e) => reset(setOperator)(e.target.value)}
            aria-label="운영자 필터"
            className={`${FIELD_INLINE} cursor-pointer`}
          >
            <option value="all">운영자: 전체</option>
            {operators.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <span className="ml-auto shrink-0 text-xs text-slate-400">
            {loading ? "불러오는 중" : `${filtered.length}건`}
          </span>
        </div>

        <div className="mt-4">
          <AdminTable columns={["시각", "운영자", "동작", "대상", "변경"]} minWidth={720}>
            {rows.map((e) => (
              <tr key={`${e.at}-${e.targetSchema}-${e.action}`} className={TR}>
                <td className={`${TD_KEY} tabular-nums`}>{e.at}</td>
                <td className={TD}>{e.operator}</td>
                <td className={TD}>{AUDIT_ACTION_LABEL[e.action]}</td>
                <td className={TD}>
                  <Link
                    href={`/admin/workspaces/${e.targetSchema}`}
                    className="font-medium text-primary-700 transition-colors hover:text-primary-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                  >
                    {e.targetName}
                  </Link>
                </td>
                <td className={TD}>{e.detail}</td>
              </tr>
            ))}
          </AdminTable>

          {filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">
              조건에 맞는 기록이 없어요. 필터를 넓혀 보세요.
            </p>
          )}
        </div>

        {pageCount > 1 && (
          <div className="mt-4 flex items-center justify-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              이전
            </Button>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
              <Button
                key={n}
                variant={n === current ? "primary" : "secondary"}
                size="sm"
                aria-current={n === current ? "page" : undefined}
                onClick={() => setPage(n)}
              >
                {n}
              </Button>
            ))}
            <Button
              variant="secondary"
              size="sm"
              disabled={current === pageCount}
              onClick={() => setPage(current + 1)}
            >
              다음
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
