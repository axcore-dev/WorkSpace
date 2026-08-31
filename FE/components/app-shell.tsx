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
  IconDashboard,
  IconLogOut,
  IconSettings,
  IconShield,
  IconUser,
} from "@/components/icons";
import { Logo } from "@/components/logo";
import { useModules } from "@/components/module-provider";
import { SettingsModal, type SettingsTab } from "@/components/settings/settings-modal";
import { MODULES } from "@/data/modules";
import { DEFAULT_WORKSPACE_ID, DEMO_USER, EXTERNAL_SYSTEMS, WORKSPACES } from "@/data/org";

function NavLink({
  href,
  active,
  children,
  small = false,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-10 items-center gap-2.5 rounded-lg px-3 ${small ? "py-1.5 text-[13px]" : "py-2 text-sm"} transition-colors duration-150 ${
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
  const { state } = useModules();

  const [orgOpen, setOrgOpen] = useState(false);
  const [orgId, setOrgId] = useState(DEFAULT_WORKSPACE_ID);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("account");

  const orgRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (orgRef.current && !orgRef.current.contains(e.target as Node)) setOrgOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function logout() {
    localStorage.removeItem("axpoint-user");
    router.push("/login");
  }

  function openSettings(tab: SettingsTab) {
    setSettingsTab(tab);
    setSettingsOpen(true);
    setProfileOpen(false);
  }

  const currentOrg = WORKSPACES.find((w) => w.id === orgId) ?? WORKSPACES[0];

  const profileMenu: { label: string; tab: SettingsTab; icon: typeof IconUser }[] = [
    { label: "계정", tab: "account", icon: IconUser },
    { label: "관리", tab: "admin", icon: IconShield },
    { label: "설정", tab: "workspace", icon: IconSettings },
  ];

  return (
    <div className="flex min-h-screen">
      {/* ── 좌측 패널 ── */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-slate-200 bg-slate-100">
        {/* 상단 로고 */}
        <Link href="/dashboard" className="flex items-center gap-2 px-5 py-4" aria-label="WorkSpace 홈">
          <Logo height={18} />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">WorkSpace</span>
        </Link>

        {/* 조직 선택기 */}
        <div className="relative px-3 pb-3" ref={orgRef}>
          <button
            type="button"
            aria-expanded={orgOpen}
            aria-haspopup="listbox"
            onClick={() => setOrgOpen((v) => !v)}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:bg-slate-50"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
              <IconBuilding size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-900">{currentOrg.name}</span>
              <span className="block truncate text-[11px] text-slate-400">{currentOrg.plan}</span>
            </span>
            <IconChevronDown size={15} className="shrink-0 text-slate-400" />
          </button>

          {orgOpen && (
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

        <nav className="thin-scroll flex-1 space-y-6 overflow-y-auto px-3 py-2" aria-label="주 메뉴">
          <div className="space-y-1">
            <NavLink href="/dashboard" active={pathname === "/dashboard"}>
              <IconDashboard size={17} className="shrink-0 text-slate-400" />
              주요 정보
            </NavLink>
          </div>

          <div>
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              핵심 기능
            </p>
            <div className="space-y-1">
              {MODULES.map((mod) => {
                const Icon = ICON_MAP[mod.icon];
                const enabled = state[mod.slug]?.enabled;
                const active = pathname === `/modules/${mod.slug}`;
                if (!enabled) return null;
                return (
                  <NavLink key={mod.slug} href={`/modules/${mod.slug}`} active={active} small>
                    <Icon size={16} className={`shrink-0 ${active ? "text-slate-700" : "text-slate-400"}`} />
                    {mod.name}
                  </NavLink>
                );
              })}
            </div>
          </div>

          {/* 외부 시스템 연동 바로가기 */}
          <div>
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
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
                  >
                    <Icon size={16} className="shrink-0 text-slate-400" />
                    {sys.name}
                  </NavLink>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              AI 워크스페이스
            </p>
            <div className="space-y-1">
              <NavLink href="/ai-chat" active={pathname === "/ai-chat"}>
                <IconChat size={17} className="shrink-0 text-slate-400" />
                AI대화
              </NavLink>
              <NavLink href="/ai-diagnosis" active={pathname === "/ai-diagnosis"}>
                <IconActivity size={17} className="shrink-0 text-slate-400" />
                AI알림
              </NavLink>
            </div>
          </div>
        </nav>

        {/* 하단 프로필 → 팝업 메뉴 */}
        <div className="relative border-t border-slate-200 p-4" ref={profileRef}>
          {profileOpen && (
            <div
              role="menu"
              aria-label="프로필 메뉴"
              className="absolute bottom-full left-4 right-4 mb-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
            >
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">{DEMO_USER.name}</p>
                <p className="truncate text-xs text-slate-500">{DEMO_USER.email}</p>
              </div>
              <div className="p-1.5">
                {profileMenu.map((item) => (
                  <button
                    key={item.tab}
                    type="button"
                    role="menuitem"
                    onClick={() => openSettings(item.tab)}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    <item.icon size={16} className="text-slate-400" />
                    {item.label}
                  </button>
                ))}
                <button
                  type="button"
                  role="menuitem"
                  onClick={logout}
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
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            onClick={() => setProfileOpen((v) => !v)}
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-slate-200/60"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white">
              {DEMO_USER.initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-900">{DEMO_USER.name}</span>
              <span className="block truncate text-xs text-slate-500">{DEMO_USER.role}</span>
            </span>
            <IconChevronDown size={15} className="shrink-0 text-slate-400" />
          </button>
        </div>
      </aside>

      {/* ── 콘텐츠 ── */}
      <main className="min-w-0 flex-1 pl-60">{children}</main>

      <SettingsModal
        open={settingsOpen}
        tab={settingsTab}
        onTab={setSettingsTab}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
