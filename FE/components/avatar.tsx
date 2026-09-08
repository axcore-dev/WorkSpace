"use client";

import { useState } from "react";
import { initialsOf } from "@/lib/account-me";

/**
 * 프로필 사진 한 장. 사이드바 · 설정 내비 · 계정 화면이 같은 것을 그린다.
 *
 * 주소가 있으면 사진, 없으면 이름 첫 글자다. 주소는 서버가 하나로 정해서 준다
 * (`GET /api/auth/me` 의 `avatarUrl` — 올린 사진이면 우리 경로, 아니면 소셜 제공자 주소).
 *
 * **못 그린 주소는 첫 글자로 되돌린다.** 소셜 제공자가 사진을 내리거나 CSP 가 막으면 깨진 이미지
 * 아이콘이 남는데, 그것보다 첫 글자가 낫다. 주소가 바뀌면 다시 시도한다.
 */
export function Avatar({
  name,
  src,
  size,
  className = "",
}: {
  name: string;
  src: string | null;
  /** 지름(px). 글자 크기는 여기서 따라간다 */
  size: number;
  className?: string;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  const shown = src && src !== broken ? src : null;

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 ${className}`}
      style={{ width: size, height: size }}
    >
      {shown ? (
        // 우리 주소이거나 소셜 제공자 주소다. next/image 의 도메인 허용 목록을 쓰지 않는다
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shown}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setBroken(shown)}
        />
      ) : (
        // `leading-none`이 있어야 가운데로 온다. 기본 line-height는 라틴 문자 기준이라
        // 한글 글리프가 그 안에서 아래로 치우친다 — flex 중앙 정렬은 줄 상자를 맞출 뿐
        // 글자를 맞추지 않는다.
        <span
          aria-hidden
          className="font-bold leading-none text-white"
          style={{ fontSize: Math.round(size * 0.36) }}
        >
          {initialsOf(name)}
        </span>
      )}
    </span>
  );
}
