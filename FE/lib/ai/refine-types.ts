/**
 * 「AI 로 다듬기」 — 서버(AI 라우트)와 화면(검토 패널)이 같이 보는 타입. 값 규칙은 `docs/ai/ai-server.md` 「AI 로 다듬기」.
 *
 * `RefineInputDto` 는 BE `AdminExternalConceptService.RefineInput` 그대로, `ConceptProposal` 은 모델 출력을 검증한 뒤 모양이다.
 * 이 파일은 타입만 — 서버 전용 · 클라이언트 전용 모듈을 둘 다 끌어오지 않게.
 */
import type { ExternalConceptAdminDto, IntrospectedTable } from "@/lib/admin-api";

export type ColumnProfileDto = {
  name: string;
  type: string;
  distinct: number;
  nullRatio: number;
  masked: boolean;
  longText: boolean;
  /** 고유값 ≤ 30 인 열거형 컬럼만. 그 밖은 null — 값이 모델로 나가는 유일한 자리 */
  values: { value: string; count: number }[] | null;
  shape: string | null;
  avgLen: number | null;
  min: string | null;
  max: string | null;
};

export type TableProfileDto = { schema: string; table: string; sampledRows: number; columns: ColumnProfileDto[] };

export type RulesDto = {
  addFilters: string[];
  reason: Record<string, string>;
  removeFilters: string[];
  relations: { attr: string; to: string; overlap: number }[];
  skip: boolean;
  skipReason: string | null;
  orderBy: string | null;
};

export type RefineInputDto = {
  system: { kind: string; name: string; company: string };
  concept: ExternalConceptAdminDto;
  table: IntrospectedTable;
  profile: TableProfileDto;
  rules: RulesDto;
  siblings: { id: string; name: string }[];
  /** 같은 시스템에서 같은 표를 읽는 다른 개념 — 템플릿과 DB 초안이 한 표를 두 id 로 넣은 쌍둥이. 관계 상대에서 빼고 검토 화면이 경고한다 */
  duplicates: { id: string; name: string }[];
  /** 회사의 외부 개념 id 전부 — 집계 id 충돌 검사용. 관계 상대는 여기서 duplicates 를 뺀 것 + 내장 개념 */
  conceptIds: string[];
  conceptCount: number;
};

/** 모델이 제안한 집계 개념. `preview` 는 그 시스템에서 실제로 5행을 돌려 본 결과 — 실패한 것은 목록에서 빠진다 */
export type AggregateProposal = {
  id: string;
  name: string;
  description: string;
  sql: string;
  /** 미리보기가 준 컬럼 — 새 개념의 attrs 키가 된다 */
  columns: string[];
};

export type ConceptProposal = {
  name: string;
  synonyms: string[];
  description: string;
  /** 현재 attrs 키 안에서만. 라벨이 지금과 같은 컬럼은 빠진다 */
  attrs: Record<string, string>;
  /** 최종 제안 필터(통계 규칙 + 모델). 지금과 같으면 변화 없음 */
  filterColumns: string[];
  /** 지금 없는 관계만 */
  relations: { attr: string; to: string; overlap: number | null }[];
  orderBy: string | null;
  keep: boolean;
  keepReason: string;
  aggregates: AggregateProposal[];
};

export type RefineItem = { conceptRowId: number; conceptId: string; name: string } & (
  | {
      ok: true;
      current: ExternalConceptAdminDto;
      proposal: ConceptProposal;
      rules: RulesDto;
      /** 같은 표를 읽는 다른 개념 — 있으면 검토 화면이 경고하고 「표 삭제」 를 고를 수 있게 한다 */
      duplicates: { id: string; name: string }[];
      /** 검증에서 떨어진 것 — 화면 한 줄 */
      dropped: string[];
    }
  | { ok: false; error: string }
);

export type RefineTarget = { rowId: number; conceptId: string; name: string };

/** 작업 하나에 담는 개념 상한. 운영자 토큰이 15분이라 그 안에 끝날 크기다(3개씩 · 하나 30초~2.5분) */
export const REFINE_MAX_TARGETS = 30;

/** 서버가 드는 「AI 로 다듬기」 작업(`shared.ai_refine_jobs`). 화면은 이것을 폴링한다 */
export type RefineJob = {
  id: string;
  workspaceId: number;
  status: "running" | "done" | "failed";
  structureOnly: boolean;
  targets: RefineTarget[];
  done: number;
  /** 지금 도는 개념 이름(최대 3) */
  current: string[];
  doneIds: number[];
  /** 끝난 개념부터 쌓인다. done 이면 targets 와 같은 길이 */
  items: RefineItem[];
  /** failed 일 때 이유 */
  error: string | null;
  updatedAt: string;
};

/** 초안이 설명 끝에 남기는 표시. 저장하면 뗀다 — 그것이 「검토 완료」 */
export const DRAFT_MARK = /\s*\[초안[^\]]*\]\s*$/;
export const isDraft = (description: string) => DRAFT_MARK.test(description);
