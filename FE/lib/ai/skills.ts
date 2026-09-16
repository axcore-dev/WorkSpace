/**
 * 스킬 API 의 클라이언트 절반. 서버 절반은 `app/ai/skills/*`(FE 안의 AI 서버).
 *
 * `listSkills` 는 기본 스킬(코드)과 회사 스킬(`ai_skills` 표)을 합친 목록이다 — 모달 · 입력창 칩 · 서버 프롬프트가 같은 목록을
 * 본다. 만들기 · 고치기 · 지우기는 관리자만 되고, 아니면 403 이 `ApiRequestError` 로 온다.
 */
import type { Skill } from "@/data/chat";
import { aiCall } from "./client";
import { SKILLS_ENDPOINT } from "./transport";

export type SkillInput = Pick<Skill, "name" | "desc" | "category" | "instructions">;

export const listSkills = () => aiCall<Skill[]>(SKILLS_ENDPOINT, {}, "스킬 목록을 불러오지 못했어요");

export const createSkill = (input: SkillInput) =>
  aiCall<Skill>(SKILLS_ENDPOINT, { method: "POST", body: JSON.stringify(input) }, "스킬을 만들지 못했어요");

export const updateSkill = (id: string, input: SkillInput) =>
  aiCall<Skill>(`${SKILLS_ENDPOINT}/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) }, "스킬을 고치지 못했어요");

export const deleteSkill = (id: string) =>
  aiCall<void>(`${SKILLS_ENDPOINT}/${encodeURIComponent(id)}`, { method: "DELETE" }, "스킬을 지우지 못했어요");
