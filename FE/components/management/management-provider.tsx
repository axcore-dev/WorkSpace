"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Toast } from "@/components/ui";
import { useToast } from "@/components/use-toast";
import { ApiRequestError } from "@/lib/api";
import * as api from "@/lib/management-api";
import {
  defaultSelection,
  pendingCounts,
  todayIso,
  type ManagementAction,
  type ManagementState,
  type WorkbenchTab,
} from "@/lib/management-state";

/**
 * 경영지원 세 작업대가 공유하는 단일 상태.
 *
 * 처음에 `GET /org · /payroll · /accounting` 을 한 번에 받고, 동작(dispatch)은 서버에 POST 한 뒤 급여 · 회계를 다시 받는다.
 * 낙관적 갱신은 하지 않는다 — 전표 번호 · 회차 id 를 서버가 정하므로 응답 없이는 그릴 수 없다. 실패하면 토스트로 알리고
 * 화면은 그대로다(dispatch 가 false 를 돌려주니 호출한 쪽은 성공 문구를 그때만 띄운다).
 */
type Status = "loading" | "ready" | "error";

type Data = Omit<ManagementState, "selection">;
const EMPTY: Data = { org: { company: "", divisions: [], members: {} }, runs: [], vouchers: [], monthly: [] };

interface ManagementContextValue {
  state: ManagementState;
  status: Status;
  /** 처음 받기가 실패했을 때 다시 */
  reload: () => void;
  /** 서버에 보내고 다시 받는다. 성공 여부 */
  dispatch: (action: ManagementAction) => Promise<boolean>;
  /** 저장 피드백 토스트 */
  notify: (message: string) => void;
  today: string;
  pending: { payroll: number; accounting: number };
  select: (tab: WorkbenchTab, id: string) => void;
  /** 작업대별 현재 선택 — 없으면 기본값 */
  selected: (tab: WorkbenchTab) => string;
}

const ManagementContext = createContext<ManagementContextValue | null>(null);

const messageOf = (e: unknown) => (e instanceof ApiRequestError ? e.body.message : "처리하지 못했어요. 잠시 뒤 다시 시도해 주세요");

export function ManagementProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(EMPTY);
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);
  const [selection, setSelection] = useState<Partial<Record<WorkbenchTab, string>>>({});
  const [toast, show] = useToast();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [org, runs, acc] = await Promise.all([api.getOrg(), api.getPayroll(), api.getAccounting()]);
        if (!alive) return;
        setData({ org, runs, vouchers: acc.vouchers, monthly: acc.monthly });
        setStatus("ready");
      } catch {
        if (alive) setStatus("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setStatus("loading");
    setAttempt((n) => n + 1);
  }, []);

  const dispatch = useCallback(
    async (action: ManagementAction) => {
      try {
        switch (action.type) {
          case "createVoucher":
            await api.createPayrollVoucher(action.runId);
            break;
          case "markPaid":
            await api.markPayrollPaid(action.runId);
            break;
          case "recalc":
            await api.recalcPayroll(action.runId);
            break;
          case "deleteRun":
            await api.deletePayrollRun(action.runId);
            setSelection((s) => (s.payroll === action.runId ? { ...s, payroll: undefined } : s));
            break;
          case "createRun": {
            const run = await api.createPayrollRun(action.name, action.payDate);
            setSelection((s) => ({ ...s, payroll: run.id }));
            break;
          }
          case "approve":
            await api.approveVoucher(action.no);
            break;
          case "reject":
            await api.rejectVoucher(action.no, action.reason);
            break;
        }
        const [runs, acc] = await Promise.all([api.getPayroll(), api.getAccounting()]);
        setData((d) => ({ ...d, runs, vouchers: acc.vouchers, monthly: acc.monthly }));
        return true;
      } catch (e) {
        show(messageOf(e));
        return false;
      }
    },
    [show],
  );

  const select = useCallback((tab: WorkbenchTab, id: string) => setSelection((s) => ({ ...s, [tab]: id })), []);

  const value = useMemo<ManagementContextValue>(() => {
    const state: ManagementState = { ...data, selection };
    const defaults = defaultSelection(state);
    return {
      state,
      status,
      reload,
      dispatch,
      notify: show,
      today: todayIso(),
      pending: pendingCounts(state),
      select,
      selected: (tab) => selection[tab] ?? defaults[tab],
    };
  }, [data, selection, status, reload, dispatch, show, select]);

  return (
    <ManagementContext.Provider value={value}>
      {/* 받기 상태는 세 작업대가 함께 지므로 여기 한 줄로 둔다 — 작업대는 데이터가 없으면 저마다 빈 안내를 그린다. */}
      {status === "loading" && <p className="mb-3 text-sm text-slate-400">경영지원 데이터를 불러오는 중이에요</p>}
      {status === "error" && (
        <p className="mb-3 text-sm text-red-600">
          경영지원 데이터를 불러오지 못했어요.{" "}
          <button type="button" className="font-semibold underline" onClick={reload}>
            다시 시도
          </button>
        </p>
      )}
      {children}
      <Toast toast={toast} />
    </ManagementContext.Provider>
  );
}

export function useManagement(): ManagementContextValue {
  const ctx = useContext(ManagementContext);
  if (!ctx) throw new Error("useManagement는 ManagementProvider 안에서만 쓸 수 있어요");
  return ctx;
}
