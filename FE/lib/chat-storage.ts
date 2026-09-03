/**
 * AI대화 기록 로컬 영속화.
 *
 * BE 대화 메모리 API가 서면 이 파일의 두 함수만 교체한다 — 호출부는 그대로 둔다.
 * 저장하는 건 대화 목록과 활성 대화 id뿐이다. 응답 대기·메뉴 열림 같은 휘발 상태는 담지 않는다.
 */
const KEY = "axpoint-chat-notes";

export interface StoredChat<N> {
  notes: N[];
  activeId: number | null;
}

export function loadChat<N>(): StoredChat<N> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredChat<N>;
    return data && Array.isArray(data.notes) ? data : null;
  } catch {
    // 손상된 값이면 없는 것으로 친다 — 빈 화면에서 다시 시작한다
    return null;
  }
}

export function saveChat<N>(data: StoredChat<N>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // 용량 초과·프라이빗 모드 — 저장을 포기하고 세션 상태로만 동작한다
  }
}
