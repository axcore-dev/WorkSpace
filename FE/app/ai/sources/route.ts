/**
 * 소스 문서 — `POST /ai/sources` 업로드 · `GET /ai/sources` 내 문서 목록.
 *
 * 업로드 흐름: 검증 → Object Storage 저장(회사 스키마 접두어) → 테넌트 스키마에 메타 행(`indexing`)
 * → 응답 → 응답 뒤에 색인(`after`). 화면은 돌아온 `SourceDoc[]` 를 목록에 넣고 `status` 로 진행을 본다.
 *
 * 같은 이름을 다시 올리면 기존 문서를 지우고 새로 만든다(재색인). 화면이 문서를 이름으로 고르기
 * 때문에 이름은 한 사람 안에서 유일해야 한다.
 *
 * 계약은 `FE/lib/ai/sources.ts` 참고 — 필드명 `files`(multipart), 응답 `SourceDoc[]`.
 */
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import type { SourceDoc } from "@/data/chat";
import { authenticate } from "@/lib/ai/server/auth";
import { withTenant } from "@/lib/ai/server/db";
import { checkFiles, contentTypeOf } from "@/lib/ai/server/files";
import { handle } from "@/lib/ai/server/http";
import { indexSource } from "@/lib/ai/server/indexer";
import {
  deleteDoc,
  findDocByName,
  insertDoc,
  listDocs,
  toSourceDoc,
} from "@/lib/ai/server/sources";
import { buildStorageKey, deleteObject, putObject } from "@/lib/ai/server/storage";

export async function GET(req: Request) {
  return handle(async () => {
    const principal = await authenticate(req);
    const rows = await withTenant(principal.schemaName, (db) => listDocs(db, principal.userId));
    return Response.json(rows.map(toSourceDoc));
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const principal = await authenticate(req);

    const form = await req.formData().catch(() => null);
    const files = checkFiles(
      form?.getAll("files").filter((f): f is File => f instanceof File) ?? [],
    );

    // 공유 범위 — 기본은 개인이다. `company` 면 같은 회사 구성원의 AI 검색에도 잡힌다.
    // 값이 이상하면 조용히 개인으로 둔다. 공유는 사용자가 분명히 고른 때만 일어나야 한다.
    const scope = form?.get("scope") === "company" ? "company" : "personal";

    const docs: SourceDoc[] = [];
    const uploadedKeys: string[] = [];
    for (const { file, name, type } of files) {
      const id = randomUUID();
      const key = buildStorageKey(principal.schemaName, principal.userId, id, name);
      const body = Buffer.from(await file.arrayBuffer());

      await putObject(key, body, contentTypeOf(type));
      uploadedKeys.push(key);

      const row = await withTenant(principal.schemaName, async (db) => {
        // 같은 이름은 교체다. 이전 객체는 행이 지워진 뒤 스토리지에서도 지운다
        const prev = await findDocByName(db, principal.userId, name);
        if (prev) {
          await deleteDoc(db, principal.userId, prev.id);
          after(() => deleteObject(prev.storage_key).catch((e) =>
            console.error("[ai-sources] 이전 객체 삭제 실패", e),
          ));
        }
        return insertDoc(db, {
          id,
          ownerUserId: principal.userId,
          name,
          type: type.toUpperCase(),
          sizeBytes: file.size,
          storageKey: key,
          scope,
        });
      }).catch(async (e) => {
        // 메타를 못 남기면 스토리지에 고아 객체가 남는다. 올린 것은 되돌린다
        await Promise.all(uploadedKeys.map((k) => deleteObject(k).catch(() => undefined)));
        throw e;
      });

      docs.push(toSourceDoc(row));
      // 응답이 나간 뒤에 색인한다. 실패해도 응답에는 영향이 없고 status 가 failed 로 남는다
      after(() => indexSource(principal, id));
    }

    return Response.json(docs);
  });
}
