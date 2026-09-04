"use client";

import { useState } from "react";
import {
  SettingsRow,
  SettingsRows,
  SettingsSection,
} from "@/components/settings/settings-section";
import { Button } from "@/components/ui";
import { DEMO_USER } from "@/data/org";

/**
 * 계정 › 사용자 ID.
 *
 * 문의할 때 "누구인지"를 대는 값이다. 지원 섹션(운영팀 임시 접근·나가기 요청)과 한 파일에
 * 있었는데 그쪽이 없어져서(수정요청 v12) 따로 남았다 — 지원 창구가 사라져도 자기 식별자는
 * 필요하다.
 */
export function UserIdSection({
  onSaved,
}: {
  /** 복사 실패는 에러 톤으로 알려야 해서 tone까지 받는다 */
  onSaved: (message: string, tone?: "ink" | "error") => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(DEMO_USER.userId);
      setCopied(true);
      onSaved("사용자 ID를 복사했어요");
    } catch {
      onSaved("복사하지 못했어요. 직접 선택해 주세요", "error");
    }
  }

  return (
    <SettingsSection title="사용자 ID">
      <SettingsRows tight>
        <SettingsRow>
          <div className="flex items-center gap-3">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">
              {DEMO_USER.userId}
            </code>
            <Button variant="secondary" size="sm" onClick={() => void copyId()}>
              {copied ? "복사됨" : "복사"}
            </Button>
          </div>
        </SettingsRow>
      </SettingsRows>
    </SettingsSection>
  );
}
