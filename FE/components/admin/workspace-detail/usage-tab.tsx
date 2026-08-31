"use client";

import { useState } from "react";
import { AdminTable, DefinitionList, TD, TD_KEY, TR } from "@/components/admin/admin-table";
import { EditActions, Field } from "@/components/admin/form-parts";
import { IconPencil } from "@/components/icons";
import { Badge, Button, Card, FIELD, ProgressBar, SectionHeader } from "@/components/ui";
import {
  BILLING_STATE_LABEL,
  BILLING_TONE,
  PLANS,
  KRW,
  estimateAmount,
  type AdminWorkspace,
  type Plan,
} from "@/data/admin";
import type { Save } from "./shared";

/* ── 요금제·청구 정보 (사용량 탭) ── */

function PlanCard({ ws, onSave }: { ws: AdminWorkspace; onSave: Save }) {
  const [editing, setEditing] = useState(false);
  const [plan, setPlan] = useState<Plan>(ws.plan);
  const [taxEmail, setTaxEmail] = useState(ws.taxEmail);

  function open() {
    setPlan(ws.plan);
    setTaxEmail(ws.taxEmail);
    setEditing(true);
  }

  if (!editing) {
    return (
      <div>
        <div className="mb-2 flex justify-end">
          <Button variant="ghost" size="sm" onClick={open}>
            <IconPencil size={13} />
            수정
          </Button>
        </div>
        <DefinitionList
          rows={[
            ["요금제", ws.plan],
            [
              "이번 달 예상 금액",
              <span key="a" className="font-semibold tabular-nums">
                {KRW.format(estimateAmount(ws))}원
              </span>,
            ],
            ["세금계산서 수신", ws.taxEmail || "—"],
          ]}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Field id="e-plan" label="요금제" hint="바꾸면 이번 달 예상 금액이 함께 바뀌어요.">
        <select
          id="e-plan"
          value={plan}
          onChange={(e) => setPlan(e.target.value as Plan)}
          className={`${FIELD} cursor-pointer`}
        >
          {PLANS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>

      <Field id="e-tax" label="세금계산서 수신">
        <input
          id="e-tax"
          type="email"
          value={taxEmail}
          onChange={(e) => setTaxEmail(e.target.value)}
          placeholder="tax@company.co.kr"
          className={FIELD}
        />
      </Field>

      <EditActions
        onCancel={() => setEditing(false)}
        onSave={() => {
          onSave({ plan, taxEmail: taxEmail.trim() });
          setEditing(false);
        }}
      />
    </div>
  );
}

/* ────────────────────────── 사용량 · 요금 ────────────────────────── */

export function UsageTab({ ws, onSave }: { ws: AdminWorkspace; onSave: Save }) {
  const u = ws.usage;
  const bars = [
    { label: "저장 용량", used: u.storageGb, limit: u.storageLimitGb, unit: " GB" },
    { label: "조회 건수", used: u.queries, limit: u.queryLimit, unit: "회" },
    { label: "연동 동기화", used: u.syncs, limit: u.syncLimit, unit: "회" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader title="이번 달 사용량" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            {bars.map((b) => {
              const pct = b.limit ? Math.min(100, Math.round((b.used / b.limit) * 100)) : 0;
              return (
                <div key={b.label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-slate-600">{b.label}</span>
                    <span className="tabular-nums text-slate-500">
                      {KRW.format(b.used)}
                      {b.unit} / {b.limit === null ? "무제한" : `${KRW.format(b.limit)}${b.unit}`}
                    </span>
                  </div>
                  <ProgressBar
                    value={pct}
                    tone={pct >= 90 ? "red" : pct >= 75 ? "amber" : "slate"}
                    className="mt-1.5"
                  />
                  {b.limit !== null && pct >= 75 && (
                    <p className="mt-1 text-xs text-amber-700">
                      한도의 {pct}%를 썼어요. 상위 요금제를 안내할 시점이에요.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <PlanCard ws={ws} onSave={onSave} />
        </div>
      </Card>

      <Card>
        <SectionHeader title="청구 내역" />
        {ws.invoices.length === 0 ? (
          <p className="text-sm text-slate-400">아직 청구 내역이 없어요.</p>
        ) : (
          <AdminTable columns={["기간", "요금제", "사용량", "금액", "상태"]} minWidth={560}>
            {ws.invoices.map((iv) => (
              <tr key={iv.period} className={TR}>
                <td className={`${TD_KEY} tabular-nums`}>{iv.period}</td>
                <td className={TD}>{iv.plan}</td>
                <td className={`${TD} tabular-nums`}>{iv.usage}</td>
                <td className={`${TD} tabular-nums`}>{KRW.format(iv.amount)}원</td>
                <td className={TD}>
                  <Badge tone={BILLING_TONE[iv.state]}>{BILLING_STATE_LABEL[iv.state]}</Badge>
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </Card>
    </div>
  );
}
