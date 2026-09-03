"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 점 격자 반응 값 — 시안 '은은'(2026-09-03 확정). 조절판에서 눈으로 잡은 값이라 임의로 바꾸지 않는다.
 * 커서에 가까운 점이 밝아지고 · 살짝 커지고 · 아주 조금 끌려온다. 방향은 틀지 않는다.
 */
const DOT = {
  /** 점 간격(px) */
  gap: 16,
  /** 기본 반지름(px) */
  r: 1,
  /** 쉴 때 투명도 */
  base: 0.22,
  /** 커서가 닿는 거리(px) */
  reach: 150,
  /** 커서 바로 아래 투명도 */
  lit: 0.5,
  /** 강조 색에 primary를 섞는 비율 */
  tint: 0.25,
  /** 가까울 때 반지름 배수 */
  grow: 0.6,
  /** 커서 쪽으로 당겨지는 최대 거리(px) */
  pull: 1,
  /** 가장자리로 갈수록 옅어지는 정도 */
  fade: 0.55,
} as const;

/** slate-400 / primary-600 — 캔버스는 토큰을 못 읽으므로 여기서만 값을 갖는다 */
const DOT_RGB = [148, 163, 184] as const;
const ACCENT_RGB = [10, 80, 255] as const;

/**
 * AI 첫 화면 앰비언트 배경 — 중앙 블룸 위에 점 격자가 얹힌다.
 *
 * 블룸은 배경 레이어에 있고 중심 높이만 입력창을 따라간다(`--bloom-y`). 그래서 입력창이 바닥으로
 * 미끄러져도 위치가 어긋나지 않고, 퇴장할 때는 배경과 한 몸으로 움직인다. 블룸 자체는 커서를 따라다니지 않는다 —
 * 움직이는 건 점뿐이라 시선이 갈리지 않는다.
 *
 * 점은 커서에 자기장처럼 반응하되 방향은 틀지 않는다. 커서가 멈추면 배경도 완전히 정지한다.
 * `visible`이 false가 되면 아래로 80px 미끄러지며 400ms에 옅어진 뒤 `onHidden`을 부른다 — 그 동안 커서 반응은 멈춘다.
 * 새 대화로 돌아오면 같은 길이로 아래에서 다시 올라온다. reduced-motion이면 반응과 미끄러짐을 모두 끄고,
 * 전환이 없어 `transitionend`가 오지 않으므로 타이머로도 퇴장을 끝낸다(안 그러면 rAF 루프가 계속 돈다).
 */
export function AiBackdrop({
  visible,
  onHidden,
  anchorRef,
}: {
  visible: boolean;
  onHidden: () => void;
  /** 블룸 중심을 맞출 기준 — 입력창 */
  anchorRef: React.RefObject<HTMLElement | null>;
}) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  // 마운트 직후 한 프레임 뒤에 올려서 떠오르는 전환이 걸리게 한다
  const [shown, setShown] = useState(false);
  // 퇴장 중에는 커서 반응을 멈춘다 — 밝기가 튀지 않게. rAF 루프가 읽으므로 ref로 둔다
  const frozen = useRef(false);
  useEffect(() => {
    frozen.current = !visible;
  }, [visible]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // 퇴장은 transitionend로 끝나지만, reduced-motion이면 전환이 없어 그 이벤트가 오지 않는다.
  // 그러면 배경이 영원히 마운트된 채 rAF 루프가 계속 돌므로 시간으로도 한 번 끝내 준다.
  useEffect(() => {
    if (visible) return;
    const t = setTimeout(onHidden, 500);
    return () => clearTimeout(t);
  }, [visible, onHidden]);

  useEffect(() => {
    const el = root.current;
    const cv = canvas.current;
    const host = el?.parentElement;
    const ctx = cv?.getContext("2d");
    if (!el || !cv || !host || !ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    // 커서 — 아직 움직인 적이 없으면 반응하지 않는다
    let cx = -1e4;
    let cy = -1e4;
    // 블룸·페이드의 중심 — 입력창 한가운데. 배경은 페이지 전체를 덮지만 기준은 대화 쪽이다
    let ax = 0;
    let ay = 0;
    let raf = 0;
    let dirty = true;

    function resize() {
      const r = host!.getBoundingClientRect();
      w = r.width;
      h = r.height;
      cv!.width = Math.max(1, Math.round(w * dpr));
      cv!.height = Math.max(1, Math.round(h * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      dirty = true;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    function onMove(e: MouseEvent) {
      if (still || frozen.current) return;
      const r = host!.getBoundingClientRect();
      cx = e.clientX - r.left;
      cy = e.clientY - r.top;
      dirty = true;
    }
    function onLeave() {
      cx = -1e4;
      cy = -1e4;
      dirty = true;
    }
    host.addEventListener("mousemove", onMove);
    host.addEventListener("mouseleave", onLeave);

    function draw() {
      const { gap, r: dotR, base, reach, lit, tint, grow, pull, fade } = DOT;
      ctx!.clearRect(0, 0, w, h);
      const maxD = Math.hypot(w, h) * 0.62;

      for (let y = gap / 2; y < h; y += gap) {
        for (let x = gap / 2; x < w; x += gap) {
          const dx = cx - x;
          const dy = cy - y;
          const d = Math.hypot(dx, dy);
          // 반경 밖은 완전히 기본 상태 — smoothstep으로 경계가 드러나지 않게
          let n = d >= reach ? 0 : 1 - d / reach;
          n = n * n * (3 - 2 * n);

          const edge = 1 - fade * (Math.hypot(x - ax, y - ay) / maxD) ** 1.8;
          if (edge <= 0) continue;

          const a = (base + (lit - base) * n) * edge;
          if (a <= 0.012) continue;

          const mix = tint * n;
          const c = DOT_RGB.map((v, i) =>
            Math.round(v + (ACCENT_RGB[i] - v) * mix),
          );

          let ox = 0;
          let oy = 0;
          if (pull > 0 && d > 0.001) {
            const k = (pull * n) / d;
            ox = dx * k;
            oy = dy * k;
          }

          ctx!.beginPath();
          ctx!.arc(x + ox, y + oy, dotR * (1 + grow * n), 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
          ctx!.fill();
        }
      }
    }

    /**
     * 블룸·페이드 중심을 입력창 한가운데에 맞춘다 — 입력창이 미끄러지는 300ms 동안 같이 따라간다.
     * 배경은 페이지 전체를 덮지만 레일·패널이 그 위를 가리므로, 페이지 중심이 아니라 대화 쪽을 기준으로 잡아야 한다.
     */
    function trackAnchor() {
      const anchor = anchorRef.current;
      if (h <= 0) return;
      if (!anchor) {
        ax = w / 2;
        ay = h / 2;
        return;
      }
      const hr = host!.getBoundingClientRect();
      const ar = anchor.getBoundingClientRect();
      const nx = ar.left + ar.width / 2 - hr.left;
      const ny = ar.top + ar.height / 2 - hr.top;
      if (nx !== ax || ny !== ay) {
        ax = nx;
        ay = ny;
        dirty = true;
        el!.style.setProperty("--bloom-x", `${((ax / w) * 100).toFixed(2)}%`);
        el!.style.setProperty("--bloom-y", `${((ay / h) * 100).toFixed(2)}%`);
      }
    }

    function frame() {
      trackAnchor();
      if (dirty && w > 0) {
        draw();
        dirty = false;
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      host.removeEventListener("mousemove", onMove);
      host.removeEventListener("mouseleave", onLeave);
    };
  }, [anchorRef]);

  const up = shown && visible;

  return (
    <div
      ref={root}
      aria-hidden
      onTransitionEnd={(e) => {
        if (!visible && e.target === e.currentTarget) onHidden();
      }}
      className={`pointer-events-none absolute inset-0 overflow-hidden transition-[opacity,transform] duration-[400ms] ease-out motion-reduce:transition-none ${
        up ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
      }`}
    >
      {/* 중앙 블룸 — 정적이다. 중심 높이만 입력창을 따라간다 */}
      <div className="ai-bloom absolute inset-0" />
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
