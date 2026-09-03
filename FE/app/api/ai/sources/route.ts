/**
 * ⚠️ AI-MOCK — BE 연동 시 삭제 대상 ⚠️
 *
 * `POST /api/ai/sources` 업로드 목업. 파일을 저장하지 않고 메타만 돌려준다.
 * 계약은 `FE/lib/chat-api.ts` 주석 참고 — 필드명 `files`(multipart), 응답 `SourceDoc[]`.
 */
import type { SourceDoc } from "@/data/chat";

const MAX_FILES = 10;
const MAX_BYTES = 20 * 1024 * 1024;
/** 화면 안내 문구("PDF·이미지·XLSX·DOCX")와 같은 목록 */
const ALLOWED = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "xlsx",
  "xls",
  "docx",
  "doc",
  "csv",
  "txt",
]);

/** 확장자 위조·경로 조작 방지 — 경로 구분자를 잘라내고 마지막 확장자만 본다 */
function safeName(raw: string) {
  return raw.split(/[\\/]/).pop()?.slice(0, 200) || "문서";
}

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
