"use client";

import { useState } from "react";
import {
  ICON_MAP,
  IconBell,
  IconDatabase,
  IconGrid,
  IconInfo,
  IconLink,
  IconWorkflow,
} from "@/components/icons";
import { useModules } from "@/components/module-provider";
import { AiBadge, Badge, Button, Card, SectionHeader, Toggle } from "@/components/ui";
import { MODULES } from "@/data/modules";
import { CONNECTORS, EXTERNAL_SERVICES, NOTIFICATION_PREFS, SYNC_RULES } from "@/data/org";

export function WorkspaceSettings() {
  const { state, setModule, setSub } = useModules();
  const [services, setServices] = useState(EXTERNAL_SERVICES);
  const [prefs, setPrefs] = useState(NOTIFICATION_PREFS);

  function toggleService(id: string) {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, connected: !s.connected } : s)));
  }

  return (
    <div className="space-y-5">
      {/* 기능 활성화 설정 — 박스인박스 제거, 플랫 리스트 */}
      <Card>
        <SectionHeader
          title={
            <span className="flex items-center gap-2">
              <IconGrid size={16} className="text-slate-400" /> 기능 활성화 설정
            </span>
          }
          desc="핵심 기능과 세부 기능을 개별 ON/OFF합니다. OFF 시 좌측 패널에서 비활성화 표시되며 데이터는 보존됩니다."
        />
        <ul className="divide-y divide-slate-100">
          {MODULES.map((mod) => {
            const Icon = ICON_MAP[mod.icon];
            const st = state[mod.slug];
            return (
              <li key={mod.slug} className="py-3.5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon size={17} className={`shrink-0 ${st.enabled ? "text-slate-600" : "text-slate-300"}`} />
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${st.enabled ? "text-slate-900" : "text-slate-400"}`}>
                        {mod.name}
                      </p>
                      <p className="truncate text-xs text-slate-400">{mod.summary}</p>
                    </div>
                  </div>
                  <Toggle size="sm" checked={st.enabled} onChange={(v) => setModule(mod.slug, v)} label={`${mod.name} 기능`} />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 pl-8">
                  {mod.subfunctions.map((sub) => (
                    <span key={sub.id} className="inline-flex items-center gap-1.5">
                      <Toggle
                        size="sm"
                        checked={st.subs[sub.id]}
                        onChange={(v) => setSub(mod.slug, sub.id, v)}
                        label={`${mod.name} > ${sub.name}`}
                      />
                      <span className={`flex items-center gap-1 text-[13px] ${st.subs[sub.id] ? "text-slate-600" : "text-slate-400"}`}>
                        {sub.name}
                        {sub.ai && <AiBadge />}
                      </span>
                    </span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
          <IconInfo size={14} className="mt-0.5 shrink-0 text-slate-400" />
          세부 기능 간 의존성이 있는 경우 OFF 시 경고가 표시됩니다. 예: 급여 관리 OFF 시 회계 관리의 급여
          전표 자동 연계가 중단됩니다. 모든 변경은 감사 로그에 기록됩니다.
        </p>
      </Card>

      {/* 외부 시스템 연동 */}
      <Card>
        <SectionHeader
          title={
            <span className="flex items-center gap-2">
              <IconDatabase size={16} className="text-slate-400" /> 외부 시스템 연동
            </span>
          }
          desc="커넥터 설정과 연동 상태를 모니터링합니다. 실시간 동기화 5초 이내, 오류 시 자동 재시도·알림."
          action={
            <Button size="sm" variant="secondary">
              커넥터 추가
            </Button>
          }
        />
        <ul className="divide-y divide-slate-100">
          {CONNECTORS.map((c) => (
            <li key={c.name} className="flex flex-wrap items-center gap-3 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  {c.name}
                  <span className="text-xs font-normal text-slate-400">{c.type}</span>
                </p>
                <p className="mt-0.5 truncate font-mono text-xs text-slate-400">{c.endpoint}</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>
                  동기화 지연 <strong className="text-slate-700">{c.latency}</strong>
                </p>
                <p className="text-slate-400">마지막 동기화 {c.lastSync}</p>
              </div>
              <Badge tone={c.status.tone}>{c.status.badge}</Badge>
              <Button variant="ghost" size="sm">
                설정
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      {/* 모듈 간 데이터 연동 */}
      <Card>
        <SectionHeader
          title={
            <span className="flex items-center gap-2">
              <IconWorkflow size={16} className="text-slate-400" /> 모듈 간 데이터 연동
            </span>
          }
          desc="모듈 간 데이터 흐름 맵핑과 동기화 규칙을 관리합니다. OFF된 서브기능 관련 규칙은 자동 비활성화됩니다."
        />
        <ul className="divide-y divide-slate-100">
          {SYNC_RULES.map((r, i) => (
            <li key={i} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-slate-800">{r.from}</span>
                <span className="text-slate-300">→</span>
                <span className="font-medium text-slate-800">{r.to}</span>
                <span className="w-full text-xs text-slate-500 sm:w-auto sm:flex-1 sm:truncate">{r.rule}</span>
              </div>
              <Badge tone={r.status.tone}>{r.status.badge}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      {/* 외부 서비스 연동 */}
      <Card>
        <SectionHeader
          title={
            <span className="flex items-center gap-2">
              <IconLink size={16} className="text-slate-400" /> 외부 서비스 연동
            </span>
          }
          desc="OAuth로 외부 서비스를 연결하면 AI대화와 알림에서 활용됩니다. 외부 전송 이력은 감사 로그에 기록됩니다."
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {services.map((svc) => {
            const Icon = ICON_MAP[svc.icon];
            return (
              <div
                key={svc.id}
                className={`rounded-lg border p-4 transition-colors ${
                  svc.connected ? "border-slate-300 bg-slate-50" : "border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2.5">
                    <Icon size={18} className={svc.connected ? "text-slate-700" : "text-slate-400"} />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">{svc.name}</span>
                      <span className="block text-[11px] text-slate-400">{svc.desc}</span>
                    </span>
                  </span>
                  <Badge tone={svc.connected ? "green" : "slate"}>{svc.connected ? "연결됨" : "미연결"}</Badge>
                </div>
                {svc.connected && svc.account && (
                  <p className="mt-2 truncate font-mono text-[11px] text-slate-400">{svc.account}</p>
                )}
                <Button
                  variant={svc.connected ? "secondary" : "primary"}
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => toggleService(svc.id)}
                >
                  {svc.connected ? "연결 해제" : "OAuth 연결"}
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 알림 설정 */}
      <Card>
        <SectionHeader
          title={
            <span className="flex items-center gap-2">
              <IconBell size={16} className="text-slate-400" /> 알림 설정
            </span>
          }
          desc="이벤트 유형별 수신 채널을 설정합니다."
        />
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-400">
                <th scope="col" className="py-2.5 pr-3">이벤트</th>
                <th scope="col" className="px-3 py-2.5 text-center">인앱</th>
                <th scope="col" className="px-3 py-2.5 text-center">이메일</th>
                <th scope="col" className="px-3 py-2.5 text-center">Slack</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {prefs.map((p, i) => (
                <tr key={p.event}>
                  <td className="py-3 pr-3 font-medium text-slate-800">{p.event}</td>
                  {(["inapp", "email", "slack"] as const).map((ch) => (
                    <td key={ch} className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${p.event} — ${ch === "inapp" ? "인앱" : ch === "email" ? "이메일" : "Slack"} 알림`}
                        checked={p.channels[ch]}
                        onChange={(e) =>
                          setPrefs((prev) =>
                            prev.map((row, j) =>
                              j === i ? { ...row, channels: { ...row.channels, [ch]: e.target.checked } } : row,
                            ),
                          )
                        }
                        className="h-4 w-4 cursor-pointer accent-slate-800"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
