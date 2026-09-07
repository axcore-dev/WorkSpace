"use client";

import { useSyncExternalStore } from "react";
import {
  defaultConnectors,
  loadConnectors,
  saveConnectors,
} from "@/lib/connector-state";

/**
 * 커넥터 연결 상태의 외부 스토어 (localStorage 동기화).
 *
 * `components/module-provider.tsx`와 같은 모양이다. SSR에서는 기본값으로 그리고
 * 클라이언트에서 저장된 값으로 재조정된다.
 *
 * 모듈 레벨 스토어라 프로바이더가 없다 — `/ai-chat`과 설정 › 연동이 서로 다른 라우트
 * 그룹에 있어서(`(app)` / `(settings)`) 공통 조상이 루트 레이아웃뿐이다. 컨텍스트로
 * 하려면 그 위에 올려야 하는데, 그러면 커넥터를 안 쓰는 화면까지 전부 클라이언트 경계로
 * 끌려간다.
 */
const SERVER_SNAPSHOT = defaultConnectors();

let cache: string[] | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): string[] {
  if (cache === null) cache = loadConnectors();
  return cache;
}

function getServerSnapshot(): string[] {
  return SERVER_SNAPSHOT;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(next: string[]) {
  cache = next;
  saveConnectors(next);
  listeners.forEach((l) => l());
}

function connect(slug: string) {
  const cur = getSnapshot();
  if (cur.includes(slug)) return;
  commit([...cur, slug]);
}

function disconnect(slug: string) {
  commit(getSnapshot().filter((s) => s !== slug));
}

/** 연결된 커넥터 slug 목록과 연결·해제 */
export function useConnectors() {
  const connected = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { connected, connect, disconnect };
}
