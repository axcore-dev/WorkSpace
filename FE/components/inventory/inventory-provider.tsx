"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useModules } from "@/components/module-provider";
import { Toast } from "@/components/ui";
import { useToast } from "@/components/use-toast";
import type { InventorySub } from "@/data/inventory";
import { DEMO_TODAY, DOC_RULES, ITEMS, MOVEMENTS, ORDERS, SAFETY_STANDARD, STANDARDS, VENDORS } from "@/data/inventory-demo";
import { useAccountMe } from "@/lib/account-me";
import { ApiRequestError } from "@/lib/api";
import * as api from "@/lib/inventory-api";
import { reduce, type InventoryAction, type InventoryData, type InventoryState } from "@/lib/inventory-state";
import { todayIso } from "@/lib/management-state";
import { useWorkspaceMe } from "@/lib/workspace-me";

/**
 * 처리 · 설정 두 화면이 공유하는 단일 상태 (경영지원 `ManagementProvider` 와 같은 모양).
 *
 * 마운트 시 한 번 받고, 동작은 `dispatch` → 서버 → 다시 받기. 낙관적 갱신은 없다 — 발주번호 · 이력 id 를
 * 서버가 정한다. 실패하면 토스트, 화면은 그대로.
 *
 * **dev 폴백**: BE 에 `/api/workspace/inventory/*` 가 아직 없다. 프로덕션이 아니고 첫 GET 이 404 · 네트워크
 * 오류면 데모 데이터로 채우고 `dispatch` 는 리듀서로 로컬 처리한다(`mode: "demo"`). 프로덕션은 오류 상태.
 */
type Status = "loading" | "ready" | "error";
type Mode = "server" | "demo";
export type Density = "simple" | "detail";

const DENSITY_KEY = "axpoint-inventory-density";
const DEMO: InventoryData = { orders: ORDERS, movements: MOVEMENTS, items: ITEMS, vendors: VENDORS, standards: STANDARDS, standard: SAFETY_STANDARD, docRules: DOC_RULES };
const EMPTY: InventoryData = { orders: [], movements: [], items: [], vendors: [], standards: [], standard: SAFETY_STANDARD, docRules: DOC_RULES };

interface InventoryContextValue {
  state: InventoryState;
  status: Status;
  mode: Mode;
  reload: () => void;
  /** 서버(또는 폴백 리듀서)에 적용한다. 성공 여부 */
  dispatch: (action: InventoryAction) => Promise<boolean>;
  notify: (message: string) => void;
  /**
   * 이 서브기능을 쓸 수 있는가 — 회사가 켰고(`features`) 내 직급이 가졌는가(`me.permissions.tabs`, 소유자는 전부).
   * `me` 를 못 받은 상태(오류)에서는 막지 않는다 — 데이터 요청이 BE 에서 403 으로 막힌다. 보안 경계가 아니다.
   */
  can: (sub: InventorySub) => boolean;
  density: Density;
  setDensity: (d: Density) => void;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

const messageOf = (e: unknown) => (e instanceof ApiRequestError ? e.body.message : "처리하지 못했어요. 잠시 뒤 다시 시도해 주세요");

/** 개발 중 BE 가 없을 때만 폴백한다 — 404 또는 서버에 닿지 못한 경우 */
function demoFallback(e: unknown): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return !(e instanceof ApiRequestError) || e.status === 404;
}

const stamp = () => new Date().toISOString().slice(0, 16);

function readDensity(): Density {
  if (typeof window === "undefined") return "simple";
  try {
    return localStorage.getItem(DENSITY_KEY) === "detail" ? "detail" : "simple";
  } catch {
    return "simple";
  }
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<InventoryData>(EMPTY);
  const [status, setStatus] = useState<Status>("loading");
  const [mode, setMode] = useState<Mode>("server");
  const [attempt, setAttempt] = useState(0);
  // `ModuleGate` 가 `/api/workspace/me` 를 받은 뒤에만 이 트리를 그리므로 서버 렌더가 없다 — 초기값에서 바로 읽어도 어긋나지 않는다
  const [density, setDensityState] = useState<Density>(readDensity);
  const [toast, show] = useToast();
  const { me } = useWorkspaceMe();
  const { me: account } = useAccountMe();
  const { state: modules } = useModules();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const all = await api.getAll();
        if (!alive) return;
        setData(all);
        setMode("server");
        setStatus("ready");
      } catch (e) {
        if (!alive) return;
        if (demoFallback(e)) {
          setData(DEMO);
          setMode("demo");
          setStatus("ready");
        } else {
          setStatus("error");
        }
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

  const today = mode === "demo" ? DEMO_TODAY : todayIso();
  const actor = account?.name ?? "";

  const dispatch = useCallback<InventoryContextValue["dispatch"]>(
    async (action) => {
      if (mode === "demo") {
        setData((d) => reduce({ ...d, today }, action, stamp(), actor));
        return true;
      }
      try {
        await api.send(action);
        setData(await api.getAll());
        return true;
      } catch (e) {
        show(messageOf(e), "error");
        return false;
      }
    },
    [mode, today, actor, show],
  );

  const setDensity = useCallback((d: Density) => {
    setDensityState(d);
    try {
      localStorage.setItem(DENSITY_KEY, d);
    } catch {
      // 브라우저 편의값이다 — 못 남겨도 화면은 그대로 간다
    }
  }, []);

  const value = useMemo<InventoryContextValue>(() => {
    const subs = modules.inventory?.subs ?? {};
    const granted = me ? (me.member.owner ? null : new Set(me.permissions.tabs)) : null;
    return {
      state: { ...data, today },
      status,
      mode,
      reload,
      dispatch,
      notify: show,
      can: (sub) => subs[sub] !== false && (granted === null || granted.has(sub)),
      density,
      setDensity,
    };
  }, [data, today, status, mode, reload, dispatch, show, modules, me, density, setDensity]);

  return (
    <InventoryContext.Provider value={value}>
      {children}
      <Toast toast={toast} />
    </InventoryContext.Provider>
  );
}

export function useInventory(): InventoryContextValue {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error("useInventory는 InventoryProvider 안에서만 쓸 수 있어요");
  return ctx;
}
