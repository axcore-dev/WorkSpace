"use client";

import { useState } from "react";
import {
  SectionActions,
  SettingsSection,
} from "@/components/settings/settings-section";
import { IconLaptop } from "@/components/icons";
import { Badge, Button } from "@/components/ui";
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

  const current = devices.find((d) => d.current);
  const rest = devices.filter((d) => !d.current);
  const others = rest.length;

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
      aside={<span className="text-xs text-slate-400">다른 기기 {others}대</span>}
    >
      {/* 지금 쓰는 기기를 표 밖으로 뺀다. 그러면 아래 「다른 기기 모두 로그아웃」이 무엇을
          지우고 무엇을 남기는지가 배치로 설명된다 — 문장으로 안 적어도 된다. */}
      {current && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
          <IconLaptop size={17} className="shrink-0 text-slate-500" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-slate-900">
              {current.name}
              <Badge tone="green">지금 이 기기</Badge>
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {current.location} · {current.lastActive}
            </p>
          </div>
        </div>
      )}

      {rest.length === 0 ? (
        <p className="py-8 text-center text-[13.5px] text-slate-400">
          다른 기기에서 로그인한 기록이 없어요.
        </p>
      ) : (
        <>
          <div className="thin-scroll relative mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-400">
                  <th scope="col" className="py-2.5 pr-3">다른 기기</th>
                  <th scope="col" className="px-3 py-2.5">마지막 활동</th>
                  <th scope="col" className="px-3 py-2.5">위치</th>
                  {/* 동작 열은 이름을 두지 않는다 — 읽을 값이 아니다 */}
                  <th scope="col" className="py-2.5 pl-3">
                    <span className="sr-only">동작</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rest.map((d) => (
                  <tr key={d.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="py-3 pr-3">
                      <span className="flex items-center gap-2">
                        <IconLaptop size={15} className="shrink-0 text-slate-400" />
                        <span className="min-w-0 font-medium text-slate-900">{d.name}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-500">{d.lastActive}</td>
                    <td className="px-3 py-3 text-slate-600">{d.location}</td>
                    <td className="py-3 pl-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => logoutOne(d.id)}>
                        로그아웃
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SectionActions>
            <Button variant="danger" size="sm" onClick={logoutOthers}>
              다른 기기 {others}대 모두 로그아웃
            </Button>
          </SectionActions>
        </>
      )}
    </SettingsSection>
  );
}
