"use client";

import { useMemo, useState } from "react";
import { AdminTable, TD, TD_KEY, TR } from "@/components/admin/admin-table";
import { Breadcrumb } from "@/components/admin/breadcrumb";
import { IconDownload } from "@/components/icons";
import { Badge, Button, Card, FIELD_INLINE, ProgressBar, SectionHeader } from "@/components/ui";
import {
  ADMIN_WORKSPACES,
  BILLING_STATE_LABEL,
  KRW,
  downloadCsv,
  estimateAmount,
  toCsv,
  type AdminWorkspace,
  type BillingState,
} from "@/data/admin";

/** 데모: 이번 달 + 지난 두 달만 고른다 */
const PERIODS = ["2026년 8월", "2026년 7월", "2026년 6월"];

const BILLING_TONE: Record<BillingState, "green" | "slate" | "red"> = {
  paid: "green",
  due: "slate",
  overdue: "red",
};

/** 한도 대비 사용률 — 저장 용량 기준 (요금에 가장 크게 영향) */
function usageRatio(ws: AdminWorkspace) {
  if (ws.usage.storageLimitGb === 0) return 0;
  return Math.min(100, Math.round((ws.usage.storageGb / ws.usage.storageLimitGb) * 100));
}

/** 미수금이 있으면 그게 상태다. 없으면 청구 예정 */
function billingState(ws: AdminWorkspace): BillingState {
  if (ws.invoices.some((i) => i.state === "overdue")) return "overdue";
  return "due";
}

export default function AdminBillingPage() {
  const [period, setPeriod] = useState(PERIODS[0]);

  const totals = useMemo(() => {
    const storage = ADMIN_WORKSPACES.reduce((sum, w) => sum + w.usage.storageGb, 0);
    const amount = ADMIN_WORKSPACES.reduce(
      (sum, w) => (w.status === "suspended" ? sum : sum + estimateAmount(w)),
      0,
    );
    return {
      storage,
      amount,
      nearLimit: ADMIN_WORKSPACES.filter((w) => usageRatio(w) >= 75).length,
      overdue: ADMIN_WORKSPACES.filter((w) => billingState(w) === "overdue").length,
    };
  }, []);

  const rows = useMemo(
    () => [...ADMIN_WORKSPACES].sort((a, b) => estimateAmount(b) - estimateAmount(a)),
    [],
  );

  /** 지금 보는 표 그대로 내려준다 — 정렬·기간이 화면과 같아야 대조할 수 있다 */
  function download() {
    const csv = toCsv(
      ["회사명", "사업자등록번호", "요금제", "사용량(GB)", "한도 대비(%)", "청구액(원)", "상태"],
      rows.map((w) => {
        const suspended = w.status === "suspended";
        return [
          w.company,
          w.bizNumber,
          w.plan,
          w.usage.storageGb,
          usageRatio(w),
          suspended ? "" : estimateAmount(w),
          suspended ? "중지" : BILLING_STATE_LABEL[billingState(w)],
        ];
      }),
    );
    downloadCsv(`사용량-요금_${period.replace(/[년월]/g, "").trim().replace(/\s+/g, "-")}.csv`, csv);
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "사용량 · 요금" }]} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">사용량 · 요금</h1>
          <p className="mt-0.5 text-sm text-slate-500">전체 고객사를 한 화면에서 봐요.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            aria-label="기간 선택"
            className={`${FIELD_INLINE} cursor-pointer`}
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <Button variant="secondary" onClick={download}>
            <IconDownload size={15} />
            내려받기
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "총 사용량", value: `${KRW.format(totals.storage)} GB` },
          { label: "이번 달 청구액", value: `${KRW.format(totals.amount)}원` },
          { label: "한도 임박", value: `${totals.nearLimit}곳`, warn: totals.nearLimit > 0 },
          { label: "미수금", value: `${totals.overdue}곳`, danger: totals.overdue > 0 },
        ].map((s) => (
          <Card key={s.label}>
            <p className="text-sm text-slate-500">{s.label}</p>
            <p
              className={`mt-1 text-xl font-bold tabular-nums ${
                s.danger ? "text-red-700" : s.warn ? "text-amber-700" : "text-slate-900"
              }`}
            >
              {s.value}
            </p>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <SectionHeader
          title="고객사별"
          desc="중지된 워크스페이스는 청구액에 넣지 않아요. 금액은 데모 추정값이에요."
        />
        <AdminTable
          columns={[
            "회사명",
            "사업자등록번호",
            "요금제",
            "사용량",
            "한도 대비",
            "청구액",
            "상태",
            "",
          ]}
          minWidth={900}
        >
          {rows.map((w) => {
            const pct = usageRatio(w);
            const state = billingState(w);
            const suspended = w.status === "suspended";
            return (
              <tr key={w.slug} className={TR}>
                <td className={TD_KEY}>{w.company}</td>
                <td className={`${TD} tabular-nums`}>{w.bizNumber}</td>
                <td className={TD}>{w.plan}</td>
                <td className={`${TD} tabular-nums`}>{w.usage.storageGb} GB</td>
                <td className={TD}>
                  <span className="flex items-center gap-2">
                    <span className="w-9 shrink-0 tabular-nums">{pct}%</span>
                    <ProgressBar
                      value={pct}
                      tone={pct >= 90 ? "red" : pct >= 75 ? "amber" : "slate"}
                      className="w-16"
                    />
                  </span>
                </td>
                <td className={`${TD} tabular-nums`}>
                  {suspended ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    `${KRW.format(estimateAmount(w))}원`
                  )}
                </td>
                <td className={TD}>
                  {suspended ? (
                    <Badge tone="amber">중지</Badge>
                  ) : (
                    <Badge tone={BILLING_TONE[state]}>{BILLING_STATE_LABEL[state]}</Badge>
                  )}
                </td>
                <td className={TD}>
                  <Button variant="secondary" size="sm" href={`/admin/workspaces/${w.slug}`}>
                    열기
                  </Button>
                </td>
              </tr>
            );
          })}
        </AdminTable>
      </Card>
    </div>
  );
}
