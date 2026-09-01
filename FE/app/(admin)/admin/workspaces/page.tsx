"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminTable, TD, TD_KEY, rowClick } from "@/components/admin/admin-table";
import { Breadcrumb } from "@/components/admin/breadcrumb";
import { IconPlus, IconSearch } from "@/components/icons";
import { Badge, Button, Card, FIELD, FIELD_INLINE } from "@/components/ui";
import {
  ADMIN_WORKSPACES,
  WS_STATUS_LABEL,
  integrationHealth,
  type IntegrationHealth,
  type WsStatus,
} from "@/data/admin";

const PAGE_SIZE = 20;

const STATUS_TONE: Record<WsStatus, "green" | "slate" | "amber"> = {
  active: "green",
  pending: "slate",
  suspended: "amber",
};

type StatusFilter = WsStatus | "all";
type HealthFilter = IntegrationHealth | "all";

export default function AdminWorkspaceListPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [health, setHealth] = useState<HealthFilter>("all");
  const [page, setPage] = useState(1);

  /**
   * 세 칸이 전체를 분할하지 않는다 — `pending`은 「전체」에만 들어간다.
   * 아직 활성도 비활성도 아니기 때문이다. 상태 필터에는 3종이 모두 남는다.
   */
  const counts = useMemo(
    () => ({
      total: ADMIN_WORKSPACES.length,
      active: ADMIN_WORKSPACES.filter((w) => w.status === "active").length,
      suspended: ADMIN_WORKSPACES.filter((w) => w.status === "suspended").length,
    }),
    [],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "");
    return ADMIN_WORKSPACES.filter((w) => {
      if (status !== "all" && w.status !== status) return false;
      if (health !== "all" && integrationHealth(w) !== health) return false;
      if (!needle) return true;
      // 사업자번호는 하이픈을 빼고 비교한다 — 운영자가 붙여넣는 형태가 일정하지 않다.
      const hit =
        w.company.toLowerCase().includes(needle) ||
        w.schemaName.includes(needle) ||
        (digits.length > 0 && w.bizNumber.replace(/\D/g, "").includes(digits));
      return hit;
    });
  }, [q, status, health]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  /** 필터를 바꾸면 1페이지로 — 3페이지를 보다 필터를 좁히면 빈 화면이 된다 */
  function reset<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "워크스페이스" }]} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">워크스페이스</h1>
        <Button href="/admin/new">
          <IconPlus size={15} />
          워크스페이스 만들기
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {[
          { label: "전체", value: counts.total },
          { label: WS_STATUS_LABEL.active, value: counts.active },
          { label: WS_STATUS_LABEL.suspended, value: counts.suspended },
        ].map((s) => (
          <Card key={s.label}>
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{s.value}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-0 flex-1 basis-56">
            <IconSearch
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={q}
              onChange={(e) => reset(setQ)(e.target.value)}
              placeholder="회사명 · 사업자등록번호 · 스키마 이름"
              aria-label="워크스페이스 검색"
              className={`${FIELD} pl-9`}
            />
          </div>
          <select
            value={status}
            onChange={(e) => reset(setStatus)(e.target.value as StatusFilter)}
            aria-label="상태 필터"
            className={`${FIELD_INLINE} cursor-pointer`}
          >
            <option value="all">상태: 전체</option>
            {(Object.keys(WS_STATUS_LABEL) as WsStatus[]).map((s) => (
              <option key={s} value={s}>
                {WS_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            value={health}
            onChange={(e) => reset(setHealth)(e.target.value as HealthFilter)}
            aria-label="온톨로지 필터"
            className={`${FIELD_INLINE} cursor-pointer`}
          >
            <option value="all">온톨로지: 전체</option>
            <option value="ok">정상</option>
            <option value="error">오류</option>
            <option value="none">미연결</option>
          </select>
          <span className="ml-auto shrink-0 text-xs text-slate-400">{filtered.length}건</span>
        </div>

        <div className="mt-4">
          <AdminTable
            columns={["회사명", "사업자등록번호", "상태", "멤버", "온톨로지"]}
            minWidth={640}
          >
            {rows.map((w) => {
              const h = integrationHealth(w);
              return (
                <tr
                  key={w.schemaName}
                  {...rowClick(() => router.push(`/admin/workspaces/${w.schemaName}`))}
                >
                  <td className={TD_KEY}>
                    <Link
                      href={`/admin/workspaces/${w.schemaName}`}
                      className="transition-colors hover:text-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                    >
                      {w.company}
                    </Link>
                  </td>
                  <td className={`${TD} tabular-nums`}>{w.bizNumber}</td>
                  <td className={TD}>
                    <Badge tone={STATUS_TONE[w.status]}>{WS_STATUS_LABEL[w.status]}</Badge>
                  </td>
                  <td className={`${TD} tabular-nums`}>{w.members.length}</td>
                  <td className={TD}>
                    {h === "error" ? (
                      <Badge tone="red">연동 오류</Badge>
                    ) : (
                      <span className={h === "none" ? "text-slate-400" : undefined}>
                        {w.systems.length > 0 ? w.systems.map((s) => s.kind).join("·") : "미연결"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </AdminTable>

          {filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">
              조건에 맞는 워크스페이스가 없어요. 검색어나 필터를 넓혀 보세요.
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
