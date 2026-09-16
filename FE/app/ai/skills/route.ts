/**
 * 회사 스킬 — `GET /ai/skills` 전체 목록(기본 + 회사) · `POST /ai/skills` 회사 스킬 만들기.
 *
 * 읽기는 구성원 누구나. 쓰기는 회사 관리자(`principal.admin`). 계약은 `lib/ai/skills.ts`.
 */
import { authenticate } from "@/lib/ai/server/auth";
import { withTenant } from "@/lib/ai/server/db";
import { handle } from "@/lib/ai/server/http";
import { allSkills, duplicateName, insertSkill, isDuplicateName, parseSkillBody, requireAdmin } from "@/lib/ai/server/skills";

export async function GET(req: Request) {
  return handle(async () => {
    const principal = await authenticate(req);
    return Response.json(await withTenant(principal.schemaName, allSkills));
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const principal = await authenticate(req);
    requireAdmin(principal);
    const input = await parseSkillBody(req);
    const created = await withTenant(principal.schemaName, (db) => insertSkill(db, input, principal.userId)).catch((e) => {
      throw isDuplicateName(e) ? duplicateName() : e;
    });
    return Response.json(created, { status: 201 });
  });
}
