/**
 * 업로드 파일 검증. 예전 목업 라우트(`app/ai/sources`)에 있던 규칙을 그대로 옮겼다.
 *
 * 화면의 파일 선택창 `accept` 와 같은 목록이어야 한다(`app/(app)/ai-chat/page.tsx` 의 input).
 */
import "server-only";
import { HttpError } from "./http";

export const MAX_FILES = 10;
export const MAX_BYTES = 20 * 1024 * 1024;
const MAX_NAME = 200;

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** 확장자 위조 방지 — 마지막 점 뒤만 본다 */
export function ext(name: string): string {
  return name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
}

/** 경로 조작 방지 — `/` 와 `\` 둘 다 잘라낸다. 길이는 확장자를 살린 채 줄인다 */
export function safeName(raw: string): string {
  const base = raw.split(/[\\/]/).pop()?.trim() || "문서";
  if (base.length <= MAX_NAME) return base;
  const e = ext(base);
  // 그냥 자르면 확장자가 날아가 정상 파일이 415 로 막힌다
  return e ? `${base.slice(0, MAX_NAME - e.length - 1)}.${e}` : base.slice(0, MAX_NAME);
}

export function contentTypeOf(type: string): string {
  return CONTENT_TYPES[type] ?? "application/octet-stream";
}

/** 검증을 통과한 파일 하나. `name` 은 정제된 값, `type` 은 소문자 확장자 */
export interface CheckedFile {
  file: File;
  name: string;
  type: string;
}

/**
 * multipart `files` 필드를 검증한다. 하나라도 어긋나면 전체를 거절한다 — 일부만 올라가면 화면이
 * 어느 파일이 실패했는지 다시 물어야 하고, 사용자는 같은 묶음을 다시 고르는 편이 쉽다.
 */
export function checkFiles(files: File[]): CheckedFile[] {
  if (!files.length) throw new HttpError(400, "VALIDATION_FAILED", "파일이 없어요");
  if (files.length > MAX_FILES) {
    throw new HttpError(400, "TOO_MANY_FILES", `한 번에 ${MAX_FILES}개까지 올릴 수 있어요`);
  }
  return files.map((f) => {
    const name = safeName(f.name);
    const type = ext(name);
    if (!(type in CONTENT_TYPES)) {
      throw new HttpError(415, "UNSUPPORTED_TYPE", `${name}은(는) 올릴 수 없는 형식이에요`);
    }
    if (f.size > MAX_BYTES) {
      throw new HttpError(413, "FILE_TOO_LARGE", `${name}이(가) 20MB를 넘어요`);
    }
    if (f.size === 0) {
      throw new HttpError(400, "VALIDATION_FAILED", `${name}이(가) 빈 파일이에요`);
    }
    return { file: f, name, type };
  });
}
