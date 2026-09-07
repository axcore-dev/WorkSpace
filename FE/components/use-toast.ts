"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** 토스트가 떠 있는 시간 (ms) */
const TOAST_MS = 2200;

export type ToastTone = "ink" | "error";
/**
 * `visible`이 따로 있는 이유: 시간이 다 되어도 **문구를 지우지 않는다.**
 *
 * 지워 버리면 요소가 그 자리에서 사라져서 나갈 때 애니메이션을 재생할 수 없다.
 * 문구는 남기고 보이기만 끈다 — 다음 토스트가 덮어쓴다.
 */
export type ToastState = { message: string; tone: ToastTone; visible: boolean } | null;

/**
 * 저장 피드백 토스트 상태. 표현은 `ui.tsx`의 `Toast`가 맡는다.
 *
 * 훅을 `ui.tsx`에 두지 않는 이유: 그 파일에는 `"use client"`가 없다 — 서버·클라이언트가
 * 같이 쓰는 모듈이다. 훅을 넣으면 `Card`·`Button`을 import하는 모든 서버 컴포넌트가
 * 클라이언트 경계로 끌려간다.
 *
 * `tone`을 받는 이유: BE 연동 시 저장 실패를 같은 자리에서 알려야 한다.
 */
export function useToast(): [ToastState, (message: string, tone?: ToastTone) => void] {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const show = useCallback((message: string, tone: ToastTone = "ink") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, tone, visible: true });
    // 문구는 남기고 보이기만 끈다 — 그래야 나가는 전환이 재생된다
    timer.current = setTimeout(
      () => setToast((t) => (t ? { ...t, visible: false } : t)),
      TOAST_MS,
    );
  }, []);

  return [toast, show];
}
