/**
 * `data/admin.ts` 순수 로직 검증.
 *
 * Node v24 내장 `node --test`로 돌린다 — 타입 스트립이 기본이라 `.ts`를 그대로 실행한다.
 * 테스트 프레임워크를 새로 넣지 않는 이유는 `CLAUDE.md` 의존성 규칙이다.
 *
 * 실행: cd FE && npm test
 *
 * 참고: 실행 시 MODULE_TYPELESS_PACKAGE_JSON 경고가 stderr에 나온다. 무해하다 —
 * `FE/package.json`에 `"type": "module"`을 넣으면 사라지지만 Next 빌드에 영향을 줄 수 있어
 * 건드리지 않는다. 테스트 통과 여부는 종료 코드로 판단한다.
 *
 * 대시보드(「지금 손볼 것」)와 사용량 한도 판정을 검증하던 22개는 수정요청v10 ①에서
 * 그 코드와 함께 지웠다. 삭제 이력은 커밋에 남아 있다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ADMIN_WORKSPACES,
  BILLING_TONE,
  SCHEMA_NAME_RE,
  billingState,
  estimateAmount,
  isValidBizNumber,
  nextSchemaName,
} from "./admin.ts";

/* ───────────── 기준선: 더미 데이터가 기대한 모양인지 ───────────── */

test("워크스페이스 더미가 비어 있지 않고 스키마 이름이 유일하다", () => {
  assert.ok(ADMIN_WORKSPACES.length > 0);
  const names = ADMIN_WORKSPACES.map((w) => w.schemaName);
  assert.equal(new Set(names).size, names.length, "스키마 이름이 중복됐다");
});

test("더미의 사업자등록번호가 전부 체크섬을 통과한다", () => {
  for (const w of ADMIN_WORKSPACES) {
    assert.ok(isValidBizNumber(w.bizNumber), `${w.company}: ${w.bizNumber}`);
  }
});

/* ───────────── 스키마 이름 (수정요청v10 ⑦) ───────────── */

test("더미의 스키마 이름이 전부 BE 형식을 지킨다", () => {
  // BE `ck_workspaces_schema_name` 제약과 같은 식이다. 소문자 ax_ + 5자리 이상.
  for (const w of ADMIN_WORKSPACES) {
    assert.ok(SCHEMA_NAME_RE.test(w.schemaName), `${w.company}: ${w.schemaName}`);
  }
});

test("스키마 이름 형식은 대문자·공백·짧은 숫자를 거른다", () => {
  // 통과해서는 안 되는 것들 — 형식이 실제로 걸러내는지 본다.
  for (const bad of ["AX_00001", "ax_0001", "ax_", "ax_00001 ", " ax_00001", "hanbit-prod"]) {
    assert.equal(SCHEMA_NAME_RE.test(bad), false, bad);
  }
  assert.ok(SCHEMA_NAME_RE.test("ax_00001"));
  assert.ok(SCHEMA_NAME_RE.test("ax_123456"), "5자리 초과도 허용한다");
});

test("nextSchemaName은 형식을 지키고 기존 이름과 겹치지 않는다", () => {
  const next = nextSchemaName();
  assert.ok(SCHEMA_NAME_RE.test(next), next);
  assert.ok(!ADMIN_WORKSPACES.some((w) => w.schemaName === next), next);
});

/* ───────────── estimateAmount ───────────── */

test("estimateAmount는 양수를 돌려준다", () => {
  for (const w of ADMIN_WORKSPACES) {
    assert.ok(estimateAmount(w) > 0, w.schemaName);
  }
});

/* ───────────── billingState ───────────── */

test("billingState는 미수금이 있으면 overdue다", () => {
  const w = ADMIN_WORKSPACES.find((x) => x.invoices.some((i) => i.state === "overdue"));
  assert.ok(w, "미수금이 있는 워크스페이스가 더미에 없다");
  assert.equal(billingState(w), "overdue");
});

test("billingState는 미수금이 없으면 due다", () => {
  const w = ADMIN_WORKSPACES.find(
    (x) => x.invoices.length > 0 && !x.invoices.some((i) => i.state === "overdue"),
  );
  assert.ok(w, "미수금 없는 청구 내역을 가진 워크스페이스가 더미에 없다");
  assert.equal(billingState(w), "due");
});

test("billingState는 청구 내역이 없어도 due다", () => {
  const empty = { ...ADMIN_WORKSPACES[0], invoices: [] };
  assert.equal(billingState(empty), "due");
});

test("BILLING_TONE은 상태별 색이 정확하다", () => {
  // 키 집합은 Record<BillingState,...> 타입이 이미 보장한다 — 여기서는 매핑을 본다.
  assert.equal(BILLING_TONE.paid, "green");
  assert.equal(BILLING_TONE.due, "slate");
  assert.equal(BILLING_TONE.overdue, "red", "미수금만 빨강이어야 한다");
});
