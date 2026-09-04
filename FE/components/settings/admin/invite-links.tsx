"use client";

import { useState } from "react";
import {
  ActionRow,
  SettingsRow,
  SettingsRows,
} from "@/components/settings/settings-section";
import { IconInfo, IconPlus } from "@/components/icons";
import { Badge, Button } from "@/components/ui";
import { INVITE_LINKS } from "@/data/org";

/**
 * 초대 관리 › 초대 링크 탭.
 *
 * **BE 연동 seam**: `stopLink`·`deleteLink`가 링크 회수·삭제 API를 부른다.
 * `링크 만들기`는 역할·부서·횟수·만료일을 정하는 모달이 필요하다 — 다음 작업이다.
 */
export function InviteLinks({
  onSaved,
}: {
  onSaved: (message: string, tone?: "ink" | "error") => void;
}) {
  const [links, setLinks] = useState(INVITE_LINKS);

  function stopLink(id: string) {
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, active: false } : l)));
    onSaved("초대 링크를 중지했어요");
  }

  function deleteLink(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
    onSaved("초대 링크를 지웠어요");
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      onSaved("링크를 복사했어요");
    } catch {
      onSaved("복사하지 못했어요. 직접 선택해 주세요", "error");
    }
  }

  return (
    <>
      <div className="flex items-center justify-end pt-4">
        <Button variant="secondary" size="sm">
          <IconPlus size={14} />
          링크 만들기
        </Button>
      </div>

      {links.length === 0 ? (
        <p className="py-10 text-center text-[13.5px] text-slate-400">만든 링크가 없어요.</p>
      ) : (
        <div className="mt-2">
          <SettingsRows>
            {links.map((l) => (
              <SettingsRow key={l.id}>
                <ActionRow
                  name={`${l.role} · ${l.dept}`}
                  value={`${l.limit}회 중 ${l.used}회 사용 · ${l.expiresIn}`}
                >
                  <Badge tone={l.active ? "green" : "slate"}>
                    {l.active ? "쓸 수 있어요" : "만료"}
                  </Badge>
                  {l.active ? (
                    <Button variant="ghost" size="sm" onClick={() => stopLink(l.id)}>
                      중지
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => deleteLink(l.id)}>
                      삭제
                    </Button>
                  )}
                </ActionRow>
                {l.active && (
                  <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 py-1.5 pl-3 pr-1.5">
                    <code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-600">
                      {l.url}
                    </code>
                    <Button variant="secondary" size="sm" onClick={() => void copyLink(l.url)}>
                      복사
                    </Button>
                  </div>
                )}
              </SettingsRow>
            ))}
          </SettingsRows>
          <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-400">
            <IconInfo size={14} className="mt-0.5 shrink-0" />
            링크는 받은 사람 누구나 쓸 수 있어요. 역할·부서를 미리 박아두고 사용 횟수와
            만료일을 함께 정해요.
          </p>
        </div>
      )}
    </>
  );
}
