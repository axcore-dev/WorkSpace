/**
 * `data/roles.ts` 순수 로직 검증.
 *
 * Node v24 내장 `node --test`로 돌린다 — 타입 스트립이 기본이라 `.ts`를 그대로 실행한다.
 * 테스트 프레임워크를 새로 넣지 않는 이유는 `CLAUDE.md` 의존성 규칙이다.
 *
 * 실행: cd FE && npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  deptDeletable,
  moveRanks,
  rankDeletable,
  renameDept,
  roleMemberCount,
} from "./roles.ts";
import type { RoleDef } from "./roles.ts";

function role(over: Partial<RoleDef> = {}): RoleDef {
  return {
    id: "r1",
    name: "공장장",
    system: false,
    dept: "생산본부",
    perms: ["monitoring", "workorders", "defects"],
    scope: "all",
    showAmounts: true,
    canDelegateInvite: false,
    ...over,
  };
}

/* ───────────── 삭제 가능 판정 ───────────── */

test("못 지우는 이유를 돌려준다", () => {
  // 화면이 버튼만 흐리게 두면 왜 안 되는지 알 수 없다
  const sys = role({ system: true });
  assert.match(rankDeletable(sys, [sys, role({ id: "r2" })]).why, /시스템/);
  const only = role();
  assert.match(rankDeletable(only, [only]).why, /마지막/);
  assert.equal(rankDeletable(role(), [role(), role({ id: "r2" })]).why, "");
});

/* ───────────── 부서 삭제 ───────────── */

test("직급이 없는 부서는 지울 수 있다", () => {
  const d = deptDeletable("설비보전팀", [role({ dept: "생산본부" })]);
  assert.equal(d.ok, true);
  assert.equal(d.ranks, 0);
});

test("직급이 남은 부서는 못 지운다", () => {
  // 부서만 지우고 직급을 떠돌게 두면 어느 부서에도 없는 직급이 생긴다
  const d = deptDeletable("생산본부", [
    role({ dept: "생산본부" }),
    role({ id: "r2", dept: "생산본부" }),
  ]);
  assert.equal(d.ok, false);
  assert.equal(d.ranks, 2);
  assert.match(d.why, /2개/);
});

test("부서 없는 직급(소유자)은 부서 수에 안 센다", () => {
  const d = deptDeletable("생산본부", [role({ id: "owner", dept: null })]);
  assert.equal(d.ok, true);
});

/* ───────────── 부서 이름 바꾸기 · 옮기기 ───────────── */

test("부서 이름을 바꾸면 그 부서 직급이 따라온다", () => {
  // 따라오게 하지 않으면 직급이 없어진 이름을 가리켜 같은 사고가 난다
  const next = renameDept(
    [role({ dept: "생산본부" }), role({ id: "r2", dept: "품질관리팀" })],
    "생산본부",
    "생산1본부",
  );
  assert.equal(next[0].dept, "생산1본부");
  assert.equal(next[1].dept, "품질관리팀");
});

test("부서 없는 직급은 이름 바꾸기에 안 걸린다", () => {
  const [owner] = renameDept([role({ id: "owner", dept: null })], "생산본부", "생산1본부");
  assert.equal(owner.dept, null);
});

test("직급을 다른 부서로 옮긴다", () => {
  const next = moveRanks([role({ dept: "생산본부" })], "생산본부", "제조혁신팀");
  assert.equal(next[0].dept, "제조혁신팀");
});

/* ───────────── 구성원 수 ───────────── */

test("역할 이름으로 구성원 수를 센다", () => {
  const users = [{ role: "관리자" }, { role: "공장장" }, { role: "공장장" }];
  assert.equal(roleMemberCount("공장장", users), 2);
  assert.equal(roleMemberCount("관리자", users), 1);
  assert.equal(roleMemberCount("없는역할", users), 0);
});

/* ───────────── 데이터 정합성 ───────────── */

test("ROLES의 이름이 USERS_ROLES에 실제로 쓰인 값과 이어진다", async () => {
  // roleMemberCount가 이름으로 맞추므로 둘이 어긋나면 구성원 수가 전부 0이 된다.
  // org.ts는 `@/` 별칭을 쓰는 타입 import가 있어 여기서 직접 못 읽는다 —
  // 대신 파일을 텍스트로 읽어 이름 목록을 비교한다.
  const fs = await import("node:fs");
  // 줄끝을 먼저 맞춘다. core.autocrlf=true면 체크아웃이 CRLF로 떨어지는데 아래 정규식은 \n을
  // 본다 — 안 맞추면 내 작업 트리에서만 통과하고 새로 clone한 곳과 CI에서는 0개가 잡힌다.
  const src = fs.readFileSync("data/org.ts", "utf8").replace(/\r\n/g, "\n");

  // ROLES 블록만 잘라서 본다. 파일 전체에 걸면 EXTERNAL_SYSTEMS의 name도 같이 잡혀
  // (본사 ERP·1공장 MES 등) 대조가 헐거워진다.
  const start = src.indexOf("export const ROLES");
  assert.ok(start >= 0, "org.ts에서 ROLES 선언을 못 찾았다");
  const block = src.slice(start, src.indexOf("\n];", start));

  const roleNames = [...block.matchAll(/^ {4}name: "([^"]+)",$/gm)].map((m) => m[1]);
  const usedNames = new Set([...src.matchAll(/role: "([^"]+)", dept:/g)].map((m) => m[1]));

  assert.ok(roleNames.length > 0, "ROLES에서 이름을 못 찾았다 — 정규식이 형식과 어긋난다");
  for (const used of usedNames) {
    assert.ok(roleNames.includes(used), `USERS_ROLES의 "${used}"가 ROLES에 없다`);
  }
});

test("ROLES의 부서가 DEPARTMENTS에 있는 값이다", async () => {
  // 어긋나면 그 역할이 「없어진팀」 묶음으로 목록 끝에 떨어진다 — 동작은 하지만 실수다.
  const fs = await import("node:fs");
  const src = fs.readFileSync("data/org.ts", "utf8").replace(/\r\n/g, "\n");

  const start = src.indexOf("export const ROLES");
  const block = src.slice(start, src.indexOf("\n];", start));
  const depts = [...block.matchAll(/^ {4}dept: "([^"]+)",$/gm)].map((m) => m[1]);

  const dStart = src.indexOf("export const DEPARTMENTS");
  const known = [
    ...src.slice(dStart, src.indexOf("] as const", dStart)).matchAll(/"([^"]+)"/g),
  ].map((m) => m[1]);

  assert.ok(depts.length > 0, "ROLES에서 부서를 못 찾았다 — 정규식이 형식과 어긋난다");
  for (const d of depts) {
    assert.ok(known.includes(d), `ROLES의 부서 "${d}"가 DEPARTMENTS에 없다`);
  }
});
