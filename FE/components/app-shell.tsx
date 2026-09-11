"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import { useLogout } from "@/components/use-logout";
import { useSidebarCollapsed } from "@/components/use-sidebar-collapsed";
import { useAccountMe } from "@/lib/account-me";
import { ApiRequestError, apiGet, apiPostAuthed } from "@/lib/api";
import { setAccessToken } from "@/lib/session";
import { useWorkspaceMe } from "@/lib/workspace-me";
import { MODULES } from "@/data/modules";
import { EXTERNAL_SYSTEMS } from "@/data/org";

/** `GET /api/auth/workspaces` 한 줄 — 회사 선택 화면(`app/(auth)/workspace`)과 같은 모양이다 */
type Membership = {
  id: number;
  name: string;
  plan: string;
  /** 소속과 회사가 둘 다 살아 있을 때만 true */
  enterable: boolean;
};

type SelectResult = {
  accessToken?: string | null;
  accessTokenExpiresAt?: string | null;
};

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
  const router = useRouter();

  const [orgOpen, setOrgOpen] = useState(false);
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

  // 이름·사진은 계정(`/api/auth/me`), 직급·회사 이름은 지금 회사(`/api/workspace/me`)가 준다. 받기 전에는
  // 빈 줄(공백 문자)로 높이만 지킨다 — 빈 문자열이면 줄이 사라져 사이드바가 들썩인다.
  const { me: account } = useAccountMe();
  const { me: ws } = useWorkspaceMe();

  /**
   * 사이드바에 보일 기능 — 서버가 계산한 내 것(`me.modules` = 회사가 켠 기능 ∩ 내 직급 ∩ 내 개별 권한)이다.
   * 회사가 켠 목록(`useModules`)으로 그리면 권한 없는 사람에게도 보이고, 눌러야 403 을 만난다.
   * 받기 전에는 비어 있다 — 없는 것을 보여 주는 편이 없는 권한을 보여 주는 것보다 낫다.
   */
  const allowedModules = new Set(ws?.modules ?? []);

  /**
   * 회사 선택기 — 내 소속 목록(`GET /api/auth/workspaces`)과 지금 회사.
   *
   * 지금 회사의 이름은 `/api/workspace/me` 가 주고, 요금제는 소속 목록의 같은 id 에서 읽는다. 서버 운영자는 소속 없이
   * 들어오므로 목록이 비어 요금제 줄이 빈다 — 그대로 둔다. 전환은 회사 선택 화면과 같은 API 로 새 토큰을 받고
   * 대시보드로 간다. 토큰이 바뀌면 각 스토어가 SESSION_CHANGED 로 스스로 다시 받는다.
   */
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [switching, setSwitching] = useState<number | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    apiGet<Membership[]>("/api/auth/workspaces")
      .then((rows) => {
        if (alive) setMemberships(rows ?? []);
      })
      .catch(() => {
        // 목록을 못 받아도 지금 회사 이름은 /api/workspace/me 가 따로 준다. 전환 목록만 비어 있게 둔다
      });
    return () => {
      alive = false;
    };
  }, []);

  const currentName = ws?.workspaceName ?? " ";
  const currentPlan = memberships.find((m) => m.id === ws?.workspaceId)?.plan ?? " ";

  async function switchTo(m: Membership) {
    if (m.id === ws?.workspaceId) {
      setOrgOpen(false);
      return;
    }
    setSwitchError(null);
    setSwitching(m.id);
    try {
      const result = await apiPostAuthed<SelectResult>(`/api/auth/workspaces/${m.id}/select`);
      setAccessToken(result?.accessToken ?? null, result?.accessTokenExpiresAt ?? null);
      setOrgOpen(false);
      router.push("/dashboard");
    } catch (e: unknown) {
      setSwitchError(e instanceof ApiRequestError ? e.body.message : "회사를 바꾸지 못했어요");
    } finally {
      setSwitching(null);
    }
  }
  const displayName = account?.name ?? " ";
  const roleName = ws?.member.roleName ?? " ";

  return (
    <div className="flex min-h-dvh">
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
              <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500">
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
            title={collapsed ? currentName : undefined}
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
                  <span className="block truncate text-sm font-semibold text-slate-900">{currentName}</span>
                  <span className="block truncate text-[11px] text-slate-400">{currentPlan}</span>
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
              {memberships.length === 0 && (
                <p className="px-3 py-3 text-[13px] text-slate-400">전환할 수 있는 다른 회사가 없어요.</p>
              )}
              {memberships.map((m) => {
                const active = m.id === ws?.workspaceId;
                const busy = switching === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={!m.enterable || switching !== null}
                    onClick={() => void switchTo(m)}
                    className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{m.name}</span>
                      <span className="block truncate text-[11px] text-slate-400">
                        {busy ? "들어가는 중…" : m.enterable ? m.plan : "지금은 들어갈 수 없어요"}
                      </span>
                    </span>
                    {active && <IconCheck size={15} className="shrink-0 text-slate-700" />}
                  </button>
                );
              })}
              {switchError && (
                <p className="border-t border-slate-100 px-3 py-2 text-xs text-red-600" role="alert">
                  {switchError}
                </p>
              )}
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

          {/* 볼 수 있는 기능이 하나도 없으면 제목만 남아 빈 칸이 된다 — 묶음째 감춘다 */}
          <div className={allowedModules.size === 0 ? "hidden" : ""}>
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
                const active = pathname === `/modules/${mod.slug}`;
                // 회사가 켰는지가 아니라 내가 볼 수 있는지로 그린다 — 서버가 계산한 me.modules 가 기준이다.
                // 켜져 있어도 내 직급에 없으면 눌러도 403 이라, 아예 보이지 않는 편이 맞다.
                if (!allowedModules.has(mod.slug)) return null;
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
      {/* flex-col — 풀-하이트 화면(AI대화·외부 시스템)은 `flex-1 min-h-0`으로 남은 높이를 받는다.
          자식이 `h-dvh`를 직접 재면 lg 미만에서 아래 상단 바(약 57px)만큼 문서가 넘친다 */}
      <main
        className={`flex min-w-0 flex-1 flex-col transition-[padding] duration-300 ${
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
