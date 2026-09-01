"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { AdminTable, TD, TD_KEY, rowClick } from "@/components/admin/admin-table";
import { Breadcrumb } from "@/components/admin/breadcrumb";
import { IconDownload } from "@/components/icons";
import { Badge, Button, Card, SectionHeader } from "@/components/ui";
import {
  ADMIN_WORKSPACES,
  BILLING_STATE_LABEL,
  BILLING_TONE,
  WS_STATUS_LABEL,
  billingState,
  downloadCsv,
  toCsv,
} from "@/data/admin";

/**
 * 더미 데이터의 기준 기간. `Usage` 가 단일 객체라 과거 사용량이 없어서
 * 기간을 고를 수 없다 — 고를 수 있는 것처럼 보이지 않게 고정 표시한다.
 * 기간 비교는 BE 선행 (수정요청v9 ④ 4-1).
 */
const PERIOD = "2026년 8월 기준";

export default function AdminBillingPage() {
  const router = useRouter();

  /**
   * 회사명 순으로 정렬한다. v9까지는 예상 청구액 내림차순이었는데 그 열이 없어졌다 —
   * 보이지 않는 값으로 정렬하면 운영자가 순서를 예측할 수 없다.
   */
  const rows = useMemo(
    () => [...ADMIN_WORKSPACES].sort((a, b) => a.company.localeCompare(b.company, "ko")),
    [],
  );

  /** 지금 보는 표 그대로 내려준다 — 정렬·기간이 화면과 같아야 대조할 수 있다 */
  function download() {
    const csv = toCsv(
      ["회사명", "사업자등록번호", "요금제", "상태"],
      rows.map((w) => [
        w.company,
        w.bizNumber,
        w.plan,
        w.status === "suspended"
          ? WS_STATUS_LABEL.suspended
          : BILLING_STATE_LABEL[billingState(w)],
      ]),
    );
    downloadCsv(`사용량-요금_${PERIOD.replace(/[년월기준]/g, "").trim().replace(/\s+/g, "-")}.csv`, csv);
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "사용량 · 요금" }]} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">사용량 · 요금</h1>
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-medium text-slate-600">{PERIOD}</span>
          <Button variant="secondary" onClick={download}>
            <IconDownload size={15} />
            내려받기
          </Button>
        </div>
      </div>

      <Card className="mt-5">
        <SectionHeader title="고객사별" />
        <AdminTable columns={["회사명", "사업자등록번호", "요금제", "상태"]} minWidth={560}>
          {rows.map((w) => {
            const suspended = w.status === "suspended";
            return (
              <tr
                key={w.schemaName}
                {...rowClick(() => router.push(`/admin/workspaces/${w.schemaName}`))}
              >
                <td className={TD_KEY}>{w.company}</td>
                <td className={`${TD} tabular-nums`}>{w.bizNumber}</td>
                <td className={TD}>{w.plan}</td>
                <td className={TD}>
                  {suspended ? (
                    <Badge tone="amber">{WS_STATUS_LABEL.suspended}</Badge>
                  ) : (
                    <Badge tone={BILLING_TONE[billingState(w)]}>
                      {BILLING_STATE_LABEL[billingState(w)]}
                    </Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </AdminTable>
      </Card>
    </div>
  );
}
