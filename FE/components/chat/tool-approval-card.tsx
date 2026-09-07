"use client";

import { IconCheck, IconShield, IconX } from "@/components/icons";
import { Button } from "@/components/ui";
import type { ToolApproval } from "@/data/chat";

/**
 * 도구 실행 승인 카드.
 *
 * 되돌리기 어려운 도구(외부 앱에 쓰기, 전표 등록 등)는 모델이 제안만 하고 여기서 사람이 결정한다.
 * 입력값을 그대로 보여 주는 이유: 무엇이 실행될지 모르는 채로 승인 버튼을 누르게 하면 안 된다.
 * 결정은 서버가 자기 감사 기록의 입력으로 실행하므로, 화면에서 값을 고칠 수 없다(OCR 제안 카드와 다르다).
 */
export function ToolApprovalCard({
  approval,
  disabled,
  onDecide,
}: {
  approval: ToolApproval;
  /** 다른 답변 생성 중에는 결정을 막는다 */
  disabled: boolean;
  onDecide: (approved: boolean) => void;
}) {
  const decided = approval.decision;
  const input = formatInput(approval.input);
  return (
    <div className="agent-fade mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 text-[14px]">
      <div className="flex items-center gap-2 font-semibold text-slate-800">
        <IconShield size={15} className="text-amber-600" />
        {decided
          ? `도구 실행 ${decided === "approved" ? "승인됨" : "거절됨"}`
          : "도구 실행 승인이 필요해요"}
      </div>
      <p className="mt-1.5 text-slate-600">
        <span className="font-medium text-slate-800">{approval.label}</span>
        <span className="ml-1.5 font-mono text-[12px] text-slate-400">{approval.toolName}</span>
      </p>
      {input && (
        <pre className="thin-scroll mt-2 max-h-48 overflow-auto rounded-lg bg-white/80 px-3 py-2 font-mono text-[12.5px] leading-relaxed text-slate-700">
          {input}
        </pre>
      )}
      {!decided && (
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" onClick={() => onDecide(true)} disabled={disabled}>
            <IconCheck size={13} />
            승인하고 실행
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onDecide(false)} disabled={disabled}>
            <IconX size={13} />
            거절
          </Button>
        </div>
      )}
    </div>
  );
}

function formatInput(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
