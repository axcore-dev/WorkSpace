"use client";

import { useState } from "react";
import { DataTable } from "@/components/settings/company/data-table";
import { IconPlus } from "@/components/icons";
import { Button } from "@/components/ui";
import { ApiRequestError } from "@/lib/api";
import { resendInvitation, revokeInvitation, type PendingInvitationDto } from "@/lib/workspace-api";

/** `YYYY-MM-DD` — 표의 열이라 절대 날짜다. "3일 전"은 정렬도 비교도 안 된다. sv-SE 로캘이 이 모양을 낸다 */
const ymd = (iso: string) => new Date(iso).toLocaleDateString("sv-SE");

/**
 * 초대 관리 › 초대 중인 구성원 탭.
 *
 * 열은 **초대 메일 발송일 · 이메일 · 초대 메일 유효기간 · 권한** (수정요청 v12).
 * 이름을 열에서 뺐다 — 아직 들어오지 않은 사람이라 이름은 초대할 때 적은 값이고,
 * 실제로 식별되는 건 메일 주소다.
 *
 * 「다시 보내기」는 새 링크를 만들어 다시 메일로 보낸다 — 이전 링크는 그 순간 죽는다. 「취소」는 링크를 회수한다.
 * 둘 다 서버(`/api/workspace/invitations/{id}/resend` · `DELETE`)가 하고 목록을 다시 받는다.
 */
export function PendingInvites({
  pending,
  canManage,
  onSaved,
  onInvite,
  onChanged,
}: {
  pending: PendingInvitationDto[];
  /** 소유자만 초대·재발송·취소 버튼을 본다 */
  canManage: boolean;
  onSaved: (message: string, tone?: "ink" | "error") => void;
  onInvite: () => void;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function run(id: string, action: () => Promise<unknown>, done: string, fail: string) {
    setBusy(id);
    try {
      await action();
      await onChanged();
      onSaved(done);
    } catch (e) {
      onSaved(e instanceof ApiRequestError ? e.body.message : fail, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {canManage && (
        <div className="flex items-center justify-end pt-4">
          <Button size="sm" onClick={onInvite}>
            <IconPlus size={14} />
            구성원 초대하기
          </Button>
        </div>
      )}

      <DataTable
        rows={pending}
        rowKey={(p) => p.id}
        empty="초대 중인 구성원이 없어요"
        columns={[
          { label: "초대 메일 발송일", cell: (p) => <span className="text-slate-600">{ymd(p.createdAt)}</span> },
          { label: "이메일", cell: (p) => <span className="font-medium text-slate-900">{p.email}</span> },
          { label: "초대 메일 유효기간", cell: (p) => <span className="text-slate-500">{ymd(p.expiresAt)}</span> },
          {
            label: "권한",
            cell: (p) => (
              <span className="text-slate-600">
                {p.roleName ?? "구성원"}
                {p.departmentName && <span className="ml-1.5 text-xs text-slate-400">{p.departmentName}</span>}
              </span>
            ),
          },
          {
            label: "",
            right: true,
            cell: (p) =>
              canManage && (
              <span className="inline-flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy === p.id}
                  onClick={() =>
                    void run(p.id, () => resendInvitation(p.id), `${p.email}에게 초대를 다시 보냈어요`, "다시 보내지 못했어요")
                  }
                >
                  다시 보내기
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy === p.id}
                  onClick={() =>
                    void run(p.id, () => revokeInvitation(p.id), `${p.email} 초대를 취소했어요`, "취소하지 못했어요")
                  }
                >
                  취소
                </Button>
              </span>
              ),
          },
        ]}
      />
    </>
  );
}
