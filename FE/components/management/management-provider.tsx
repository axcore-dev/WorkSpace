"use client";

import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";
import { Toast } from "@/components/ui";
import { useToast } from "@/components/use-toast";
import { DEMO_USER } from "@/data/org";
import { DEMO_TODAY, HR_MEMBERS, PAYROLL_RUNS, VOUCHERS } from "@/data/pages/management";
import {
  defaultSelection,
  pendingCounts,
  reduce,
  type ManagementAction,
  type ManagementState,
  type WorkbenchTab,
} from "@/lib/management-state";

/**
 * 경영지원 세 작업대가 공유하는 단일 상태.
 *
 * **BE seam** — 지금은 `data/pages/management.ts` 상수를 초기값으로 쓰고 액션은 로컬 리듀서만 돈다.
 * 실연동 시 이 파일에서 (1) 초기값을 `GET /api/management/org|payroll|vouchers`로 채우고
 * (2) `dispatch`를 감싸 `createVoucher → POST /api/management/payroll/{id}/voucher`,
 * `markPaid → …/paid`, `recalc → …/recalc`, `approve → POST /api/management/vouchers/{no}/approve`,
 * `reject → …/reject`를 호출한 뒤 실패하면 이전 상태로 되돌린다. 작업대 컴포넌트는 손대지 않는다.
 */
interface ManagementContextValue {
  state: ManagementState;
  dispatch: (action: ManagementAction) => void;
  /** 저장 피드백 토스트 */
  notify: (message: string) => void;
  today: string;
  /** 로그인 사용자 이름 — 전표 작성자 */
  user: string;
  pending: { payroll: number; accounting: number };
  select: (tab: WorkbenchTab, id: string) => void;
  /** 작업대별 현재 선택 — 없으면 기본값 */
  selected: (tab: WorkbenchTab) => string;
}

const ManagementContext = createContext<ManagementContextValue | null>(null);

export function ManagementProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduce, undefined, (): ManagementState => ({
    runs: PAYROLL_RUNS,
    vouchers: VOUCHERS,
    members: HR_MEMBERS,
    selection: {},
  }));
  const [toast, show] = useToast();
  const select = useCallback((tab: WorkbenchTab, id: string) => dispatch({ type: "select", tab, id }), []);
  const value = useMemo<ManagementContextValue>(() => {
    const defaults = defaultSelection(state);
    return {
      state,
      dispatch,
      notify: show,
      today: DEMO_TODAY,
      user: DEMO_USER.name,
      pending: pendingCounts(state),
      select,
      selected: (tab) => state.selection[tab] ?? defaults[tab],
    };
  }, [state, show, select]);
  return (
    <ManagementContext.Provider value={value}>
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
