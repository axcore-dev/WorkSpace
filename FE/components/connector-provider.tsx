"use client";

import { useEffect, useSyncExternalStore } from "react";
import { SESSION_CHANGED } from "@/lib/session";
import {
  getConnectors,
  putConnectorService,
  type ConnectorsDto,
  type ExternalSystemDto,
} from "@/lib/workspace-api";

/**
 * 커넥터 연결 상태의 외부 스토어 — **서버가 원본**이다 (`/api/workspace/connectors`).
 *
 * `components/module-provider.tsx` 와 같은 모양이다. 첫 렌더(SSR 포함)는 빈 상태로 그리고, 클라이언트에서
 * 처음 불릴 때 서버 값을 한 번 받는다. `/ai-chat` 과 설정 › 연동이 서로 다른 라우트 그룹에 있어서
 * (`(app)` / `(settings)`) 공통 조상이 루트 레이아웃뿐이라 컨텍스트가 아니라 모듈 레벨 스토어다.
 *
 * **연결과 켜기는 다르다.** 여기 담기는 건 "회사가 계정을 연결해 뒀나" 고, AI 대화 입력창의 칩은
 * "이번 대화에서 쓸까" 다. 연결을 끊으면 칩도 사라지지만, 칩을 끈다고 연결이 끊기지는 않는다.
 *
 * 저장은 낙관적이다 — 화면을 먼저 바꾸고 서버에 보낸다. 실패하면 되돌리고 호출부에 거절을 알린다.
 * 예전에는 브라우저 localStorage 였다. 브라우저를 바꾸면 연결이 사라졌고 같은 회사의 두 사람이
 * 서로 다른 상태를 봤다.
 */
const EMPTY: ConnectorsDto = { systems: [], services: [], editable: false };

let cache: ConnectorsDto = EMPTY;
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): ConnectorsDto {
  return cache;
}

function getServerSnapshot(): ConnectorsDto {
  return EMPTY;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(next: ConnectorsDto) {
  cache = next;
  listeners.forEach((l) => l());
}

/** 서버 값을 한 번 받는다. 여러 화면이 동시에 불러도 요청은 하나다. */
function ensureLoaded(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (!loading) {
    loading = getConnectors()
      .then(commit)
      .catch(() => {
        // 로그인 전 · 회사 선택 전 · 네트워크 오류. 빈 상태로 둔다 — 저장 시도에서 진짜 오류가 드러난다
      })
      .finally(() => {
        loaded = true;
        loading = null;
      });
  }
  return loading;
}

/** 다음 마운트에서 다시 받게 한다. 회사를 바꾸거나 로그인이 새로 됐을 때. */
export function invalidateConnectors() {
  loaded = false;
}

/** 연결·해제 — 낙관적 갱신 + 실패 시 되돌림. 서버 응답으로 전체를 다시 맞춘다. */
async function setConnected(slug: string, on: boolean): Promise<void> {
  const before = cache;
  const services = on
    ? [...before.services, slug].filter((s, i, all) => all.indexOf(s) === i)
    : before.services.filter((s) => s !== slug);
  commit({ ...before, services });
  try {
    commit(await putConnectorService(slug, on));
  } catch (e) {
    commit(before);
    throw e;
  }
}

const connect = (slug: string) => setConnected(slug, true);
const disconnect = (slug: string) => setConnected(slug, false);

// 로그인 · 회사 선택 · 로그아웃 — 다른 회사의 연결 상태가 남지 않게 다시 받는다
if (typeof window !== "undefined") {
  window.addEventListener(SESSION_CHANGED, () => {
    invalidateConnectors();
  });
}

/**
 * 연결된 커넥터 slug 와 연결·해제. 설정 › 연동은 `systems`·`editable` 도 쓴다.
 *
 * `connect`·`disconnect` 는 저장이 끝나면 resolve 하고 거절되면 reject 한다 — 결과를 알려야 하는
 * 화면은 받아서 토스트를 띄우고, 그렇지 않은 화면은 스토어가 되돌리는 것으로 충분하다.
 */
export function useConnectors(): {
  connected: string[];
  systems: ExternalSystemDto[];
  editable: boolean;
  connect: (slug: string) => Promise<void>;
  disconnect: (slug: string) => Promise<void>;
} {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    void ensureLoaded();
    const again = () => void ensureLoaded();
    window.addEventListener(SESSION_CHANGED, again);
    return () => window.removeEventListener(SESSION_CHANGED, again);
  }, []);
  return {
    connected: state.services,
    systems: state.systems,
    editable: state.editable,
    connect,
    disconnect,
  };
}
