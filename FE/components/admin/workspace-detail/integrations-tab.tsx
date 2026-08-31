"use client";

import { useMemo, useState } from "react";
import { AdminTable, TD, TD_KEY, TR } from "@/components/admin/admin-table";
import { MAPPING_TONE, SYSTEM_TONE } from "./shared";
import { IconAlertTriangle } from "@/components/icons";
import { Badge, Button, Card, FIELD_INLINE, ProgressBar, SectionHeader } from "@/components/ui";
import {
  MAPPING_STATE_LABEL,
  SYSTEM_STATE_LABEL,
  type AdminWorkspace,
  type MappingState,
} from "@/data/admin";

export function IntegrationsTab({ ws }: { ws: AdminWorkspace }) {
  const [state, setState] = useState<MappingState | "all">("all");
  const [system, setSystem] = useState("all");

  const counts = useMemo(
    () => ({
      mapped: ws.mappings.filter((m) => m.state === "mapped").length,
      review: ws.mappings.filter((m) => m.state === "review").length,
      unmapped: ws.mappings.filter((m) => m.state === "unmapped").length,
    }),
    [ws.mappings],
  );

  const rows = useMemo(
    () =>
      ws.mappings.filter(
        (m) => (state === "all" || m.state === state) && (system === "all" || m.system === system),
      ),
    [ws.mappings, state, system],
  );

  if (ws.systems.length === 0) {
    return (
      <Card>
        <SectionHeader title="연결된 시스템" />
        <p className="text-sm text-slate-400">
          아직 연결된 외부 시스템이 없어요. ERP·MES를 연결하면 온톨로지 AI가 항목을 이어 붙여요.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 매핑이 이 탭의 주인공 — 시스템 목록은 위에 요약으로 둔다 */}
      <Card>
        <SectionHeader title="온톨로지 매핑" desc="확신도가 낮으면 사람이 확인해야 해요." />

        <div className="grid grid-cols-3 gap-3">
          {[
            { key: "mapped" as const, label: "매핑됨", value: counts.mapped, tone: "text-emerald-700" },
            { key: "review" as const, label: "검토 필요", value: counts.review, tone: "text-amber-700" },
            { key: "unmapped" as const, label: "미매핑", value: counts.unmapped, tone: "text-red-700" },
          ].map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={state === c.key}
              onClick={() => setState(state === c.key ? "all" : c.key)}
              className={`cursor-pointer rounded-lg border px-3.5 py-3 text-left transition-colors ${
                state === c.key
                  ? "border-slate-400 bg-slate-50"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/70"
              }`}
            >
              <p className="text-xs text-slate-500">{c.label}</p>
              <p className={`mt-0.5 text-lg font-bold tabular-nums ${c.tone}`}>{c.value}</p>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <select
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            aria-label="시스템 필터"
            className={`${FIELD_INLINE} cursor-pointer`}
          >
            <option value="all">시스템: 전체</option>
            {ws.systems.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
          {state !== "all" && (
            <Button variant="ghost" size="sm" onClick={() => setState("all")}>
              {MAPPING_STATE_LABEL[state]} 필터 해제
            </Button>
          )}
          <span className="ml-auto text-xs text-slate-400">{rows.length}개 항목</span>
        </div>

        <div className="mt-4">
          <AdminTable
            columns={["시스템", "원본 항목", "온톨로지 개념", "확신도", "상태"]}
            minWidth={680}
          >
            {rows.map((m) => (
              <tr key={`${m.system}-${m.source}`} className={TR}>
                <td className={TD}>{m.system}</td>
                <td className={`${TD_KEY} font-mono`}>{m.source}</td>
                <td className={TD}>{m.concept}</td>
                <td className={TD}>
                  <span className="flex items-center gap-2">
                    <span className="w-9 shrink-0 tabular-nums">{m.confidence}%</span>
                    <ProgressBar
                      value={m.confidence}
                      tone={m.confidence >= 90 ? "green" : m.confidence >= 70 ? "amber" : "red"}
                      className="w-16"
                    />
                  </span>
                </td>
                <td className={TD}>
                  <Badge tone={MAPPING_TONE[m.state]}>{MAPPING_STATE_LABEL[m.state]}</Badge>
                </td>
              </tr>
            ))}
          </AdminTable>

          {rows.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">
              조건에 맞는 항목이 없어요. 필터를 넓혀 보세요.
            </p>
          )}
        </div>
      </Card>

      <Card>
        <SectionHeader title="연결된 시스템" />
        <AdminTable columns={["시스템", "종류", "사업장", "연결 상태", "마지막 동기화"]} minWidth={620}>
          {ws.systems.map((s) => (
            <tr key={s.name} className={TR}>
              <td className={TD_KEY}>{s.name}</td>
              <td className={TD}>{s.kind}</td>
              <td className={TD}>{s.site}</td>
              <td className={TD}>
                <Badge tone={SYSTEM_TONE[s.state]}>{SYSTEM_STATE_LABEL[s.state]}</Badge>
              </td>
              <td className={TD}>{s.lastSync}</td>
            </tr>
          ))}
        </AdminTable>
        {ws.systems.some((s) => s.state === "authFail") && (
          <p className="mt-3 flex items-start gap-2 text-xs text-red-600">
            <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
            인증이 실패한 시스템은 매핑이 갱신되지 않아요. 고객사에 접속 정보 재발급을 요청해 주세요.
          </p>
        )}
      </Card>
    </div>
  );
}
