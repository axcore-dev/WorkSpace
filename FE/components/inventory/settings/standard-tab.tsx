"use client";

import { useState } from "react";
import { ActionRow, SettingsRow, SettingsRows, SettingsSection } from "@/components/settings/settings-section";
import { Button, FIELD_SM, FIELD_SM_ERROR, Segmented } from "@/components/ui";
import type { SafetyStandard } from "@/data/inventory";
import { useInventory } from "../inventory-provider";

export const METHOD_LABEL: Record<SafetyStandard["method"], string> = {
  leadTimeAvg: "리드타임 × 일평균 소요량",
  manual: "담당자 지정",
};
const METHOD_OPTIONS = (Object.keys(METHOD_LABEL) as SafetyStandard["method"][]).map((value) => ({ value, label: METHOD_LABEL[value] }));

type Editing = null | "method" | "window";

/**
 * 안전 재고 기준 — 카드 없는 설정 형식. 행마다 [수정] → 그 자리에서 고치고 [저장].
 * 산정 방식을 바꾸면 모든 품목의 기준이 즉시 다시 계산된다. 자동 → 수동은 지금 자동값을 담당자 값으로 굳힌다(리듀서).
 */
export function StandardTab() {
  const { state, dispatch, notify } = useInventory();
  const s = state.standard;
  const [editing, setEditing] = useState<Editing>(null);
  const [method, setMethod] = useState(s.method);
  const [win, setWin] = useState(String(s.avgWindowDays));
  const [error, setError] = useState("");

  function start(which: Exclude<Editing, null>) {
    setMethod(s.method);
    setWin(String(s.avgWindowDays));
    setError("");
    setEditing(which);
  }

  function save(next: SafetyStandard) {
    void dispatch({ type: "setStandard", standard: next }).then((ok) => {
      if (!ok) return;
      notify("저장했어요");
      setEditing(null);
    });
  }

  function saveWindow() {
    const n = Math.trunc(Number(win));
    if (!win.trim() || !Number.isFinite(n) || n < 1 || n > 365) {
      setError("1~365 사이로 적어 주세요");
      return;
    }
    save({ ...s, avgWindowDays: n });
  }

  const actions = (onSave: () => void) => (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>
        닫기
      </Button>
      <Button size="sm" onClick={onSave}>
        저장
      </Button>
    </div>
  );

  return (
    <SettingsSection title="안전 재고 기준" className="max-w-3xl">
      <SettingsRows>
        <SettingsRow>
          <ActionRow name="산정 방식">
            {editing === "method" ? (
              <div className="flex flex-wrap items-center gap-3">
                <Segmented options={METHOD_OPTIONS} value={method} onChange={setMethod} label="산정 방식" />
                {actions(() => save({ ...s, method }))}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600">{METHOD_LABEL[s.method]}</span>
                <Button size="sm" variant="secondary" disabled={editing !== null} onClick={() => start("method")}>
                  수정
                </Button>
              </div>
            )}
          </ActionRow>
        </SettingsRow>
        <SettingsRow>
          <ActionRow name="일평균 산정 기간">
            {editing === "window" ? (
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-slate-600">최근</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={365}
                      aria-label="일평균 산정 기간 (일)"
                      aria-invalid={!!error}
                      value={win}
                      onChange={(e) => setWin(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveWindow()}
                      className={`${error ? FIELD_SM_ERROR : FIELD_SM} w-20 text-right`}
                    />
                    <span className="text-sm text-slate-600">일</span>
                  </div>
                  {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
                </div>
                {actions(saveWindow)}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className={`text-sm ${s.method === "manual" ? "text-slate-500" : "text-slate-600"}`}>최근 {s.avgWindowDays}일</span>
                <Button size="sm" variant="secondary" disabled={editing !== null} onClick={() => start("window")}>
                  수정
                </Button>
              </div>
            )}
          </ActionRow>
        </SettingsRow>
      </SettingsRows>
    </SettingsSection>
  );
}
