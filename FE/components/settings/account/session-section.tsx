"use client";

import { useState } from "react";
import {
  ActionRow,
  SettingsRow,
  SettingsRows,
  SettingsSection,
} from "@/components/settings/settings-section";
import { Button } from "@/components/ui";
import { DEVICES } from "@/data/org";

/**
 * 계정 › 기기 — 활성 세션.
 *
 * 현장 공용 단말을 로그아웃하지 않고 떠나는 일이 잦아서 넣었다. 여기서 바로 끊을 수 있다.
 *
 * **BE 연동 seam**: `GET /api/auth/sessions`와 `DELETE /api/auth/sessions/{sessionId}`가
 * 이미 있다. 지금은 더미 목록에서 제거만 한다.
 */
export function SessionSection({ onSaved }: { onSaved: (message: string) => void }) {
  const [devices, setDevices] = useState(DEVICES);

  const others = devices.filter((d) => !d.current).length;

  function logoutOne(id: string) {
    const gone = devices.find((d) => d.id === id);
    setDevices((prev) => prev.filter((d) => d.id !== id));
    onSaved(`${gone?.name ?? "기기"}에서 로그아웃했어요`);
  }

  function logoutOthers() {
    setDevices((prev) => prev.filter((d) => d.current));
    onSaved(`${others}개 기기에서 로그아웃했어요`);
  }

  return (
    <SettingsSection
      title="기기"
      aside={<span className="text-xs text-slate-400">활성 세션 {devices.length}개</span>}
    >
      <SettingsRows tight>
        <SettingsRow>
          <ActionRow name="모든 기기에서 로그아웃" value="이 기기만 남겨요">
            <Button variant="danger" size="sm" disabled={others === 0} onClick={logoutOthers}>
              모든 기기에서 로그아웃
            </Button>
          </ActionRow>
        </SettingsRow>

        {devices.map((d) => (
          <SettingsRow key={d.id}>
            <ActionRow
              name={
                <>
                  {d.name}
                  {d.current && (
                    <span className="ml-2 text-[11px] font-normal text-primary-600">이 기기</span>
                  )}
                </>
              }
              value={`${d.lastActive} · ${d.location}${d.detail ? ` · ${d.detail}` : ""}`}
            >
              {!d.current && (
                <Button variant="ghost" size="sm" onClick={() => logoutOne(d.id)}>
                  로그아웃
                </Button>
              )}
            </ActionRow>
          </SettingsRow>
        ))}
      </SettingsRows>
    </SettingsSection>
  );
}
