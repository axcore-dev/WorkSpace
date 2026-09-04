"use client";

import { useState } from "react";
import { DataTable } from "@/components/settings/company/data-table";
import { IconPlus } from "@/components/icons";
import { Button } from "@/components/ui";
import { PENDING_INVITES } from "@/data/org";

/**
 * 초대 관리 › 초대 중인 구성원 탭.
 *
 * 열은 **초대 메일 발송일 · 이메일 · 초대 메일 유효기간 · 권한** (수정요청 v12).
 * 이름을 열에서 뺐다 — 아직 들어오지 않은 사람이라 이름은 초대할 때 적은 값이고,
 * 실제로 식별되는 건 메일 주소다.
 *
 * **BE 연동 seam**: `resend`·`cancel`이 초대 메일 재발송·초대 취소 API를 부른다.
 * 운영자 콘솔 쪽에는 이미 초대 발급·목록·취소가 있다(`lib/admin-api.ts`) — 고객
 * 워크스페이스 관리자용 엔드포인트가 생기면 그걸 부른다.
 */
export function PendingInvites({
  onSaved,
  onInvite,
}: {
  onSaved: (message: string) => void;
  onInvite: () => void;
}) {
  const [pending, setPending] = useState(PENDING_INVITES);

  function resend(id: string) {
    const who = pending.find((p) => p.id === id)?.email ?? "구성원";
    onSaved(`${who}에게 초대를 다시 보냈어요`);
  }

  function cancel(id: string) {
    const who = pending.find((p) => p.id === id)?.email ?? "구성원";
    setPending((prev) => prev.filter((p) => p.id !== id));
    onSaved(`${who} 초대를 취소했어요`);
  }

  return (
    <>
      <div className="flex items-center justify-end pt-4">
        <Button size="sm" onClick={onInvite}>
          <IconPlus size={14} />
          구성원 초대하기
        </Button>
      </div>

      <DataTable
        rows={pending}
        rowKey={(p) => p.id}
        columns={[
          { label: "초대 메일 발송일", cell: (p) => <span className="text-slate-600">{p.sentAt}</span> },
          { label: "이메일", cell: (p) => <span className="font-medium text-slate-900">{p.email}</span> },
          { label: "초대 메일 유효기간", cell: (p) => <span className="text-slate-500">{p.expiresAt}</span> },
          { label: "권한", cell: (p) => <span className="text-slate-600">{p.role}</span> },
          {
            label: "",
            right: true,
            cell: (p) => (
              <span className="inline-flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => resend(p.id)}>
                  다시 보내기
                </Button>
                <Button variant="ghost" size="sm" onClick={() => cancel(p.id)}>
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
