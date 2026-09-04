/**
 * 설정 내비 구조 — 단일 소스.
 *
 * 이 파일은 **import를 갖지 않는다.** `node --test`가 타입 스트립으로 `.ts`를 그대로
 * 실행하는데, JSX나 `@/` 경로 별칭은 해석하지 못한다. 아이콘은 그리는 쪽
 * (`components/settings/settings-nav.tsx`)에서 붙인다.
 *
 * 구조는 2단계까지다 (DESIGN.md 「사이드바」 절). 하위가 하나뿐인 항목은 그룹을 만들지
 * 않고 `kind: "leaf"`로 둔다 — 없는 내용을 만들어 깊이를 맞추지 않는다.
 *
 * `초대 관리`는 한 페이지 안에서 인라인 탭 3개(구성원·초대 중·초대 링크)로
 * 갈린다 — 라우트로 쪼개지 않는다 (DESIGN.md 「페이지 안 탭」).
 */

export type SettingsLeaf = {
  href: string;
  label: string;
  /**
   * 본문 폭 제한(`max-w-3xl`)을 풀고 화면을 꽉 채운다.
   *
   * 기본이 좁은 이유: 설정은 대부분 「이름 — 값 — 버튼」 한 줄이라 넓히면 이름과 버튼이
   * 화면 양 끝으로 벌어져 눈이 가로로 멀리 이동한다. 열이 여럿인 표는 반대다 — 좁으면
   * 가로 스크롤이 생긴다. 그래서 페이지별로 고른다.
   */
  wide?: boolean;
};

export type SettingsSection =
  | { kind: "group"; label: string; href: string; children: SettingsLeaf[] }
  | { kind: "leaf"; label: string; href: string };

export const SETTINGS_NAV: SettingsSection[] = [
  { kind: "leaf", label: "계정", href: "/settings/account" },
  {
    kind: "group",
    label: "회사",
    href: "/settings/company",
    children: [
      { href: "/settings/company/invites", label: "초대 관리", wide: true },
      { href: "/settings/company/roles", label: "권한 관리", wide: true },
    ],
  },
  {
    kind: "group",
    label: "워크스페이스",
    href: "/settings/workspace",
    children: [
      { href: "/settings/workspace/features", label: "기능 관리" },
      { href: "/settings/workspace/integrations", label: "연동" },
    ],
  },
];

/** 설정에 처음 들어왔을 때 보여줄 화면 */
export const SETTINGS_HOME = "/settings/account";

/** 실제 페이지가 있는 경로 전부 */
export function settingsLeafHrefs(): string[] {
  return SETTINGS_NAV.flatMap((s) =>
    s.kind === "group" ? s.children.map((c) => c.href) : [s.href],
  );
}

/** 리다이렉트만 두는 그룹 경로 */
export function settingsGroupHrefs(): string[] {
  return SETTINGS_NAV.filter((s) => s.kind === "group").map((s) => s.href);
}

/**
 * 이 경로가 리다이렉트 대상이면 보낼 곳, 아니면 `null`.
 * `/settings` → 홈 잎, 그룹 경로 → 첫 하위 항목.
 */
export function settingsRedirect(pathname: string): string | null {
  if (pathname === "/settings") return SETTINGS_HOME;
  for (const s of SETTINGS_NAV) {
    if (s.kind === "group" && s.href === pathname) return s.children[0].href;
  }
  return null;
}

/**
 * 현재 경로에 해당하는 섹션과 잎.
 *
 * 잎보다 깊은 경로도 그 잎을 활성으로 본다 — 나중에 하위가 생겨도 내비가 흔들리지 않게 한다.
 */
export function activeSettings(
  pathname: string,
): { section: SettingsSection; leaf: SettingsLeaf | null } | null {
  const under = (base: string) => pathname === base || pathname.startsWith(base + "/");

  for (const s of SETTINGS_NAV) {
    if (s.kind === "leaf") {
      if (under(s.href)) return { section: s, leaf: null };
      continue;
    }
    if (!under(s.href)) continue;
    return { section: s, leaf: s.children.find((c) => under(c.href)) ?? null };
  }
  return null;
}
