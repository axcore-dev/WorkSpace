"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

/**
 * 계정 페이지 꼬리말 — 사용자 ID.
 *
 * **섹션이 아니라 꼬리말이다.** 문의할 때 한 번 복사하는 값이라, 제목 + 실선을 두른 섹션으로
 * 두면 프로필·보안·기기와 같은 급으로 보인다. 페이지 맨 아래 한 줄로 내린다.
 */
export function UserIdFooter({
  userId,
  onSaved,
}: {
  /** `shared.users.id` — 문의할 때 우리 쪽이 계정을 특정하는 값이다 */
  userId: string;
  /** 복사 실패는 에러 톤으로 알려야 해서 tone까지 받는다 */
  onSaved: (message: string, tone?: "ink" | "error") => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(userId);
      setCopied(true);
      onSaved("사용자 ID를 복사했어요");
    } catch {
      onSaved("복사하지 못했어요. 직접 선택해 주세요", "error");
    }
  }

  return (
    <div className="mt-10 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-slate-100 pt-3.5">
      <span className="text-[11px] text-slate-400">사용자 ID</span>
      <code className="min-w-0 truncate font-mono text-[11.5px] text-slate-400">
        {userId}
      </code>
      <Button variant="ghost" size="sm" onClick={() => void copyId()}>
        {copied ? "복사됨" : "복사"}
      </Button>
    </div>
  );
}
