"use client";

import { useState } from "react";
import {
  ActionRow,
  SettingsRow,
  SettingsRows,
} from "@/components/settings/settings-section";
import { IconPlus } from "@/components/icons";
import { Badge, Button } from "@/components/ui";
import { PENDING_INVITES } from "@/data/org";

/**
 * 초대 관리 › 초대 중인 구성원 탭.
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
    const who = pending.find((p) => p.id === id)?.name ?? "구성원";
    onSaved(`${who}에게 초대를 다시 보냈어요`);
  }

  function cancel(id: string) {
    const who = pending.find((p) => p.id === id)?.name ?? "구성원";
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

      {pending.length === 0 ? (
        <p className="py-10 text-center text-[13.5px] text-slate-400">초대 중인 사람이 없어요.</p>
      ) : (
        <div className="mt-2">
          <SettingsRows tight>
            {pending.map((p) => (
              <SettingsRow key={p.id}>
                <ActionRow name={p.name} value={`${p.email} · ${p.dept} · ${p.role}`}>
                  <Badge tone="amber">{p.sentAt}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => resend(p.id)}>
                    다시 보내기
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => cancel(p.id)}>
                    취소
                  </Button>
                </ActionRow>
              </SettingsRow>
            ))}
          </SettingsRows>
          <p className="mt-3 text-xs text-slate-400">7일이 지나면 저절로 만료돼요.</p>
        </div>
      )}
    </>
  );
}
