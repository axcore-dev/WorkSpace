"use client";

import { useState } from "react";
import {
  ActionRow,
  SettingsRow,
  SettingsRows,
  SettingsSection,
} from "@/components/settings/settings-section";
import { IconLaptop } from "@/components/icons";
import { Button } from "@/components/ui";
import { DEVICES } from "@/data/org";

/**
 * 계정 › 기기 — 활성 세션.
 *
 * 현장 공용 단말을 로그아웃하지 않고 떠나는 일이 잦아서 넣었다. 여기서 바로 끊을 수 있다.
 *
 * **열을 나눈다** (수정요청 v12). 전에는 `마지막 활동 · 위치 · 상세`를 한 줄에 이어
 * 붙였는데, 기기가 늘면 어느 쪽이 시간이고 어느 쪽이 위치인지 줄마다 다시 읽어야 했다.
 * `company/member-table.tsx`와 같은 모양(표 + 우측 동작)이다.
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
      </SettingsRows>

      <div className="thin-scroll mt-2 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-medium text-slate-400">
              <th scope="col" className="py-2.5 pr-3">기기 이름</th>
              <th scope="col" className="px-3 py-2.5">마지막 활동</th>
              <th scope="col" className="px-3 py-2.5">위치</th>
              {/* 동작 열은 이름을 두지 않는다 — 읽을 값이 아니다 */}
              <th scope="col" className="py-2.5 pl-3">
                <span className="sr-only">동작</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {devices.map((d) => (
              <tr key={d.id} className="transition-colors hover:bg-slate-50/70">
                <td className="py-3 pr-3">
                  <span className="flex items-center gap-2">
                    <IconLaptop size={15} className="shrink-0 text-slate-400" />
                    <span className="min-w-0">
                      <span className="block font-medium text-slate-900">{d.name}</span>
                      {d.current && (
                        <span className="block text-[11px] text-primary-600">이 기기</span>
                      )}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-3 text-slate-500">{d.lastActive}</td>
                <td className="px-3 py-3 text-slate-600">{d.location}</td>
                <td className="py-3 pl-3 text-right">
                  {!d.current && (
                    <Button variant="ghost" size="sm" onClick={() => logoutOne(d.id)}>
                      로그아웃
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SettingsSection>
  );
}
