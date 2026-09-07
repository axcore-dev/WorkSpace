/**
 * `data/invite.ts` 순수 로직 검증.
 *
 * Node v24 내장 `node --test`로 돌린다 — 타입 스트립이 기본이라 `.ts`를 그대로 실행한다.
 *
 * 실행: cd FE && npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  classifyEmail,
  parseInviteCsv,
  splitEmails,
  summarize,
} from "./invite.ts";

const CTX = {
  members: ["demo@democompany.co.kr"],
  pending: ["jwhan@democompany.co.kr"],
  workDomains: ["democompany.co.kr", "axcore.it.kr"],
};

/* ───────── 이메일 판정 ───────── */

test("회사 메일이면 보낸다", () => {
  assert.equal(classifyEmail("gymoon@democompany.co.kr", CTX).kind, "ok");
});

test("이미 구성원이면 건너뛴다", () => {
  const v = classifyEmail("demo@democompany.co.kr", CTX);
  assert.equal(v.kind, "skip");
  assert.equal(v.why, "이미 구성원이에요");
});

test("이미 초대 중이면 건너뛴다", () => {
  assert.equal(classifyEmail("jwhan@democompany.co.kr", CTX).kind, "skip");
});

test("대소문자가 달라도 같은 주소로 본다", () => {
  // 메일 주소는 대소문자를 가리지 않는데, 안 맞추면 같은 사람을 두 번 초대한다
  assert.equal(classifyEmail("DEMO@Democompany.co.KR", CTX).kind, "skip");
});

test("주소 형식이 아니면 막는다", () => {
  for (const bad of ["yschoi@", "@democompany.co.kr", "그냥글자", "a b@c.kr"]) {
    assert.equal(classifyEmail(bad, CTX).kind, "bad", bad);
  }
});

test("외부 도메인은 막지 않고 표시만 한다", () => {
  // 협력사·감사인처럼 사외 주소를 부를 일이 실제로 있다
  const v = classifyEmail("hong@gmail.com", CTX);
  assert.equal(v.kind, "warn");
  assert.equal(v.why, "회사 메일이 아니에요");
});

test("도메인 끝이 같기만 한 주소는 회사 메일이 아니다", () => {
  // `evil-democompany.co.kr`이 통과하면 남의 도메인이 사내 주소로 들어온다
  assert.equal(classifyEmail("x@evil-democompany.co.kr", CTX).kind, "warn");
});

/* ───────── 붙여넣기 쪼개기 ───────── */

test("쉼표·세미콜론·줄바꿈·공백으로 쪼갠다", () => {
  const out = splitEmails("a@x.kr, b@x.kr;c@x.kr\nd@x.kr e@x.kr");
  assert.deepEqual(out, ["a@x.kr", "b@x.kr", "c@x.kr", "d@x.kr", "e@x.kr"]);
});

test("같은 주소는 하나로 합치고 처음 순서를 지킨다", () => {
  assert.deepEqual(splitEmails("b@x.kr, a@x.kr, B@X.KR"), ["b@x.kr", "a@x.kr"]);
});

test("빈 문자열은 빈 목록이다", () => {
  assert.deepEqual(splitEmails("   \n , ; "), []);
});

/* ───────── CSV ───────── */

const KNOWN = {
  depts: ["생산본부", "품질관리팀"],
  ranksOf: (d: string) => (d === "생산본부" ? ["공장장", "작업 담당"] : ["품질 관리자"]),
};

test("머리글 줄을 건너뛴다", () => {
  const rows = parseInviteCsv(
    "이름,이메일,부서,직급\n문가영,gymoon@x.kr,생산본부,공장장",
    KNOWN,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "문가영");
});

test("머리글이 없어도 읽는다", () => {
  const rows = parseInviteCsv("문가영,gymoon@x.kr,생산본부,공장장", KNOWN);
  assert.equal(rows.length, 1);
});

test("없는 부서는 비우고 원래 값을 남긴다", () => {
  // 비슷한 이름으로 자동 보정하지 않는다 — 잘못 짚으면 엉뚱한 권한이 나간다
  const [r] = parseInviteCsv("최영수,ys@x.kr,생산1팀,공장장", KNOWN);
  assert.equal(r.dept, null);
  assert.equal(r.rawDept, "생산1팀");
});

test("부서가 틀리면 직급도 확인하지 않는다", () => {
  // 직급은 부서 안에 있다 — 부서가 없으면 그 직급이 맞는지 알 수 없다
  const [r] = parseInviteCsv("최영수,ys@x.kr,생산1팀,공장장", KNOWN);
  assert.equal(r.rank, null);
});

test("그 부서에 없는 직급은 비운다", () => {
  const [r] = parseInviteCsv("한지우,jw@x.kr,품질관리팀,공장장", KNOWN);
  assert.equal(r.dept, "품질관리팀");
  assert.equal(r.rank, null);
  assert.equal(r.rawRank, "공장장");
});

test("CRLF와 빈 줄을 견딘다", () => {
  const rows = parseInviteCsv(
    "이름,이메일,부서,직급\r\n\r\n문가영,gymoon@x.kr,생산본부,공장장\r\n\r\n",
    KNOWN,
  );
  assert.equal(rows.length, 1);
});

test("이메일은 소문자로 맞춘다", () => {
  const [r] = parseInviteCsv("문가영,GyMoon@X.KR,생산본부,공장장", KNOWN);
  assert.equal(r.email, "gymoon@x.kr");
});

/* ───────── 요약 ───────── */

test("보낼 것과 건너뛸 것을 센다", () => {
  const s = summarize([
    { kind: "ok", why: "" },
    { kind: "warn", why: "회사 메일이 아니에요" },
    { kind: "skip", why: "이미 구성원이에요" },
    { kind: "bad", why: "주소 형식이 아니에요" },
  ]);
  // warn은 보낸다 — 그래서 4명 중 2명이다
  assert.deepEqual(s, { total: 4, sending: 2, skipped: 1, blocked: 1 });
});
