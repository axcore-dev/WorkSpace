/**
 * 스킬 API 의 클라이언트 절반. 서버 절반은 `app/ai/skills/*`(FE 안의 AI 서버).
 *
 * `listSkills` 는 기본 스킬(코드)과 회사 스킬(`ai_skills` 표)을 합친 목록이다 — 모달 · 입력창 칩 · 서버 프롬프트가 같은 목록을
 * 본다. 만들기 · 고치기 · 지우기는 관리자만 되고, 아니면 403 이 `ApiRequestError` 로 온다.
 */
import type { Skill } from "@/data/chat";
import { ApiRequestError, type ApiError } from "@/lib/api";
import { ensureAccessToken } from "@/lib/session";
import { SKILLS_ENDPOINT } from "./transport";

export type SkillInput = Pick<Skill, "name" | "desc" | "category" | "instructions">;

async function call<T>(url: string, init: RequestInit, fallback: string): Promise<T> {
  const token = await ensureAccessToken();
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const parsed = (await res.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(res.status, parsed ?? { code: "UNKNOWN", message: fallback });
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const listSkills = () => call<Skill[]>(SKILLS_ENDPOINT, {}, "스킬 목록을 불러오지 못했어요");

export const createSkill = (input: SkillInput) =>
  call<Skill>(SKILLS_ENDPOINT, { method: "POST", body: JSON.stringify(input) }, "스킬을 만들지 못했어요");

export const updateSkill = (id: string, input: SkillInput) =>
  call<Skill>(`${SKILLS_ENDPOINT}/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) }, "스킬을 고치지 못했어요");

export const deleteSkill = (id: string) =>
  call<void>(`${SKILLS_ENDPOINT}/${encodeURIComponent(id)}`, { method: "DELETE" }, "스킬을 지우지 못했어요");
