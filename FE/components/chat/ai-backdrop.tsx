"use client";

import { useEffect, useRef, useState } from "react";

/** 덩이 중심(%, 부모 기준) — 아래 CSS 위치와 맞춘다. 커서까지의 거리로 밝기를 정한다 */
const CENTERS = [
  { x: 29, y: 33 },
  { x: 77, y: 61 },
  { x: 51, y: 78 },
];
/** 휴지 밝기. 이 값을 1로 보고 0.6–1.35× 사이를 움직인다(opacity 상한 1 = 1.35×) */
const REST = 0.74;

/**
 * AI 첫 화면 앰비언트 배경 — primary 오로라 덩이 3개(`.ai-aurora`, 20s).
 * 커서는 광원이다: 덩이는 움직이지 않고, 커서에 가까운 덩이가 밝아지고 먼 덩이가 옅어진다.
 * 부모(`relative`)의 mousemove를 rAF로 묶어 opacity만 바꾸고, 커서가 나가면 휴지 밝기로 돌아온다.
 * `visible`이 false가 되면 500ms로 옅어진 뒤 `onHidden`을 부른다. reduced-motion이면 광원 반응을 끈다.
 */
export function AiBackdrop({
  visible,
  onHidden,
}: {
  visible: boolean;
  onHidden: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  // 마운트 직후 한 프레임 뒤에 켜서 페이드인이 걸리게 한다
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const el = root.current;
    const host = el?.parentElement;
    if (
      !el ||
      !host ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const blobs = Array.from(el.children) as HTMLElement[];
    let raf = 0;
    function onMove(e: MouseEvent) {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = host!.getBoundingClientRect();
        const mx = ((e.clientX - r.left) / r.width) * 100;
        const my = ((e.clientY - r.top) / r.height) * 100;
        CENTERS.forEach((c, i) => {
          // 0(커서가 덩이 위) ~ 약 1.2(대각 반대편). 가까우면 1.0, 멀면 0.6×REST
          const d = Math.hypot(mx - c.x, my - c.y) / 100;
          blobs[i].style.opacity = String(
            Math.min(1, Math.max(REST * 0.6, 1 - d * 0.9)),
          );
        });
      });
    }
    function onLeave() {
      cancelAnimationFrame(raf);
      raf = 0;
      blobs.forEach((b) => (b.style.opacity = String(REST)));
    }
    host.addEventListener("mousemove", onMove);
    host.addEventListener("mouseleave", onLeave);
    return () => {
      host.removeEventListener("mousemove", onMove);
      host.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={root}
      aria-hidden
      onTransitionEnd={(e) => {
        // 덩이들의 opacity 전환도 여기로 버블링된다 — 자기 자신의 페이드아웃만 본다
        if (!visible && e.target === e.currentTarget) onHidden();
      }}
      className={`pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-500 ease-out ${
        shown && visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <span
        style={{ opacity: REST }}
        className="ai-aurora absolute left-[10%] top-[12%] h-[42%] w-[38%] rounded-full bg-primary-600/10 blur-3xl transition-opacity duration-300"
      />
      <span
        style={{ opacity: REST }}
        className="ai-aurora absolute right-[6%] top-[38%] h-[46%] w-[34%] rounded-full bg-primary-400/16 blur-3xl transition-opacity duration-300 [animation-delay:-7s]"
      />
      <span
        style={{ opacity: REST }}
        className="ai-aurora absolute bottom-[4%] left-[28%] h-[36%] w-[46%] rounded-full bg-primary-200/24 blur-3xl transition-opacity duration-300 [animation-delay:-13s]"
      />
    </div>
  );
}
