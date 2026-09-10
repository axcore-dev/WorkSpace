"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  defaultModuleState,
  moduleStateFromServer,
  type ModuleState,
} from "@/lib/module-state";
import { SESSION_CHANGED } from "@/lib/session";
import { getFeatures, putModuleFeatures } from "@/lib/workspace-api";
import { MODULE_BY_SLUG } from "@/data/modules";

/**
 * 모듈 ON/OFF 상태의 외부 스토어 — **서버가 원본**이다 (`/api/workspace/features`).
 *
 * 첫 렌더(SSR 포함)는 기본값(`DEFAULT_ON_MODULES` — 8개 중 3개만 ON)으로 그리고, 클라이언트에서
 * `useModules()` 가 처음 불리는 순간 서버 값을 한 번 받아 갈아 끼운다. 사이드바·대시보드·기능 관리가
 * 전부 이 스토어를 보므로 어느 화면에서 먼저 불려도 한 번만 받는다.
 *
 * **저장은 낙관적이다.** 토글하면 화면을 먼저 바꾸고 서버에 보낸다. 실패하면 이전 값으로 되돌리고
 * 호출부에 거절(`Promise` reject)을 알린다 — 화면이 에러 토스트를 띄운다. 스위치를 눌렀는데 아무 일도
 * 없는 것처럼 보이는 것이 가장 나쁘다.
 *
 * 로그인 전(토큰 없음)이나 회사 선택 전(409)에는 기본값을 그대로 둔다. 받기를 다시 시도하지 않는다 —
 * 그 상태에서 이 화면들에 머물 일이 없고, 회사를 고르면 라우트가 바뀌어 다시 마운트된다.
 */
const SERVER_SNAPSHOT = defaultModuleState();

let cache: ModuleState = SERVER_SNAPSHOT;
/** 서버에서 받았거나 받기를 포기했으면 true. 두 번 받지 않기 위한 표시다. */
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): ModuleState {
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
  listeners.forEach((l) => l());
}

/** 서버 값을 한 번 받는다. 동시에 여러 화면이 불러도 요청은 하나다. */
function ensureLoaded(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (!loading) {
    loading = getFeatures()
      .then((features) => commit(moduleStateFromServer(features)))
      .catch(() => {
        // 로그인 전 · 회사 선택 전 · 네트워크 오류. 기본값으로 둔다 — 다음 저장 시도에서 진짜 오류가 드러난다
      })
      .finally(() => {
        loaded = true;
        loading = null;
      });
  }
  return loading;
}

/**
 * 다음 마운트에서 다시 받게 한다. 회사를 바꾸거나 로그인이 새로 됐을 때 부른다.
 * 값을 지우지는 않는다 — 새 값이 오기 전까지 화면이 깜빡이지 않게.
 */
export function invalidateModules() {
  loaded = false;
}

/**
 * 한 모듈의 탭 몇 개를 바꾼다 — 낙관적 갱신 + 실패 시 되돌림.
 * 서버 응답으로 그 모듈을 다시 맞춘다(다른 사람이 동시에 바꾼 탭이 있으면 그것도 따라온다).
 */
async function apply(slug: string, tabs: Record<string, boolean>): Promise<void> {
  const before = cache;
  const subs = { ...before[slug].subs, ...tabs };
  commit({
    ...before,
    [slug]: { enabled: Object.values(subs).some(Boolean), subs },
  });
  try {
    const saved = await putModuleFeatures(slug, tabs);
    // 화면이 아는 탭만 받아들인다 — 첫 로드(moduleStateFromServer)와 같은 규칙. 서버 카탈로그에만 있는 탭이
    // 섞여 오면 화면에 보이지 않는 탭 하나가 켜져 있어 모듈이 「켜짐」으로 남는다(경영지원 materials 가 그랬다).
    const known = new Set((MODULE_BY_SLUG[slug]?.subfunctions ?? []).map((s) => s.id));
    const accepted = Object.fromEntries(Object.entries(saved.tabs).filter(([id]) => known.has(id)));
    const merged = { ...cache[slug].subs, ...accepted };
    commit({
      ...cache,
      [slug]: { enabled: Object.values(merged).some(Boolean), subs: merged },
    });
  } catch (e) {
    // 되돌린다. 그 사이 다른 모듈이 바뀌었을 수 있어 이 모듈만 이전 값으로
    commit({ ...cache, [slug]: before[slug] });
    throw e;
  }
}

/**
 * 모듈 전체 ON/OFF — 서브기능 일괄 적용. `only` 를 주면 그 탭들만 바꾼다(내 직급이 가진 탭만 만질 수 있는 경우).
 */
function setModule(slug: string, on: boolean, only?: string[]): Promise<void> {
  const keys = only ?? Object.keys(cache[slug].subs);
  return apply(slug, Object.fromEntries(keys.map((k) => [k, on])));
}

/** 서브기능 단위 ON/OFF */
function setSub(slug: string, sub: string, on: boolean): Promise<void> {
  return apply(slug, { [sub]: on });
}

// 로그인 · 회사 선택 · 로그아웃 — 다른 회사의 기능 상태가 남지 않게 다시 받는다
if (typeof window !== "undefined") {
  window.addEventListener(SESSION_CHANGED, () => {
    invalidateModules();
  });
}

export function useModules() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    void ensureLoaded();
    const again = () => void ensureLoaded();
    window.addEventListener(SESSION_CHANGED, again);
    return () => window.removeEventListener(SESSION_CHANGED, again);
  }, []);
  return { state, setModule, setSub };
}

/** 향후 컨텍스트 기반 상태로 교체할 수 있도록 경계만 유지 */
export function ModuleProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
