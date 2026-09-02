"use client";

import { useEffect, useRef } from "react";

/**
 * AI 첫 화면 앰비언트 배경 — primary 오로라 덩어리 3개(`.ai-aurora`, 20s)와 커서를 따라다니는 글로우.
 * 부모(`relative`)의 mousemove를 rAF로 묶어 좌표만 옮긴다. 대화가 시작되면 렌더하지 않는다.
 * reduced-motion이면 글로우는 중앙에 고정된다.
 */
export function AiBackdrop() {
  const glow = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = glow.current;
    const host = el?.parentElement?.parentElement;
    if (!el || !host || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    function onMove(e: MouseEvent) {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = host!.getBoundingClientRect();
        el!.style.left = `${e.clientX - r.left}px`;
        el!.style.top = `${e.clientY - r.top}px`;
      });
    }
    host.addEventListener("mousemove", onMove);
    return () => {
      host.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <span className="ai-aurora absolute left-[10%] top-[12%] h-[42%] w-[38%] rounded-full bg-primary-600/8 blur-3xl" />
      <span className="ai-aurora absolute right-[6%] top-[38%] h-[46%] w-[34%] rounded-full bg-primary-400/12 blur-3xl [animation-delay:-7s]" />
      <span className="ai-aurora absolute bottom-[4%] left-[28%] h-[36%] w-[46%] rounded-full bg-primary-200/18 blur-3xl [animation-delay:-13s]" />
      <span
        ref={glow}
        className="absolute left-1/2 top-[40%] h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left,top] duration-200 ease-out"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--color-primary-600) 10%, transparent), transparent 70%)",
        }}
      />
    </div>
  );
}
