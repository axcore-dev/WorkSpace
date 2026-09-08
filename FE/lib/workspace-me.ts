"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getWorkspaceMe, type WorkspaceMeDto } from "@/lib/workspace-api";

/**
 * "지금 이 회사에서 나는 누구인가" — `GET /api/workspace/me` 를 한 번 받아 두는 스토어.
 *
 * 설정 내비(권한 관리 항목을 보일지), 권한 관리 페이지(들어올 수 있는지), 직급 편집기(내 권한 안인지)가
 * 같은 값을 본다. `components/module-provider.tsx` 와 같은 모양(외부 스토어 + 첫 사용 시 한 번 받기)이다.
 *
 * **보안 경계가 아니다.** 이 값으로 잠근 버튼을 우회해 요청을 보내면 BE 의 `TenantContext` 가 403 으로 막는다.
 *
 * 받기 전(`idle`·`loading`)에는 `me` 가 null 이다. 화면은 그 동안 "아직 모른다" 로 그려야 한다 —
 * 잠긴 것처럼도, 열린 것처럼도 그리지 않는다. 내 권한이 바뀌었을 수 있으면 `refreshWorkspaceMe()` 를 부른다.
 */
export type WorkspaceMeStatus = "idle" | "loading" | "ready" | "error";

type State = { me: WorkspaceMeDto | null; status: WorkspaceMeStatus };

const INITIAL: State = { me: null, status: "idle" };

let state: State = INITIAL;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

function ensureLoaded(): Promise<void> {
  if (state.status === "ready" || state.status === "error") return Promise.resolve();
  if (!loading) {
    commit({ ...state, status: "loading" });
    loading = getWorkspaceMe()
      .then((me) => commit({ me, status: "ready" }))
      .catch(() => commit({ me: null, status: "error" }))
      .finally(() => {
        loading = null;
      });
  }
  return loading;
}

/** 다시 받는다. 값은 지우지 않는다 — 새 값이 오기 전까지 화면이 깜빡이지 않게 */
export function refreshWorkspaceMe(): Promise<void> {
  if (state.status !== "loading") state = { ...state, status: "idle" };
  return ensureLoaded();
}

export function useWorkspaceMe() {
  const s = useSyncExternalStore(subscribe, () => state, () => INITIAL);
  useEffect(() => {
    void ensureLoaded();
  }, []);
  return { me: s.me, status: s.status, refresh: refreshWorkspaceMe };
}

/** 권한 관리 화면을 열 수 있는가 — 소유자 또는 관리자. 받기 전에는 false 다 */
export function canManageRoles(me: WorkspaceMeDto | null): boolean {
  return !!me && (me.member.owner || me.member.admin);
}
