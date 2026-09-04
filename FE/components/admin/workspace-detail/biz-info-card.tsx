"use client";

import { useState } from "react";
import { DefinitionList } from "@/components/admin/admin-table";
import { Field } from "@/components/admin/form-parts";
import { EditHeader, EditModal, type Save } from "./shared";
import { Card, FIELD } from "@/components/ui";
import type { AdminWorkspace } from "@/data/admin";

/* ── 사업자 정보 ── */

export function BizInfoCard({ ws, onSave }: { ws: AdminWorkspace; onSave: Save }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(ws);

  return (
    <Card>
      <EditHeader
        title="사업자 정보"
        onEdit={() => {
          setD(ws);
          setOpen(true);
        }}
      />

      <DefinitionList
        rows={[
          ["사업자등록번호", <span key="b" className="tabular-nums">{ws.bizNumber}</span>],
          ["법인등록번호", <span key="c" className="tabular-nums">{ws.corpNumber || "—"}</span>],
          ["회사명", ws.company],
          ["업태 / 업종", `${ws.bizType || "—"} / ${ws.bizItem || "—"}`],
          ["본사 주소", ws.address],
          [
            "웹사이트",
            ws.website ? (
              <a
                key="w"
                // 스킴 없이 저장된 값("hanbit-steel.co.kr")을 그대로 href 에 넣으면 상대 경로로 해석돼
                // 새 탭이 /admin/workspaces/hanbit-steel.co.kr 로 열린다. 스킴이 없으면 https 를 붙인다.
                href={/^https?:\/\//i.test(ws.website) ? ws.website : `https://${ws.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-700 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-primary-800"
              >
                {ws.website.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              "—"
            ),
          ],
        ]}
      />

      <EditModal
        open={open}
        onClose={() => setOpen(false)}
        title="사업자 정보 수정"
        size="lg"
        canSave={!!d.company.trim() && !!d.address.trim()}
        onSave={() => {
          onSave({
            company: d.company.trim(),
            corpNumber: d.corpNumber.trim(),
            bizType: d.bizType.trim(),
            bizItem: d.bizItem.trim(),
            address: d.address.trim(),
            website: d.website.trim(),
          });
          setOpen(false);
        }}
      >
        <Field
          id="e-biz"
          label="사업자등록번호"
          hint="테넌트를 식별하는 키라 바꿀 수 없어요. 잘못 등록했다면 새로 개설해야 해요."
        >
          <input
            id="e-biz"
            value={ws.bizNumber}
            disabled
            className={`${FIELD} bg-slate-50 tabular-nums text-slate-400`}
          />
        </Field>

        <Field id="e-company" label="회사명" required>
          <input
            id="e-company"
            value={d.company}
            onChange={(e) => setD({ ...d, company: e.target.value })}
            className={FIELD}
          />
        </Field>

        <Field id="e-corp" label="법인등록번호">
          <input
            id="e-corp"
            value={d.corpNumber}
            onChange={(e) => setD({ ...d, corpNumber: e.target.value })}
            placeholder="000000-0000000"
            className={`${FIELD} tabular-nums`}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="e-type" label="업태">
            <input
              id="e-type"
              value={d.bizType}
              onChange={(e) => setD({ ...d, bizType: e.target.value })}
              className={FIELD}
            />
          </Field>
          <Field id="e-item" label="업종">
            <input
              id="e-item"
              value={d.bizItem}
              onChange={(e) => setD({ ...d, bizItem: e.target.value })}
              className={FIELD}
            />
          </Field>
        </div>

        <Field id="e-addr" label="본사 주소" required>
          <input
            id="e-addr"
            value={d.address}
            onChange={(e) => setD({ ...d, address: e.target.value })}
            className={FIELD}
          />
        </Field>

        <Field id="e-web" label="웹사이트">
          <input
            id="e-web"
            value={d.website}
            onChange={(e) => setD({ ...d, website: e.target.value })}
            placeholder="https://"
            className={FIELD}
          />
        </Field>
      </EditModal>
    </Card>
  );
}
