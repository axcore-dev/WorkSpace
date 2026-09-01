"use client";

import { useEffect, useState } from "react";

/**
 * 사이드바 접힘 상태. 이 브라우저에만 남는다.
 *
 * 첫 렌더는 항상 펼침(false)으로 시작하고, 마운트 뒤 마이크로태스크에서 저장값을 읽는다.
 * 프리렌더 결과와 어긋나지 않게 하려는 것이다 — 생성 폼의 임시 저장과 같은 방식
 * (`data/admin.ts` DRAFT 주석 참조).
 *
 * localStorage 접근은 try/catch로 감싼다. 사생활 보호 모드나 저장 차단 설정에서
 * 접근 자체가 예외를 던진다.
 */
export function useSidebarCollapsed(key: string): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        setCollapsed(localStorage.getItem(key) === "1");
      } catch {
        /* 저장값을 못 읽으면 펼침으로 둔다 */
      }
    });
  }, [key]);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(key, next ? "1" : "0");
      } catch {
        /* 저장 못 해도 이 세션에서는 접힌다 */
      }
      return next;
    });
  }

  return [collapsed, toggle];
}
