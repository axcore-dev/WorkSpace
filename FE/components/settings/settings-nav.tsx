"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconShield, IconUser } from "@/components/icons";
import { SETTINGS_NAV, activeSettings } from "@/data/settings-nav";
import { canManageRoles, useWorkspaceMe } from "@/lib/workspace-me";

/** 소유자만 여는 화면 */
const ROLES_HREF = "/settings/company/roles";

/** 단일 항목에만 아이콘을 준다 — 그룹 라벨과 구분되게 한다 */
const LEAF_ICON: Record<string, typeof IconUser> = {
  "/settings/account": IconUser,
  "/settings/company": IconShield,
};

const ITEM =
  "flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400";
const ITEM_ON = "bg-white font-semibold text-slate-900 ring-1 ring-slate-200";
const ITEM_OFF = "font-medium text-slate-600 hover:bg-slate-200/60 hover:text-slate-900";

/**
 * 설정 내비 — 구조는 `data/settings-nav.ts`가 쥐고 여기서는 그리기만 한다.
 *
 * `variant="side"`: 데스크톱 사이드바 (2단계, 계층은 연결선으로).
 * `variant="top"`: `lg` 미만 상단 가로 스크롤 탭 (그룹 한 줄 + 하위 항목 한 줄).
 *   하위가 없는 섹션에서는 두 번째 줄이 사라진다 — 줄 수가 "여기는 더 들어갈 곳이
 *   있다"는 신호가 된다.
 */
export function SettingsNav({ variant }: { variant: "side" | "top" }) {
  const pathname = usePathname();
  const active = activeSettings(pathname);
  // 소유자만 여는 화면은 내비에서도 감춘다 — 눌러서 거부 화면을 만나는 것보다 낫다.
  // 자격은 서버(`/api/workspace/me`)가 준다. 받기 전에는 감춰 두고 오면 나타난다.
  // **보안 경계가 아니다**: 주소로 직접 들어올 수 있어서 페이지도 따로 막는다.
  const { me } = useWorkspaceMe();
  const canRoles = canManageRoles(me);
  const visible = (href: string) => canRoles || href !== ROLES_HREF;
  // 중첩 판별식 좁히기에 기대지 않고 그룹을 미리 꺼낸다.
  const activeGroup = active && active.section.kind === "group" ? active.section : null;

  if (variant === "top") {
    return (
      <nav aria-label="설정 메뉴">
        <div className="thin-scroll flex gap-1 overflow-x-auto px-4">
          {SETTINGS_NAV.map((s) => {
            const on = active?.section.label === s.label;
            const href = s.kind === "group" ? s.children[0].href : s.href;
            return (
              <Link
                key={s.label}
                href={href}
                aria-current={on ? "page" : undefined}
                className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors duration-150 ${
                  on
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {s.label}
              </Link>
            );
          })}
        </div>
        {activeGroup && (
          <div className="thin-scroll flex gap-1.5 overflow-x-auto px-4 pb-2.5 pt-1.5">
            {activeGroup.children.filter((c) => visible(c.href)).map((c) => {
              const on = active?.leaf?.href === c.href;
              return (
                <Link
                  key={c.href}
                  href={c.href}
                  aria-current={on ? "page" : undefined}
                  className={`whitespace-nowrap rounded-full border px-3 py-1 text-[13px] transition-colors duration-150 ${
                    on
                      ? "border-slate-300 bg-white font-medium text-slate-900"
                      : "border-slate-200 text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {c.label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>
    );
  }

  return (
    <nav className="thin-scroll flex-1 overflow-y-auto px-3 py-3.5" aria-label="설정 메뉴">
      <ul className="space-y-6">
        {SETTINGS_NAV.map((s) => {
          if (s.kind === "leaf") {
            const on = active?.section.label === s.label;
            const Icon = LEAF_ICON[s.href];
            return (
              <li key={s.href}>
                <Link
                  href={s.href}
                  aria-current={on ? "page" : undefined}
                  className={`${ITEM} ${on ? ITEM_ON : ITEM_OFF}`}
                >
                  {Icon && (
                    <Icon
                      size={16}
                      className={`shrink-0 ${on ? "text-slate-600" : "text-slate-400"}`}
                    />
                  )}
                  {s.label}
                </Link>
              </li>
            );
          }
          return (
            <li key={s.href}>
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {s.label}
              </p>
              <ul className="ml-3 space-y-1 border-l border-slate-300 pl-3">
                {s.children.filter((c) => visible(c.href)).map((c) => {
                  const on = active?.leaf?.href === c.href;
                  return (
                    <li key={c.href}>
                      <Link
                        href={c.href}
                        aria-current={on ? "page" : undefined}
                        className={`${ITEM} ${on ? ITEM_ON : ITEM_OFF}`}
                      >
                        {c.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
