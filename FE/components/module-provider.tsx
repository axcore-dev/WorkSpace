"use client";

import { useSyncExternalStore } from "react";
import {
  defaultModuleState,
  loadModuleState,
  saveModuleState,
  type ModuleState,
} from "@/lib/module-state";

/**
 * 모듈 ON/OFF 상태의 외부 스토어 (localStorage 동기화).
 * SSR에서는 기본값(`DEFAULT_ON_MODULES` — 8개 중 3개만 ON)으로 렌더링하고,
 * 클라이언트에서 저장된 상태로 재조정된다.
 */
const SERVER_SNAPSHOT = defaultModuleState();

let cache: ModuleState | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): ModuleState {
  if (cache === null) cache = loadModuleState();
  return cache;
}

function getServerSnapshot(): ModuleState {
  return SERVER_SNAPSHOT;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(next: ModuleState) {
  cache = next;
  saveModuleState(next);
  listeners.forEach((l) => l());
}

/** 모듈 전체 ON/OFF (서브기능 일괄 적용) */
function setModule(slug: string, on: boolean) {
  const cur = getSnapshot();
  commit({
    ...cur,
    [slug]: {
      enabled: on,
      subs: Object.fromEntries(Object.keys(cur[slug].subs).map((k) => [k, on])),
    },
  });
}

/** 서브기능 단위 ON/OFF */
function setSub(slug: string, sub: string, on: boolean) {
  const cur = getSnapshot();
  const subs = { ...cur[slug].subs, [sub]: on };
  commit({
    ...cur,
    [slug]: { enabled: Object.values(subs).some(Boolean), subs },
  });
}

export function useModules() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { state, setModule, setSub };
}

/** 향후 컨텍스트 기반 상태로 교체할 수 있도록 경계만 유지 */
export function ModuleProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
