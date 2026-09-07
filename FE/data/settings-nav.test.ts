/**
 * `data/settings-nav.ts` 순수 로직 검증 + 라우트 폴더 정합성.
 *
 * Node v24 내장 `node --test`로 돌린다 — 타입 스트립이 기본이라 `.ts`를 그대로 실행한다.
 * 테스트 프레임워크를 새로 넣지 않는 이유는 `CLAUDE.md` 의존성 규칙이다.
 *
 * 실행: cd FE && npm test
 *
 * 참고: 실행 시 MODULE_TYPELESS_PACKAGE_JSON 경고가 stderr에 나온다. 무해하다 —
 * `data/admin.test.ts` 헤더 주석에 이유가 적혀 있다. 통과 여부는 종료 코드로 판단한다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  SETTINGS_HOME,
  SETTINGS_NAV,
  activeSettings,
  settingsGroupHrefs,
  settingsLeafHrefs,
  settingsRedirect,
} from "./settings-nav.ts";

/* ───────────── 구조 ───────────── */

test("모든 경로가 /settings로 시작한다", () => {
  for (const href of [...settingsLeafHrefs(), ...settingsGroupHrefs()]) {
    assert.ok(href.startsWith("/settings"), href);
  }
});

test("잎 경로가 중복되지 않는다", () => {
  const hrefs = settingsLeafHrefs();
  assert.equal(new Set(hrefs).size, hrefs.length, "잎 경로가 중복됐다");
});

test("그룹은 하위 항목을 둘 이상 갖는다", () => {
  for (const s of SETTINGS_NAV) {
    if (s.kind !== "group") continue;
    assert.ok(
      s.children.length >= 2,
      `${s.label}: 하위가 ${s.children.length}개면 그룹이 아니라 잎이어야 한다`,
    );
  }
});

test("그룹의 하위 경로는 그룹 경로 아래에 있다", () => {
  for (const s of SETTINGS_NAV) {
    if (s.kind !== "group") continue;
    for (const kid of s.children) {
      assert.ok(kid.href.startsWith(s.href + "/"), `${kid.href} ⊄ ${s.href}`);
    }
  }
});

test("SETTINGS_HOME은 실제 잎 중 하나다", () => {
  assert.ok(settingsLeafHrefs().includes(SETTINGS_HOME), SETTINGS_HOME);
});

/* ───────────── 리다이렉트 ───────────── */

test("/settings는 홈 잎으로 보낸다", () => {
  assert.equal(settingsRedirect("/settings"), SETTINGS_HOME);
});

test("그룹 경로는 첫 하위 항목으로 보낸다", () => {
  for (const s of SETTINGS_NAV) {
    if (s.kind !== "group") continue;
    assert.equal(settingsRedirect(s.href), s.children[0].href, s.label);
  }
});

test("잎 경로는 보내지 않는다", () => {
  for (const href of settingsLeafHrefs()) {
    assert.equal(settingsRedirect(href), null, href);
  }
});

test("모르는 경로는 보내지 않는다", () => {
  assert.equal(settingsRedirect("/settings/nope"), null);
  assert.equal(settingsRedirect("/dashboard"), null);
});

/* ───────────── 활성 판정 ───────────── */

test("잎 경로에서 그 잎과 그 그룹이 활성이다", () => {
  const hit = activeSettings("/settings/workspace/integrations");
  assert.ok(hit);
  assert.equal(hit.section.label, "워크스페이스");
  assert.equal(hit.leaf?.href, "/settings/workspace/integrations");
});

test("단일 항목 경로에서는 leaf가 null이다", () => {
  const hit = activeSettings("/settings/account");
  assert.ok(hit);
  assert.equal(hit.section.kind, "leaf");
  assert.equal(hit.leaf, null);
});

test("그룹 경로만 주면 그룹이 활성이고 잎은 없다", () => {
  const hit = activeSettings("/settings/workspace");
  assert.ok(hit);
  assert.equal(hit.section.label, "워크스페이스");
  assert.equal(hit.leaf, null);
});

test("잎 아래 더 깊은 경로도 그 잎을 활성으로 본다", () => {
  // 나중에 /settings/workspace/integrations/erp 같은 하위가 생겨도 내비가 흔들리지 않게
  const hit = activeSettings("/settings/workspace/integrations/erp");
  assert.equal(hit?.leaf?.href, "/settings/workspace/integrations");
});

test("설정 밖 경로는 null이다", () => {
  assert.equal(activeSettings("/dashboard"), null);
  assert.equal(activeSettings("/settingsx/account"), null);
});

/* ───────────── 이 단계(A)의 모양 ───────────── */

test("잎이 5개다", () => {
  // 계정 · 회사>초대 관리 · 회사>권한 관리 · 워크스페이스>기능 · 워크스페이스>연동
  assert.equal(settingsLeafHrefs().length, 5, settingsLeafHrefs().join(" "));
});

test("알림은 아직 내비에 없다", () => {
  // 워크스페이스 알림은 임시 비활성화 상태라 뺐다 (spec 참조).
  // 개인 알림 수신 설정은 계정 페이지 안 섹션이라 내비 항목이 아니다.
  assert.ok(!settingsLeafHrefs().join(" ").includes("notification"));
});

/* ───────────── 내비 ↔ 파일시스템 ───────────── */

/** `/settings/account` → `app/(settings)/settings/account/page.tsx` */
function pagePath(href: string): string {
  return path.join("app", "(settings)", ...href.split("/").filter(Boolean), "page.tsx");
}

test("모든 잎 경로에 page.tsx가 있다", () => {
  for (const href of settingsLeafHrefs()) {
    assert.ok(fs.existsSync(pagePath(href)), `없음: ${pagePath(href)}`);
  }
});

test("모든 그룹 경로에 리다이렉트 page.tsx가 있다", () => {
  for (const href of settingsGroupHrefs()) {
    assert.ok(fs.existsSync(pagePath(href)), `없음: ${pagePath(href)}`);
  }
});

test("/settings 자체에 리다이렉트 page.tsx가 있다", () => {
  assert.ok(fs.existsSync(pagePath("/settings")), "없음: /settings");
});

test("옛 (app) 그룹의 설정 라우트가 남아 있지 않다", () => {
  // 같은 URL을 두 라우트 그룹이 주장하면 Next 빌드가 충돌을 낸다
  assert.ok(
    !fs.existsSync(path.join("app", "(app)", "settings")),
    "app/(app)/settings 를 지워야 한다",
  );
});

test("옛 admin 경로가 남아 있지 않다", () => {
  // `관리`(/settings/admin) → `회사`(/settings/company)로 옮겼다 (수정요청 v12).
  // 폴더가 남으면 내비에 없는 페이지가 URL로는 열려서 옛 화면이 살아 있는 것처럼 보인다.
  for (const stale of [
    path.join("app", "(settings)", "settings", "admin"),
    path.join("components", "settings", "admin"),
  ]) {
    assert.ok(!fs.existsSync(stale), `${stale} 를 지워야 한다`);
  }
});
