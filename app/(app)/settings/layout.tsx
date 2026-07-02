"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconSettings, IconShield, IconUser } from "@/components/icons";

const TABS = [
  { href: "/settings/account", label: "계정", icon: IconUser, desc: "프로필·비밀번호·2단계 인증" },
  { href: "/settings/admin", label: "관리", icon: IconShield, desc: "사용자·권한(RBAC)·감사 로그" },
  { href: "/settings/workspace", label: "설정", icon: IconSettings, desc: "모듈·연동·알림" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="mx-auto max-w-6xl px-6 py-6 lg:px-8">
      <h1 className="text-xl font-bold tracking-tight text-slate-900">설정 및 관리</h1>
      <p className="mt-0.5 text-sm text-slate-500">
        모든 설정 변경은 감사 로그에 기록됩니다. (프로필 메뉴에서 팝업으로도 열 수 있습니다.)
      </p>
      <nav className="mt-5 flex flex-wrap gap-2" aria-label="설정 메뉴">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-lg border px-4 py-2.5 transition-colors duration-150 ${
                active
                  ? "border-slate-300 bg-slate-100 text-slate-900"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <tab.icon size={16} className="text-slate-400" />
              <span>
                <span className="block text-sm font-semibold">{tab.label}</span>
                <span className="block text-[11px] text-slate-400">{tab.desc}</span>
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
