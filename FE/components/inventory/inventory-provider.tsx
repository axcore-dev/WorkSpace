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
 * **데모 폴백**: BE 에 `/api/workspace/inventory/*` 가 아직 없다. 첫 GET 이 404 면 데모 데이터로 채우고
 * `dispatch` 는 리듀서로 로컬 처리한다(`mode: "demo"`). 배포에서도 켜진다 — `demoFallback` 주석 참고.
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

/**
 * 데모 데이터로 채울 것인가.
 *
 * **없는 경로(404)는 어디서든 채운다.** BE 에 재고·물류 API 가 아직 없어서 배포에서도 빈 오류 화면만 나왔다.
 * 데모를 보여 주는 것이 이 배포의 목적이므로 프로덕션에서도 채운다. BE 가 생기면 404 가 사라져 저절로 꺼진다.
 *
 * **서버에 닿지 못한 것은 다르다.** 배포에서 그것은 장애다 — 있는 API 가 잠깐 죽었는데 지어낸 숫자를 진짜처럼
 * 보여 주면 안 된다. 오류 화면으로 남기고, BE 를 안 띄운 개발에서만 데모로 본다.
 */
function demoFallback(e: unknown): boolean {
  if (e instanceof ApiRequestError) return e.status === 404;
  return process.env.NODE_ENV !== "production";
}

/** 폴백 리듀서용 시각 — 날짜는 고정 「오늘」, 시각은 지금(로컬). UTC 로 찍으면 화면 날짜와 어긋난다 */
function stamp(today: string) {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${today}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

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
        setData((d) => reduce({ ...d, today }, action, stamp(today), actor));
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
