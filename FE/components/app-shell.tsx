"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ICON_MAP,
  IconActivity,
  IconBuilding,
  IconChat,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconDashboard,
  IconLogOut,
  IconMenu,
  IconSettings,
  IconX,
} from "@/components/icons";
import { Avatar } from "@/components/avatar";
import { Logo } from "@/components/logo";
import { useModules } from "@/components/module-provider";
import { useLogout } from "@/components/use-logout";
import { useSidebarCollapsed } from "@/components/use-sidebar-collapsed";
import { useAccountMe } from "@/lib/account-me";
import { useWorkspaceMe } from "@/lib/workspace-me";
import { MODULES } from "@/data/modules";
import { DEFAULT_WORKSPACE_ID, EXTERNAL_SYSTEMS, WORKSPACES } from "@/data/org";

function NavLink({
  href,
  active,
  children,
  small = false,
  collapsed = false,
  title,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  small?: boolean;
  collapsed?: boolean;
  title?: string;
}) {
  return (
    <Link
      href={href}
      title={title}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-10 items-center gap-2.5 rounded-lg px-3 ${small ? "py-1.5 text-[13px]" : "py-2 text-sm"} transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
        collapsed ? "justify-center" : ""
      } ${
        active
          ? "bg-white font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200"
          : "font-medium text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
      }`}
    >
      {children}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state } = useModules();

  const [orgOpen, setOrgOpen] = useState(false);
  const [orgId, setOrgId] = useState(DEFAULT_WORKSPACE_ID);
  const [profileOpen, setProfileOpen] = useState(false);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed("axpoint-app-nav-collapsed");
  // lg 미만에서 사이드바는 화면 밖에 있다가 밀려 들어온다 (본문 폭을 밀지 않는다 — 「AI 대화 docked 패널」과 같은 규칙)
  const [navOpen, setNavOpen] = useState(false);

  const orgRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // 접기/펼치기 시 열려 있던 드롭다운을 닫는다 — 240px 기준 위치라 80px에서 어긋난다.
  function handleToggleCollapse() {
    setOrgOpen(false);
    setProfileOpen(false);
    toggleCollapsed();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setNavOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (orgRef.current && !orgRef.current.contains(e.target as Node)) setOrgOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const logout = useLogout();

  const currentOrg = WORKSPACES.find((w) => w.id === orgId) ?? WORKSPACES[0];

  // 이름·사진은 계정(`/api/auth/me`), 직급은 지금 회사(`/api/workspace/me`)가 준다. 받기 전에는
  // 빈 줄(공백 문자)로 높이만 지킨다 — 빈 문자열이면 줄이 사라져 사이드바가 들썩인다.
  const { me: account } = useAccountMe();
  const { me: ws } = useWorkspaceMe();
  const displayName = account?.name ?? " ";
  const roleName = ws?.member.roleName ?? " ";

  return (
    <div className="flex min-h-screen">
      {/* ── 좌측 패널 ── */}
      <aside
        id="app-nav"
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-slate-200 bg-slate-100 transition-transform duration-300 lg:z-30 lg:translate-x-0 lg:transition-[width] ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-20" : "lg:w-60"}`}
      >
        {/* 상단 로고 + 접기 토글 */}
        <div className={`flex items-center gap-2 px-5 py-4 ${collapsed ? "justify-center" : ""}`}>
          {!collapsed && (
            <Link href="/dashboard" className="flex min-w-0 items-center gap-2" aria-label="WorkSpace 홈">
              <Logo height={18} />
              <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                WorkSpace
              </span>
            </Link>
          )}
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
            onClick={handleToggleCollapse}
            className={`hidden shrink-0 cursor-pointer items-center justify-center rounded-md p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-200/60 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 lg:flex ${
              collapsed ? "" : "ml-auto"
            }`}
          >
            {collapsed ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
          </button>
          {/* lg 미만 — 접기가 아니라 닫기다 (드로어라서 80px 레일이 의미가 없다) */}
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setNavOpen(false)}
            className="ml-auto flex shrink-0 cursor-pointer items-center justify-center rounded-md p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-200/60 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 lg:hidden"
          >
            <IconX size={16} />
          </button>
        </div>

        {/* 조직 선택기 */}
        <div className="relative px-3 pb-3" ref={orgRef}>
          <button
            type="button"
            aria-expanded={orgOpen && !collapsed}
            aria-haspopup="listbox"
            title={collapsed ? currentOrg.name : undefined}
            onClick={() => !collapsed && setOrgOpen((v) => !v)}
            className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
              <IconBuilding size={15} />
            </span>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">{currentOrg.name}</span>
                  <span className="block truncate text-[11px] text-slate-400">{currentOrg.plan}</span>
                </span>
                <IconChevronDown size={15} className="shrink-0 text-slate-400" />
              </>
            )}
          </button>

          {orgOpen && !collapsed && (
            <div
              role="listbox"
              className="absolute left-3 right-3 z-40 mt-1.5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
            >
              <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                워크스페이스 전환
              </p>
              {WORKSPACES.map((ws) => {
                const active = ws.id === orgId;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setOrgId(ws.id);
                      setOrgOpen(false);
                    }}
                    className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-slate-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{ws.name}</span>
                      <span className="block truncate text-[11px] text-slate-400">{ws.role}</span>
                    </span>
                    {active && <IconCheck size={15} className="shrink-0 text-slate-700" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <nav
          // 항목을 누르면 드로어를 닫는다 — 누른 화면이 보여야지 내비가 덮고 있으면 안 된다 (lg 이상은 무해)
          onClick={() => setNavOpen(false)}
          className="thin-scroll flex-1 space-y-6 overflow-y-auto px-3 py-2" aria-label="주 메뉴">
          <div className="space-y-1">
            <NavLink
              href="/dashboard"
              active={pathname === "/dashboard"}
              collapsed={collapsed}
              title={collapsed ? "주요 정보" : undefined}
            >
              <IconDashboard size={17} className="shrink-0 text-slate-400" />
              {!collapsed && "주요 정보"}
            </NavLink>
          </div>

          <div>
            <p
              className={`mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 ${
                collapsed ? "hidden" : ""
              }`}
            >
              핵심 기능
            </p>
            <div className="space-y-1">
              {MODULES.map((mod) => {
                const Icon = ICON_MAP[mod.icon];
                const enabled = state[mod.slug]?.enabled;
                const active = pathname === `/modules/${mod.slug}`;
                if (!enabled) return null;
                return (
                  <NavLink
                    key={mod.slug}
                    href={`/modules/${mod.slug}`}
                    active={active}
                    small
                    collapsed={collapsed}
                    title={collapsed ? mod.name : undefined}
                  >
                    <Icon size={16} className={`shrink-0 ${active ? "text-slate-700" : "text-slate-400"}`} />
                    {!collapsed && mod.name}
                  </NavLink>
                );
              })}
            </div>
          </div>

          {/* 외부 시스템 연동 바로가기 */}
          <div>
            <p
              className={`mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 ${
                collapsed ? "hidden" : ""
              }`}
            >
              외부 시스템
            </p>
            <div className="space-y-1">
              {EXTERNAL_SYSTEMS.map((sys) => {
                const Icon = ICON_MAP[sys.icon];
                return (
                  <NavLink
                    key={sys.slug}
                    href={`/external/${sys.slug}`}
                    active={pathname === `/external/${sys.slug}`}
                    small
                    collapsed={collapsed}
                    title={collapsed ? sys.name : undefined}
                  >
                    <Icon size={16} className="shrink-0 text-slate-400" />
                    {!collapsed && sys.name}
                  </NavLink>
                );
              })}
            </div>
          </div>

          <div>
            <p
              className={`mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 ${
                collapsed ? "hidden" : ""
              }`}
            >
              AI 워크스페이스
            </p>
            <div className="space-y-1">
              <NavLink
                href="/ai-chat"
                active={pathname === "/ai-chat"}
                collapsed={collapsed}
                title={collapsed ? "AI대화" : undefined}
              >
                <IconChat size={17} className="shrink-0 text-slate-400" />
                {!collapsed && "AI대화"}
              </NavLink>
              <NavLink
                href="/ai-diagnosis"
                active={pathname === "/ai-diagnosis"}
                collapsed={collapsed}
                title={collapsed ? "AI알림" : undefined}
              >
                <IconActivity size={17} className="shrink-0 text-slate-400" />
                {!collapsed && "AI알림"}
              </NavLink>
            </div>
          </div>
        </nav>

        {/* 하단 프로필 → 팝업 메뉴 */}
        <div className="relative border-t border-slate-200 p-4" ref={profileRef}>
          {profileOpen && !collapsed && (
            <div
              role="menu"
              aria-label="프로필 메뉴"
              className="absolute bottom-full left-4 right-4 mb-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
            >
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                <p className="truncate text-xs text-slate-500">{account?.email ?? ""}</p>
              </div>
              <div className="p-1.5">
                <Link
                  href="/settings"
                  role="menuitem"
                  onClick={() => setProfileOpen(false)}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100"
                >
                  <IconSettings size={16} className="text-slate-400" />
                  설정
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void logout()}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  <IconLogOut size={16} />
                  로그아웃
                </button>
              </div>
            </div>
          )}
          <button
            type="button"
            aria-expanded={profileOpen && !collapsed}
            aria-haspopup="menu"
            title={collapsed ? displayName : undefined}
            aria-label={collapsed ? displayName : undefined}
            onClick={() => !collapsed && setProfileOpen((v) => !v)}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-slate-200/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <Avatar name={account?.name ?? ""} src={account?.avatarUrl ?? null} size={36} />
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">{displayName}</span>
                  <span className="block truncate text-xs text-slate-500">{roleName}</span>
                </span>
                <IconChevronDown size={15} className="shrink-0 text-slate-400" />
              </>
            )}
          </button>
        </div>
      </aside>

      {/* 드로어 뒤 가림막 — 바깥을 누르면 닫힌다 */}
      {navOpen && (
        <div
          aria-hidden
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
        />
      )}

      {/* ── 콘텐츠 ── */}
      <main
        className={`min-w-0 flex-1 transition-[padding] duration-300 ${
          collapsed ? "lg:pl-20" : "lg:pl-60"
        }`}
      >
        {/* lg 미만 — 사이드바가 화면 밖이므로 여는 버튼과 브랜드를 상단 바에 둔다 */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            aria-expanded={navOpen}
            aria-controls="app-nav"
            aria-label="메뉴 열기"
            onClick={() => {
              if (collapsed) toggleCollapsed();
              setNavOpen(true);
            }}
            className="-ml-1.5 flex cursor-pointer items-center justify-center rounded-md p-1.5 text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            <IconMenu size={20} />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2" aria-label="WorkSpace 홈">
            <Logo height={16} />
          </Link>
        </header>
        {children}
      </main>
    </div>
  );
}
