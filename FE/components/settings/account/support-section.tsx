"use client";

import { useState } from "react";
import {
  ActionRow,
  SettingsRow,
  SettingsRows,
  SettingsSection,
} from "@/components/settings/settings-section";
import { Button, Toggle } from "@/components/ui";
import { DEMO_USER } from "@/data/org";

/**
 * 계정 › 지원 + 사용자 ID.
 *
 * **계정 삭제를 두지 않는다.** `receiving-inspection.tsx`의 수입검사 표에 `검사자` 열이
 * 있어 사람 이름이 검사 기록에 남는다 — 계정을 지우면 감사 추적이 끊긴다. 워크스페이스도
 * 계약으로 운영팀이 개설하니 개인이 스스로 빠지는 건 관리자 일이다. 그래서 `나가기 요청`이다.
 *
 * **운영팀 임시 접근과 나가기 요청은 BE에 없다.** 자리만 잡고 비활성으로 둔다 — 앞으로
 * 무엇이 오는지 보이고, 생기면 `disabled`를 떼는 것으로 끝난다.
 */
export function SupportSection({
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
    <>
      <SettingsSection title="지원">
        <SettingsRows tight>
          <SettingsRow>
            <ActionRow name="운영팀 임시 접근 허용" value="꺼짐">
              {/* 임시 접근 발급·회수 API가 BE에 없다 */}
              <Toggle
                checked={false}
                onChange={() => undefined}
                label="운영팀 임시 접근 허용"
                disabled
              />
            </ActionRow>
          </SettingsRow>
          <SettingsRow>
            {/* value를 두지 않는다 — 다른 행의 value는 전부 현재 상태(`꺼짐`·`사용 안 함`)인데
                여기 쓸 상태가 없다. "관리자 승인이 필요해요" 같은 조건 설명은 계정 페이지에
                두지 않는 문구다. BE가 생기면 확인 모달에서 말한다. */}
            <ActionRow name="워크스페이스에서 나가기">
              <Button variant="danger" size="sm" disabled>
                나가기 요청
              </Button>
            </ActionRow>
          </SettingsRow>
        </SettingsRows>
      </SettingsSection>

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
    </>
  );
}
