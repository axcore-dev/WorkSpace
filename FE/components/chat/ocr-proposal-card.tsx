"use client";

import { useState } from "react";
import { IconCheck, IconPencil, IconScanText, IconX } from "@/components/icons";
import { Button } from "@/components/ui";
import type { OcrProposal } from "@/data/chat";

/** OCR 반영 제안 카드 — 승인 전 필드 편집 가능 */
export function OcrProposalCard({
  proposal,
  pending,
  onResolve,
  onUpdate,
}: {
  proposal: OcrProposal;
  pending: boolean;
  onResolve: (approved: boolean) => void;
  onUpdate: (fields: { label: string; value: string }[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(proposal.fields);
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3.5 py-2.5">
        <IconScanText size={15} className="text-slate-500" />
        <p className="text-[13px] font-semibold text-slate-700">
          OCR 반영 제안 — {proposal.targetModule}
        </p>
        {pending && !editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(proposal.fields);
              setEditing(true);
            }}
            className="ml-auto inline-flex cursor-pointer items-center gap-1 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-700"
          >
            <IconPencil size={12} />
            편집
          </button>
        )}
      </div>
      {editing ? (
        <div className="divide-y divide-slate-100 px-3.5 text-[13px]">
          {draft.map((f, i) => (
            <div
              key={f.label}
              className="flex items-center justify-between gap-3 py-1.5"
            >
              <label
                htmlFor={`ocr-field-${i}`}
                className="shrink-0 text-slate-500"
              >
                {f.label}
              </label>
              <input
                id={`ocr-field-${i}`}
                value={f.value}
                onChange={(e) =>
                  setDraft((prev) =>
                    prev.map((x, j) =>
                      j === i ? { ...x, value: e.target.value } : x,
                    ),
                  )
                }
                className="w-56 max-w-full rounded-md border border-slate-300 px-2 py-1 text-right text-[13px] font-semibold text-slate-800 transition-colors focus:border-slate-400 focus:outline-none"
              />
            </div>
          ))}
        </div>
      ) : (
        <dl className="divide-y divide-slate-100 px-3.5 text-[13px]">
          {proposal.fields.map((f) => (
            <div
              key={f.label}
              className="flex items-center justify-between py-2"
            >
              <dt className="text-slate-500">{f.label}</dt>
              <dd className="font-semibold text-slate-800">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {editing ? (
        <div className="flex gap-2 border-t border-slate-100 bg-slate-50 px-3.5 py-2.5">
          <Button
            size="sm"
            onClick={() => {
              onUpdate(draft);
              setEditing(false);
            }}
          >
            <IconCheck size={13} />
            수정 내용 저장
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setEditing(false)}
          >
            취소
          </Button>
        </div>
      ) : pending ? (
        <div className="flex gap-2 border-t border-slate-100 bg-slate-50 px-3.5 py-2.5">
          <Button size="sm" onClick={() => onResolve(true)}>
            <IconCheck size={13} />
            승인하고 반영
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onResolve(false)}
          >
            <IconX size={13} />
            거절
          </Button>
        </div>
      ) : (
        <p className="border-t border-slate-100 bg-slate-50 px-3.5 py-2 text-[13px] text-slate-400">
          처리 완료된 제안입니다.
        </p>
      )}
    </div>
  );
}
