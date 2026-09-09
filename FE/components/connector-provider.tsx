"use client";

import { useEffect, useSyncExternalStore } from "react";
import { SESSION_CHANGED } from "@/lib/session";
import {
  completeConnectorAuth,
  disconnectConnector,
  getConnectors,
  setConnectorEnabled,
  startConnectorAuth,
  type ConnectorAccountDto,
  type ConnectorRegisteredDto,
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
 * **세 가지 상태가 있다.**
 * - 등록(`registered`): 한 번 연결해 둔 앱. 꺼도 목록에 남는다 — 제공자 토큰이 그 앱의 권한을 이미 덮는다.
 * - 켜짐(`registered[].enabled` → `connected`): AI 대화가 지금 쓸 수 있는 앱. 토글이 바꾼다. 재인증이 없다.
 * - 해제: 목록에서 지운다. 같은 계정을 쓰는 마지막 앱이면 제공자 토큰도 회수된다. 커넥터 팝업의 「연결 해제」만 한다.
 *
 * **연결은 OAuth 다.** 등록되지 않은 앱의 `connect(slug)` 는 서버에서 동의 화면 주소를 받아 브라우저를 보낸다 —
 * 돌아오지 않는다. 등록된 앱이면 그냥 켠다. 제공자가 콜백으로 돌려보내면 `complete()` 가 code 를 서버에
 * 넘기고 결과를 **알림(`notice`)** 으로 남긴다. 연동 화면이 그걸 모달로 보인다 — 콜백 화면 자체는 아무것도
 * 그리지 않고 곧장 돌아온다.
 */
const EMPTY: ConnectorsDto = { systems: [], services: [], registered: [], accounts: [], editable: false };

/** 연결 시도의 결과. 연동 화면이 모달로 보이고 닫으면 비운다 */
export type ConnectorNotice = { slug: string; ok: boolean; message: string };

let cache: ConnectorsDto = EMPTY;
let notice: ConnectorNotice | null = null;
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

function notify() {
  listeners.forEach((l) => l());
}

/** 서버 응답을 그대로 믿지 않는다 — 옛 서버나 부분 응답이 와도 화면이 undefined 를 읽지 않게 빈 배열로 채운다 */
function commit(next: ConnectorsDto) {
  cache = {
    systems: next.systems ?? [],
    services: next.services ?? [],
    registered: next.registered ?? [],
    accounts: next.accounts ?? [],
    editable: !!next.editable,
  };
  notify();
}

/** 서버 값을 한 번 받는다. 여러 화면이 동시에 불러도 요청은 하나다. */
function ensureLoaded(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (!loading) {
    loading = getConnectors()
      .then(commit)
      .catch(() => {
        // 로그인 전 · 회사 선택 전 · 네트워크 오류. 빈 상태로 둔다
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

/**
 * 연결 — 등록된 앱이면 그냥 켠다. 아니면 제공자 동의 화면으로 이동하고, 그 경우 이 약속은 끝나지 않는다
 * (페이지를 떠난다). 서버가 거절하면(권한 없음 · 설정 없음) reject 되고 화면이 토스트를 띄운다.
 */
async function connect(slug: string): Promise<void> {
  if (cache.registered.some((r) => r.slug === slug)) {
    commit(await setConnectorEnabled(slug, true));
    return;
  }
  const { url } = await startConnectorAuth(slug);
  window.location.assign(url);
  return new Promise(() => {});
}

/** 켜기/끄기 — 등록은 그대로. 꺼진 앱은 목록에 비활성으로 남는다 */
async function setEnabled(slug: string, enabled: boolean): Promise<void> {
  commit(await setConnectorEnabled(slug, enabled));
}

/** 해제 — 목록에서 지운다 */
async function disconnect(slug: string): Promise<void> {
  commit(await disconnectConnector(slug));
}

/** 콜백 화면이 부른다. 서버 응답으로 전체를 맞추고 성공 알림을 남긴다 */
export async function complete(slug: string, code: string, state: string): Promise<void> {
  commit(await completeConnectorAuth(slug, code, state));
  loaded = true;
  notice = { slug, ok: true, message: "" };
  notify();
}

/** 콜백 화면이 부른다. 실패 알림을 남긴다 — 연동 화면이 모달로 보인다 */
export function fail(slug: string, message: string) {
  notice = { slug, ok: false, message };
  notify();
}

export function dismissNotice() {
  notice = null;
  notify();
}

// 로그인 · 회사 선택 · 로그아웃 — 다른 회사의 연결 상태가 남지 않게 다시 받는다
if (typeof window !== "undefined") {
  window.addEventListener(SESSION_CHANGED, () => {
    invalidateConnectors();
  });
}

/**
 * 연결 상태와 동작. `connected` 는 켜진 앱(AI 칩), `registered` 는 목록(연동 화면).
 * `connect` 는 등록 안 된 앱이면 페이지를 떠나고, 나머지는 저장이 끝나면 resolve · 거절되면 reject 한다.
 */
export function useConnectors(): {
  connected: string[];
  registered: ConnectorRegisteredDto[];
  systems: ExternalSystemDto[];
  accounts: ConnectorAccountDto[];
  editable: boolean;
  notice: ConnectorNotice | null;
  connect: (slug: string) => Promise<void>;
  setEnabled: (slug: string, enabled: boolean) => Promise<void>;
  disconnect: (slug: string) => Promise<void>;
  dismissNotice: () => void;
} {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const current = useSyncExternalStore(
    subscribe,
    () => notice,
    () => null,
  );
  useEffect(() => {
    void ensureLoaded();
    const again = () => void ensureLoaded();
    window.addEventListener(SESSION_CHANGED, again);
    return () => window.removeEventListener(SESSION_CHANGED, again);
  }, []);
  return {
    connected: state.services,
    registered: state.registered,
    systems: state.systems,
    accounts: state.accounts,
    editable: state.editable,
    notice: current,
    connect,
    setEnabled,
    disconnect,
    dismissNotice,
  };
}
