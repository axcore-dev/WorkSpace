"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getAccountMe, type AccountMeDto } from "@/lib/account-api";
import { SESSION_CHANGED } from "@/lib/session";

/**
 * "나는 누구인가" — `GET /api/auth/me` 를 한 번 받아 두는 스토어.
 *
 * `lib/workspace-me.ts` 와 같은 모양이지만 대상이 다르다. 저기는 **지금 고른 회사**에서의 자격이고,
 * 여기는 회사와 무관한 계정이다 — 이름 · 이메일 · 프로필 사진.
 *
 * **스토어여야 하는 이유**: 같은 값을 세 곳이 그린다. 사이드바 아래 프로필(`app-shell`), 설정 내비의
 * 프로필(`settings-shell`), 그리고 계정 화면이다. 각자 받으면 같은 요청이 셋 나가고, 계정 화면에서
 * 사진을 바꿔도 사이드바는 옛 사진을 들고 있다 — 실제로 그렇게 보였다.
 *
 * 바꾼 쪽이 서버 응답을 {@link setAccountMe} 로 넣으면 세 곳이 함께 바뀐다.
 */
type State = { me: AccountMeDto | null; status: "idle" | "loading" | "ready" | "error" };

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
    loading = getAccountMe()
      .then((me) => commit({ me, status: "ready" }))
      .catch(() => commit({ me: null, status: "error" }))
      .finally(() => {
        loading = null;
      });
  }
  return loading;
}

/** 바꾼 쪽이 서버 응답을 그대로 넣는다. 다시 받지 않는다 — 응답이 이미 최신이다. */
export function setAccountMe(me: AccountMeDto) {
  commit({ me, status: "ready" });
}

/** 다시 받는다. 값은 지우지 않는다 — 새 값이 오기 전까지 화면이 깜빡이지 않게 */
export function refreshAccountMe(): Promise<void> {
  if (state.status !== "loading") state = { ...state, status: "idle" };
  return ensureLoaded();
}

// 로그인 · 로그아웃으로 토큰이 바뀌면 이전 사람의 계정을 버린다
if (typeof window !== "undefined") {
  window.addEventListener(SESSION_CHANGED, () => {
    commit(INITIAL);
  });
}

export function useAccountMe() {
  const s = useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL,
  );
  useEffect(() => {
    void ensureLoaded();
    const again = () => void ensureLoaded();
    window.addEventListener(SESSION_CHANGED, again);
    return () => window.removeEventListener(SESSION_CHANGED, again);
  }, []);
  return { me: s.me, status: s.status };
}

/**
 * 사진이 없을 때 그리는 이름 첫 글자. 사이드바 · 설정 내비 · 계정 화면이 같은 규칙을 쓴다.
 * 한글 이름은 성을 뗀 두 자보다 한 자가 읽기 쉽고, 라틴 이름은 두 단어의 머리글자다.
 */
export function initialsOf(name: string | undefined | null): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return /[가-힣]/.test(trimmed) ? trimmed[0] : trimmed.slice(0, 2).toUpperCase();
}
