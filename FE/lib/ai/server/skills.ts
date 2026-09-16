/**
 * 회사 스킬 — 테넌트 표 `ai_skills`(tenant V21) 읽기 · 쓰기. 기본 스킬(`data/chat.ts` SKILL_LIB)은 코드에 있고, 이 표는 회사
 * 관리자가 만든 것이다. 둘을 합친 목록을 모달과 시스템 프롬프트가 같이 본다(`allSkills`).
 *
 * 회사 스킬의 id 는 `co-<행 id>` 다 — 기본 스킬 slug 와 겹치지 않고, 대화가 고른 id 를 그대로 프롬프트 조립에 쓸 수 있다.
 */
import "server-only";
import { z } from "zod";
import { SKILL_CATEGORIES, SKILL_LIB, type Skill, type SkillCategory } from "@/data/chat";
import type { AiPrincipal } from "./auth";
import type { Db } from "./db";
import { HttpError } from "./http";

export const ID_PREFIX = "co-";

/** 쓰기는 회사 관리자만 — BE introspect 가 직급으로 판정한 값이라 화면의 버튼 잠금과 무관하게 여기서 막힌다 */
export function requireAdmin(principal: AiPrincipal): void {
  if (!principal.admin) throw new HttpError(403, "FORBIDDEN", "회사 스킬은 관리자만 만들거나 고칠 수 있어요");
}

export async function parseSkillBody(req: Request): Promise<SkillInput> {
  const parsed = skillInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    throw new HttpError(400, "VALIDATION_FAILED", parsed.error.issues[0]?.message ?? "입력을 확인해 주세요");
  }
  return parsed.data;
}

export const duplicateName = () => new HttpError(409, "DUPLICATE_NAME", "같은 이름의 스킬이 이미 있어요");

/** 모달 · 라우트가 같이 쓰는 입력 검증. 길이는 표의 컬럼 길이와 같다 */
export const skillInput = z.object({
  name: z.string().trim().min(1, "이름을 적어 주세요").max(60, "이름은 60자까지예요"),
  desc: z.string().trim().min(1, "설명을 적어 주세요").max(200, "설명은 200자까지예요"),
  category: z.enum(SKILL_CATEGORIES.map((c) => c.id) as [SkillCategory, ...SkillCategory[]]),
  instructions: z.string().trim().min(1, "작업 방식을 적어 주세요").max(4000, "작업 방식은 4,000자까지예요"),
});
export type SkillInput = z.infer<typeof skillInput>;

interface Row {
  id: string;
  name: string;
  description: string;
  category: string;
  instructions: string;
}

const CATEGORY_IDS = new Set<string>(SKILL_CATEGORIES.map((c) => c.id));
/** 코드에서 빠진 분야 값은 「기타」 로 — 표는 모양만 보고 목록은 코드가 정한다 */
const toSkill = (r: Row): Skill => ({
  id: `${ID_PREFIX}${r.id}`,
  name: r.name,
  desc: r.description,
  category: (CATEGORY_IDS.has(r.category) ? r.category : "other") as SkillCategory,
  instructions: r.instructions,
});

/** 경로의 `co-12` → 12. 모양이 아니면 null — DB 에 가지 않는다 */
export function rowId(id: string): number | null {
  const m = /^co-([1-9][0-9]{0,17})$/.exec(id);
  return m ? Number(m[1]) : null;
}

export async function listCompanySkills(db: Db): Promise<Skill[]> {
  const { rows } = await db.query<Row>("SELECT id, name, description, category, instructions FROM ai_skills ORDER BY id");
  return rows.map(toSkill);
}

/** 기본 스킬 앞, 회사 스킬 뒤 — 모달의 순서와 프롬프트의 순서가 같다 */
export async function allSkills(db: Db): Promise<Skill[]> {
  return [...SKILL_LIB, ...(await listCompanySkills(db))];
}

export async function insertSkill(db: Db, input: SkillInput, createdBy: string): Promise<Skill> {
  const { rows } = await db.query<Row>(
    `INSERT INTO ai_skills (name, description, category, instructions, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, name, description, category, instructions`,
    [input.name, input.desc, input.category, input.instructions, createdBy],
  );
  return toSkill(rows[0]);
}

/** 없으면 null */
export async function updateSkill(db: Db, id: number, input: SkillInput): Promise<Skill | null> {
  const { rows } = await db.query<Row>(
    `UPDATE ai_skills SET name = $2, description = $3, category = $4, instructions = $5, updated_at = now()
      WHERE id = $1 RETURNING id, name, description, category, instructions`,
    [id, input.name, input.desc, input.category, input.instructions],
  );
  return rows[0] ? toSkill(rows[0]) : null;
}

export async function deleteSkill(db: Db, id: number): Promise<boolean> {
  const r = await db.query("DELETE FROM ai_skills WHERE id = $1", [id]);
  return (r.rowCount ?? 0) > 0;
}

/** unique(name) 위반 — pg 오류 코드 23505 */
export function isDuplicateName(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";
}
