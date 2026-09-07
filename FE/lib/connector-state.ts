import { CONNECTOR_LIB } from "@/data/chat";

/**
 * 외부 서비스(커넥터) 연결 상태 — 연결된 slug 목록.
 *
 * **왜 필요한가**: `/ai-chat`과 `설정 › 워크스페이스 › 연동`이 같은 사실을 다룬다.
 * 예전에는 두 화면이 각자 `useState`를 `CONNECTOR_LIB.filter(c => c.connected)`로
 * 초기화해서 서로를 몰랐다 — 설정에서 Slack을 끊어도 AI 대화 입력창에는 그대로 있었다.
 * 여기가 그 하나의 출처다 (수정요청 v12).
 *
 * `lib/module-state.ts`와 같은 모양이다 — localStorage + `useSyncExternalStore`.
 *
 * **연결과 켜기는 다르다.** 여기 담기는 건 "계정을 연결해 뒀나"고, AI 대화 입력창의 칩은
 * "이번 대화에서 쓸까"다. 연결을 끊으면 칩도 사라지지만, 칩을 끈다고 연결이 끊기지는 않는다.
 *
 * **BE 연동 seam**: 커넥터 연결·해제 API가 생기면 `save`가 그걸 부르고 이 파일이
 * 낙관적 갱신만 남는다. 키는 워크스페이스별로 갈라야 한다 — 지금은 데모라 하나다.
 */
const STORAGE_KEY = "axpoint-connectors";

/** 데모 기본 연결 — `CONNECTOR_LIB`의 `connected` 플래그가 시드다 */
export function defaultConnectors(): string[] {
  return CONNECTOR_LIB.filter((c) => c.connected).map((c) => c.slug);
}

export function loadConnectors(): string[] {
  if (typeof window === "undefined") return defaultConnectors();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConnectors();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return defaultConnectors();
    // 카탈로그에 없는 slug는 버린다 — 커넥터가 목록에서 빠져도 유령 연결이 남지 않게
    const known = new Set(CONNECTOR_LIB.map((c) => c.slug));
    return parsed.filter((s): s is string => typeof s === "string" && known.has(s));
  } catch {
    return defaultConnectors();
  }
}

export function saveConnectors(slugs: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
}
