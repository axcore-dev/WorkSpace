/**
 * `data/grants.ts` 위임 범위 판정 검증.
 *
 * 실행: cd FE && npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  canChooseDept,
  canGrantRank,
  canManageRoles,
  grantableRanks,
  invitableDepts,
} from "./grants.ts";
import type { RoleDef } from "./roles.ts";

function role(over: Partial<RoleDef> = {}): RoleDef {
  return {
    id: "r1",
    name: "공장장",
    system: false,
    dept: "생산본부",
    perms: ["monitoring", "workorders", "defects"],
    scope: "dept",
    showAmounts: false,
    canDelegateInvite: true,
    ...over,
  };
}

const OWNER = role({ id: "owner", name: "소유자", system: true, dept: null, scope: "all" });

/* ───────────── 권한 관리 접근 ───────────── */

test("소유자만 권한 관리를 연다", () => {
  assert.equal(canManageRoles(OWNER), true);
});

test("관리자라도 시스템 직급이 아니면 못 연다", () => {
  // 직급을 고칠 수 있으면 자기 권한도 마음대로 올릴 수 있다
  assert.equal(canManageRoles(role({ name: "관리자", scope: "all" })), false);
});

test("부서를 가진 시스템 직급도 못 연다", () => {
  // 소유자는 전사 자리다 — 부서에 매인 시스템 직급은 소유자가 아니다
  assert.equal(canManageRoles(role({ system: true, dept: "제조혁신팀" })), false);
});

test("직급이 없으면 못 연다", () => {
  assert.equal(canManageRoles(null), false);
});

/* ───────────── 직급 위임 ───────────── */

test("위임 권한이 없으면 아무도 못 준다", () => {
  const me = role({ canDelegateInvite: false });
  assert.equal(canGrantRank(me, role({ id: "r2", perms: [] })), false);
});

test("내 권한 안에 있는 직급은 줄 수 있다", () => {
  const me = role();
  assert.equal(canGrantRank(me, role({ id: "r2", perms: ["monitoring"], scope: "own" })), true);
});

test("내가 못 보는 탭이 있으면 못 준다", () => {
  // 내가 못 보는 화면을 남에게 열어 줄 수 없다
  const me = role();
  assert.equal(canGrantRank(me, role({ id: "r2", perms: ["monitoring", "payroll"] })), false);
});

test("나보다 넓은 데이터 범위는 못 준다", () => {
  const me = role({ scope: "dept" });
  assert.equal(canGrantRank(me, role({ id: "r2", perms: [], scope: "all" })), false);
  assert.equal(canGrantRank(me, role({ id: "r2", perms: [], scope: "dept" })), true);
  assert.equal(canGrantRank(me, role({ id: "r2", perms: [], scope: "own" })), true);
});

test("금액 정보는 내가 볼 수 있어야 준다", () => {
  // 권한 목록에 없는 별개 스위치라 탭 검사에 안 걸린다
  const me = role({ showAmounts: false });
  assert.equal(canGrantRank(me, role({ id: "r2", perms: [], showAmounts: true })), false);
  assert.equal(canGrantRank(role({ showAmounts: true }), role({ id: "r2", perms: [], showAmounts: true })), true);
});

test("시스템 직급은 누구도 못 준다", () => {
  // 소유자는 회사에 하나다
  assert.equal(canGrantRank(OWNER, OWNER), false);
  assert.equal(canGrantRank(role({ scope: "all", perms: ["a", "b"] }), role({ id: "s", system: true, perms: [] })), false);
});

test("고를 수 있는 직급만 추린다", () => {
  const me = role({ perms: ["a", "b"], scope: "dept" });
  const all = [
    OWNER,
    role({ id: "ok", name: "작업 담당", perms: ["a"], scope: "own" }),
    role({ id: "wide", name: "공장장", perms: ["a"], scope: "all" }),
    role({ id: "over", name: "구매 담당", perms: ["a", "z"], scope: "own" }),
  ];
  assert.deepEqual(grantableRanks(me, all).map((r) => r.id), ["ok"]);
});

/* ───────────── 부서 고르기 ───────────── */

test("전체 범위만 부서를 고른다", () => {
  assert.equal(canChooseDept(role({ scope: "all" })), true);
  assert.equal(canChooseDept(role({ scope: "dept" })), false);
  assert.equal(canChooseDept(role({ scope: "own" })), false);
});

test("부서 범위면 자기 부서 하나로 고정된다", () => {
  const me = role({ dept: "생산본부", scope: "dept" });
  assert.deepEqual(invitableDepts(me, ["제조혁신팀", "생산본부", "품질관리팀"]), ["생산본부"]);
});

test("전체 범위면 부서 전부를 고른다", () => {
  const me = role({ scope: "all" });
  const all = ["제조혁신팀", "생산본부"];
  assert.deepEqual(invitableDepts(me, all), all);
});

test("부서도 직급도 없으면 고를 부서가 없다", () => {
  assert.deepEqual(invitableDepts(null, ["생산본부"]), []);
  assert.deepEqual(invitableDepts(role({ dept: null, scope: "dept" }), ["생산본부"]), []);
});
