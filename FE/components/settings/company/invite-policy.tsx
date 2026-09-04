"use client";

import { useState } from "react";
import {
  ActionRow,
  FieldRow,
  SectionActions,
  SettingsRow,
  SettingsRows,
} from "@/components/settings/settings-section";
import { Button, FIELD, Toggle } from "@/components/ui";
import { INVITE_POLICY } from "@/data/org";

/**
 * 초대 관리 › 초대 정책 탭.
 *
 * `ui.tsx`의 `isPersonalEmail` 유틸이 이미 있다 — 그 유틸이 기다리던 설정이다.
 *
 * **BE 연동 seam**: `save`가 정책 저장 API를 부르고, 그다음 초대 검증이 이 값을 쓴다.
 */
export function InvitePolicy({ onSaved }: { onSaved: (message: string) => void }) {
  const [workEmailOnly, setWorkEmailOnly] = useState(INVITE_POLICY.workEmailOnly);
  const [domains, setDomains] = useState(INVITE_POLICY.allowedDomains.join(", "));

  return (
    <div className="mt-2">
      <SettingsRows tight>
        <SettingsRow>
          <ActionRow name="회사 메일만 초대하기" value="개인 메일 주소 차단">
            <Toggle
              checked={workEmailOnly}
              onChange={setWorkEmailOnly}
              label="회사 메일만 초대하기"
            />
          </ActionRow>
        </SettingsRow>
        <SettingsRow>
          <FieldRow label="허용 도메인" htmlFor="inv-domains">
            {/* 회사 메일만 초대를 끄면 도메인 목록이 아무 일도 하지 않는다 —
                설명 문구 대신 disabled로 말한다 */}
            <input
              id="inv-domains"
              className={FIELD}
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              disabled={!workEmailOnly}
            />
          </FieldRow>
        </SettingsRow>
      </SettingsRows>
      <SectionActions>
        <Button size="sm" onClick={() => onSaved("초대 정책을 저장했어요")}>
          저장하기
        </Button>
      </SectionActions>
    </div>
  );
}
