"use client";

import { useRef, useState } from "react";
import { IconX } from "@/components/icons";
import { DEMO_USER } from "@/data/org";

/**
 * 계정 › 프로필 › 사진.
 *
 * **버튼을 따로 두지 않는다** — 사진 자체가 버튼이다 (수정요청 v12). 호버하면 위에
 * `사진 변경`이 덮이고, 사진이 있으면 우상단 (x)로 기본 이미지로 돌아간다.
 *
 * (x)를 사진 위에 겹치므로 `title`(브라우저 기본 툴팁)이 아니라 직접 그린 라벨을 쓴다 —
 * 기본 툴팁은 500ms 뒤에 뜨고 위치를 정할 수 없어서 (x)와 겹친다.
 *
 * **BE 연동 seam**: 업로드 API가 없다 (`docs/be/account-api-postman-test.md`의 계정 API
 * 15개에 프로필 사진이 없다). 지금은 고른 파일을 `URL.createObjectURL`로 미리보기만 한다 —
 * 새로고침하면 사라진다. API가 생기면 `pick`에서 올리고 응답 URL을 쓴다.
 */
export function ProfilePhoto({ onSaved }: { onSaved: (message: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function pick(file: File | undefined) {
    if (!file) return;
    // 이전 미리보기를 놓아준다 — 안 하면 고를수록 blob이 쌓인다
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    onSaved("사진을 바꿨어요");
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    onSaved("기본 이미지로 되돌렸어요");
  }

  return (
    <div className="relative w-14">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => pick(e.target.files?.[0])}
      />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        aria-label="사진 변경"
        className="group relative flex h-14 w-14 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
      >
        {preview ? (
          // 사용자가 방금 고른 파일이라 next/image의 최적화가 걸리지 않는다
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          // `leading-none`이 있어야 가운데로 온다. 기본 line-height는 라틴 문자 기준이라
          // 한글 글리프가 그 안에서 아래로 치우친다 — flex 중앙 정렬은 줄 상자를 맞출 뿐
          // 글자를 맞추지 않는다.
          <span aria-hidden className="text-xl font-bold leading-none text-white">
            {DEMO_USER.initials}
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-slate-900/70 text-[10px] font-semibold leading-tight text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
          사진 변경
        </span>
      </button>

      {/* 사진이 있을 때만 — 기본 이미지에는 되돌릴 게 없다 */}
      {preview && (
        <button
          type="button"
          onClick={reset}
          aria-label="기본 이미지로"
          className="absolute -right-1 -top-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-sm transition-colors duration-150 hover:border-slate-400 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
        >
          <IconX size={11} />
        </button>
      )}
    </div>
  );
}
