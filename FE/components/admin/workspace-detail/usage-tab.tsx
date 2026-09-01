"use client";

import { useState } from "react";
import { AdminTable, DefinitionList, TD, TD_KEY, TR } from "@/components/admin/admin-table";
import { Field } from "@/components/admin/form-parts";
import { Badge, Card, FIELD, SectionHeader } from "@/components/ui";
import {
  BILLING_STATE_LABEL,
  BILLING_TONE,
  PLANS,
  KRW,
  estimateAmount,
  type AdminWorkspace,
  type Plan,
} from "@/data/admin";
import { EditHeader, EditModal, type Save } from "./shared";

/* ── 요금제 ── */

function PlanCard({ ws, onSave }: { ws: AdminWorkspace; onSave: Save }) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<Plan>(ws.plan);
  const [taxEmail, setTaxEmail] = useState(ws.taxEmail);

  return (
    <Card>
      <EditHeader
        title="요금제"
        onEdit={() => {
          setPlan(ws.plan);
          setTaxEmail(ws.taxEmail);
          setOpen(true);
        }}
      />

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

      <EditModal
        open={open}
        onClose={() => setOpen(false)}
        title="요금제 수정"
        onSave={() => {
          onSave({ plan, taxEmail: taxEmail.trim() });
          setOpen(false);
        }}
      >
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
      </EditModal>
    </Card>
  );
}

/* ────────────────────────── 사용량 · 요금 ────────────────────────── */

export function UsageTab({ ws, onSave }: { ws: AdminWorkspace; onSave: Save }) {
  return (
    <div className="space-y-4">
      <PlanCard ws={ws} onSave={onSave} />

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
