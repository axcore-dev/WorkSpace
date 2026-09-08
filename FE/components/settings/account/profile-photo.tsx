"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { IconX } from "@/components/icons";
import {
  deleteProfilePhoto,
  uploadProfilePhoto,
  type AccountMeDto,
} from "@/lib/account-api";

/**
 * 계정 › 프로필 › 사진.
 *
 * **사진 자체가 버튼이다.** 호버하면 위에 `사진 변경`이 덮이고, 올린 사진이 있으면 우상단 (x)로 지운다.
 *
 * 값은 서버가 준 `avatarUrl` 이다. 올린 사진이면 우리 주소(`/api/avatars/...`)이고, 없으면 소셜
 * 로그인이 준 주소이며, 둘 다 없으면 이름 첫 글자를 그린다. 무엇인지 화면이 가리지 않는다 — 서버가
 * 하나로 정해서 준다. 바뀐 값은 스토어로 올려서 사이드바 프로필도 함께 바뀐다.
 *
 * **보내기 전에 브라우저에서 줄인다.** 요즘 휴대폰 사진은 한 장에 몇 MB 라 원본을 그대로 보내면
 * 상한(2MB)에 걸린다. 서버에서 줄이려면 이미지 라이브러리가 하나 더 필요하고, 프로필 사진은
 * 512px 정사각이면 충분하다. 잘라내는 기준은 가운데다.
 */
const MAX_EDGE = 512;
/** 줄인 뒤의 형식. WebP 가 같은 화질에서 가장 작고, 우리가 받는 형식 목록에 있다 */
const OUTPUT_TYPE = "image/webp";
const OUTPUT_QUALITY = 0.9;

export function ProfilePhoto({
  me,
  onChanged,
  onSaved,
}: {
  me: AccountMeDto;
  onChanged: (next: AccountMeDto) => void;
  onSaved: (message: string, tone?: "ink" | "error") => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  /** 올린 사진일 때만 (x)를 준다. 소셜 사진은 우리가 지울 수 있는 값이 아니다 */
  const removable = !!me.avatarUrl && me.avatarUrl.startsWith("/api/avatars/");

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const shrunk = await shrinkToSquare(file);
      onChanged(await uploadProfilePhoto(shrunk));
      onSaved("사진을 바꿨어요");
    } catch (e: unknown) {
      onSaved(e instanceof Error && e.message ? e.message : "사진을 올리지 못했어요", "error");
    } finally {
      setBusy(false);
      // 같은 파일을 다시 고를 수 있게 비운다 — 값이 같으면 change 가 안 뜬다
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    try {
      onChanged(await deleteProfilePhoto());
      onSaved("사진을 지웠어요");
    } catch (e: unknown) {
      onSaved(e instanceof Error && e.message ? e.message : "사진을 지우지 못했어요", "error");
    } finally {
      setBusy(false);
    }
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
        onChange={(e) => void pick(e.target.files?.[0])}
      />

      <button
        type="button"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        aria-label="사진 변경"
        className="group relative flex h-14 w-14 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-wait"
      >
        {/* 주소가 바뀌면 다시 그린다. key 를 주지 않으면 못 그린 표시가 새 사진에도 남는다 */}
        <Avatar key={me.avatarUrl ?? "none"} name={me.name} src={me.avatarUrl} size={56} />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-900/70 text-[10px] font-semibold leading-tight text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
          {busy ? "올리는 중" : "사진 변경"}
        </span>
      </button>

      {removable && !busy && (
        <button
          type="button"
          onClick={() => void remove()}
          aria-label="사진 지우기"
          className="absolute -right-1 -top-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-sm transition-colors duration-150 hover:border-slate-400 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
        >
          <IconX size={11} />
        </button>
      )}
    </div>
  );
}

/**
 * 가운데를 정사각으로 잘라 한 변 512px 이하로 줄인다.
 *
 * `createImageBitmap` 은 디코딩을 워커 스레드에서 해서 큰 사진에도 화면이 멈추지 않는다.
 * 캔버스가 비어 있는 결과를 줄 수 있어(메모리 부족·형식 문제) 그때는 실패로 알린다 —
 * 빈 파일을 올리면 서버가 어차피 400 이다.
 */
async function shrinkToSquare(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const edge = Math.min(bitmap.width, bitmap.height);
    const size = Math.min(edge, MAX_EDGE);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("이 브라우저에서는 사진을 줄일 수 없어요");
    ctx.drawImage(
      bitmap,
      (bitmap.width - edge) / 2,
      (bitmap.height - edge) / 2,
      edge,
      edge,
      0,
      0,
      size,
      size,
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, OUTPUT_TYPE, OUTPUT_QUALITY),
    );
    if (!blob || blob.size === 0) throw new Error("사진을 준비하지 못했어요");
    return blob;
  } finally {
    bitmap.close();
  }
}
