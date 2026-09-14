"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useModules } from "@/components/module-provider";
import { Toast } from "@/components/ui";
import { useToast } from "@/components/use-toast";
import { DRAWINGS } from "@/data/drawings";
import type { Item } from "@/data/inventory";
import { ITEMS } from "@/data/inventory-demo";
import { useAccountMe } from "@/lib/account-me";
import { ApiRequestError, apiGet } from "@/lib/api";
import * as api from "@/lib/design-api";
import { reduce, type DesignAction, type DesignData } from "@/lib/design-state";
import { todayIso } from "@/lib/management-state";
import { useWorkspaceMe } from "@/lib/workspace-me";

/**
 * 제품설계 화면 상태 — 도면 목록 + 품목 마스터(매핑 후보). 재고·물류의 `InventoryProvider` 와 같은 모양이다.
 *
 * 마운트 시 한 번 받고, 동작은 `dispatch` → 서버 → 다시 받기. 낙관적 갱신은 없다 — 리비전 번호 · 자동 매핑 결과를
 * 서버가 정한다. 실패하면 토스트, 화면은 그대로.
 *
 * **데모 폴백**: BE 가 안 떠 있어 첫 GET 이 404 면 데모 데이터로 채우고 `dispatch` 는 리듀서로 로컬 처리한다
 * (`mode: "demo"`). 서버에 닿지 못한 것은 배포에서는 오류다 — 재고·물류의 `demoFallback` 과 같은 판단.
 */
export type DesignSub = "drawings" | "bom";
type Status = "loading" | "ready" | "error";
type Mode = "server" | "demo";

interface DesignContextValue {
  state: DesignData & { today: string };
  /** 매핑 후보 — 재고·물류 품목 마스터. 권한이 없으면 비어 있고 매핑 버튼은 그 사실을 말한다 */
  items: Item[];
  status: Status;
  mode: Mode;
  reload: () => void;
  /** 서버(또는 폴백 리듀서)에 적용한다. 성공 여부 */
  dispatch: (action: DesignAction) => Promise<boolean>;
  notify: (message: string) => void;
  /** 이 탭을 쓸 수 있는가 — 회사가 켰고 내 직급이 가졌는가(소유자는 전부). 보안 경계가 아니다 */
  can: (sub: DesignSub) => boolean;
}

const DesignContext = createContext<DesignContextValue | null>(null);
const EMPTY: DesignData = { drawings: [] };

const messageOf = (e: unknown) =>
  e instanceof ApiRequestError ? e.body.message : e instanceof Error ? e.message : "처리하지 못했어요. 잠시 뒤 다시 시도해 주세요";

function demoFallback(e: unknown): boolean {
  if (e instanceof ApiRequestError) return e.status === 404;
  return process.env.NODE_ENV !== "production";
}

/** 품목 마스터 — 제품설계 권한만 있고 재고 권한이 없으면 403. 그건 오류가 아니라 「매핑 후보 없음」이다 */
async function loadItems(): Promise<Item[]> {
  try {
    return (await apiGet<Item[]>("/api/workspace/inventory/items")) ?? [];
  } catch (e) {
    if (e instanceof ApiRequestError && (e.status === 403 || e.status === 404)) return [];
    throw e;
  }
}

export function DesignProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DesignData>(EMPTY);
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [mode, setMode] = useState<Mode>("server");
  const [attempt, setAttempt] = useState(0);
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
        setItems(await loadItems());
        if (!alive) return;
        setMode("server");
        setStatus("ready");
      } catch (e) {
        if (!alive) return;
        if (demoFallback(e)) {
          setData({ drawings: DRAWINGS });
          setItems(ITEMS);
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

  const today = todayIso();
  const actor = account?.name ?? "";

  const dispatch = useCallback<DesignContextValue["dispatch"]>(
    async (action) => {
      if (mode === "demo") {
        setData((d) => reduce(d, action, today, actor));
        return true;
      }
      try {
        await api.send(action, data);
        setData(await api.getAll());
        return true;
      } catch (e) {
        show(messageOf(e), "error");
        return false;
      }
    },
    [mode, today, actor, data, show],
  );

  const value = useMemo<DesignContextValue>(() => {
    const subs = modules.design?.subs ?? {};
    const granted = me ? (me.member.owner ? null : new Set(me.permissions.tabs)) : null;
    return {
      state: { ...data, today },
      items,
      status,
      mode,
      reload,
      dispatch,
      notify: show,
      can: (sub) => subs[sub] !== false && (granted === null || granted.has(sub)),
    };
  }, [data, today, items, status, mode, reload, dispatch, show, modules, me]);

  return (
    <DesignContext.Provider value={value}>
      {children}
      <Toast toast={toast} />
    </DesignContext.Provider>
  );
}

export function useDesign(): DesignContextValue {
  const ctx = useContext(DesignContext);
  if (!ctx) throw new Error("useDesign은 DesignProvider 안에서만 쓸 수 있어요");
  return ctx;
}
