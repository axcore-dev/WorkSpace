/**
 * ⚠️ AI-MOCK — BE 연동 시 삭제 대상 ⚠️
 *
 * `POST /api/ai/sources` 업로드 목업. 파일을 저장하지 않고 메타만 돌려준다.
 * 계약은 `FE/lib/chat-api.ts` 주석 참고 — 필드명 `files`(multipart), 응답 `SourceDoc[]`.
 */
import type { SourceDoc } from "@/data/chat";

const MAX_FILES = 10;
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_NAME = 200;
/** 파일 선택창의 `accept`와 같은 목록이어야 한다 (page.tsx의 input) */
const ALLOWED = new Set(["pdf", "png", "jpg", "jpeg", "xlsx", "docx"]);

/** 경로 조작 방지 — `/`와 `\` 둘 다 잘라낸다. 길이는 확장자를 살린 채 줄인다 */
function safeName(raw: string) {
  const base = raw.split(/[\\/]/).pop() || "문서";
  if (base.length <= MAX_NAME) return base;
  const e = ext(base);
  // 그냥 자르면 확장자가 날아가 정상 파일이 415로 막힌다
  return e
    ? `${base.slice(0, MAX_NAME - e.length - 1)}.${e}`
    : base.slice(0, MAX_NAME);
}

/** 확장자 위조 방지 — 마지막 점 뒤만 본다 */
function ext(name: string) {
  return name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const files =
    form?.getAll("files").filter((f): f is File => f instanceof File) ?? [];

  if (!files.length) {
    return Response.json(
      { code: "VALIDATION_FAILED", message: "파일이 없어요" },
      { status: 400 },
    );
  }
  if (files.length > MAX_FILES) {
    return Response.json(
      {
        code: "TOO_MANY_FILES",
        message: `한 번에 ${MAX_FILES}개까지 올릴 수 있어요`,
      },
      { status: 400 },
    );
  }

  const docs: SourceDoc[] = [];
  for (const f of files) {
    const name = safeName(f.name);
    const type = ext(name);
    if (!ALLOWED.has(type)) {
      return Response.json(
        {
          code: "UNSUPPORTED_TYPE",
          message: `${name}은(는) 올릴 수 없는 형식이에요`,
        },
        { status: 415 },
      );
    }
    if (f.size > MAX_BYTES) {
      return Response.json(
        { code: "FILE_TOO_LARGE", message: `${name}이(가) 20MB를 넘어요` },
        { status: 413 },
      );
    }
    docs.push({
      name,
      type: type.toUpperCase(),
      scope: "개인",
      updated: "방금 전",
    });
  }

  return Response.json(docs);
}
