"use client";

import { useState } from "react";
import {
  SettingsRow,
  SettingsRows,
  SettingsSection,
} from "@/components/settings/settings-section";
import { Toggle } from "@/components/ui";
import { NOTIFICATION_PREFS } from "@/data/org";

type Channel = "inapp" | "email" | "slack";

const CHANNELS: { key: Channel; label: string }[] = [
  { key: "inapp", label: "인앱" },
  { key: "email", label: "이메일" },
  { key: "slack", label: "Slack" },
];

/**
 * 채널 열 — 헤더와 토글 줄이 같은 그리드를 써서 열이 맞는다.
 * `grid` + `justify-items-center`로 가운데를 맞추면 토글 폭을 건드리지 않는다.
 * flex + width를 토글에 주면 토글 자체가 늘어난다.
 */
const CHAN_GRID = "grid shrink-0 grid-cols-[repeat(3,56px)] items-center justify-items-center";

/**
 * 계정 › 알림 — 개인 수신 설정.
 *
 * `NOTIFICATION_PREFS`는 지금까지 `data/org.ts`에 정의만 되고 **어디에서도 쓰이지 않았다.**
 * 워크스페이스 정책이 아니라 개인 설정이어야 하는 값이라 계정으로 가져왔다 — 공정 이상
 * 알림을 누가 어디로 받을지는 사람마다 다르다.
 *
 * 토글은 즉시 저장한다 — 폼이 아니라 스위치라 저장 버튼을 두지 않는다.
 *
 * **BE 연동 seam**: 개인 알림 설정 API가 아직 없다. 생기면 토글마다 PATCH를 부른다.
 */
export function NotificationSection({ onSaved }: { onSaved: (message: string) => void }) {
  const [prefs, setPrefs] = useState(() =>
    NOTIFICATION_PREFS.map((p) => ({ ...p, channels: { ...p.channels } })),
  );

  function toggle(index: number, channel: Channel, next: boolean) {
    setPrefs((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, channels: { ...p.channels, [channel]: next } } : p,
      ),
    );
    const label = CHANNELS.find((c) => c.key === channel)?.label ?? channel;
    onSaved(`${prefs[index].event} ${label} 알림을 ${next ? "켰어요" : "껐어요"}`);
  }

  return (
    <SettingsSection
      title="알림"
      aside={
        <span className={CHAN_GRID}>
          {CHANNELS.map((c) => (
            <span key={c.key} className="text-[11px] font-medium text-slate-400">
              {c.label}
            </span>
          ))}
        </span>
      }
    >
      <SettingsRows tight>
        {prefs.map((p, i) => (
          <SettingsRow key={p.event}>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[13.5px] font-semibold text-slate-900">{p.event}</span>
              <span className={CHAN_GRID}>
                {CHANNELS.map((c) => (
                  <Toggle
                    key={c.key}
                    size="sm"
                    checked={p.channels[c.key]}
                    onChange={(v) => toggle(i, c.key, v)}
                    label={`${p.event} ${c.label} 알림`}
                  />
                ))}
              </span>
            </div>
          </SettingsRow>
        ))}
      </SettingsRows>
    </SettingsSection>
  );
}
