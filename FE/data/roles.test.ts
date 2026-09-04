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

import { canDeleteRole, roleMemberCount, summarizeRole } from "./roles.ts";
import type { RoleDef } from "./roles.ts";

const NAMES: Record<string, string> = {
  management: "경영지원",
  production: "생산관리",
  quality: "품질검사",
};

function role(over: Partial<RoleDef> = {}): RoleDef {
  return {
    id: "r1",
    name: "공장장",
    system: false,
    perms: { management: "read", production: "write", quality: "write" },
    scope: "all",
    showAmounts: true,
    canDelegateInvite: false,
    ...over,
  };
}

/* ───────────── 권한 요약 ───────────── */

test("쓰기 권한 모듈을 먼저 적고 데이터 범위를 붙인다", () => {
  const s = summarizeRole(role(), NAMES);
  assert.ok(s.includes("생산관리"), s);
  assert.ok(s.includes("품질검사"), s);
  assert.ok(s.includes("전체"), s);
});

test("쓰기가 없으면 읽기만이라고 적는다", () => {
  const s = summarizeRole(
    role({ perms: { management: "read", production: "read", quality: "none" } }),
    NAMES,
  );
  assert.ok(s.includes("읽기만"), s);
});

test("권한이 하나도 없으면 그렇게 적는다", () => {
  const s = summarizeRole(
    role({ perms: { management: "none", production: "none", quality: "none" } }),
    NAMES,
  );
  assert.ok(s.includes("권한 없음"), s);
});

test("요약에 모듈 슬러그가 새어 나오지 않는다", () => {
  const s = summarizeRole(role(), NAMES);
  for (const slug of Object.keys(NAMES)) {
    assert.ok(!s.includes(slug), `${slug}가 요약에 그대로 들어갔다: ${s}`);
  }
});

test("이름을 모르는 모듈은 요약에서 건너뛴다", () => {
  // 모듈이 지워졌는데 권한 맵에 slug가 남아 있어도 undefined가 문자열에 끼면 안 된다
  const s = summarizeRole(role({ perms: { ...role().perms, ghost: "write" } }), NAMES);
  assert.ok(!s.includes("undefined"), s);
});

/* ───────────── 삭제 가능 판정 ───────────── */

test("시스템 역할은 지울 수 없다", () => {
  const sys = role({ id: "admin", name: "관리자", system: true });
  assert.equal(canDeleteRole(sys, [sys, role()]), false);
});

test("일반 역할은 지울 수 있다", () => {
  const sys = role({ id: "admin", name: "관리자", system: true });
  const plain = role();
  assert.equal(canDeleteRole(plain, [sys, plain]), true);
});

test("마지막 남은 역할은 지울 수 없다", () => {
  const only = role();
  assert.equal(canDeleteRole(only, [only]), false);
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
  const src = fs.readFileSync("data/org.ts", "utf8");

  const roleNames = [...src.matchAll(/^\s{4}name: "([^"]+)",\n\s{4}system:/gm)].map((m) => m[1]);
  const usedNames = new Set([...src.matchAll(/role: "([^"]+)", dept:/g)].map((m) => m[1]));

  assert.ok(roleNames.length > 0, "ROLES에서 이름을 못 찾았다 — 정규식이 형식과 어긋난다");
  for (const used of usedNames) {
    assert.ok(roleNames.includes(used), `USERS_ROLES의 "${used}"가 ROLES에 없다`);
  }
});
