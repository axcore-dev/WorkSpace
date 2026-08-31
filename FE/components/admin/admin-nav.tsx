"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBuilding, IconDashboard, IconGauge } from "@/components/icons";

const ITEMS = [
  { href: "/admin", label: "대시보드", icon: IconDashboard },
  { href: "/admin/workspaces", label: "워크스페이스", icon: IconBuilding },
  { href: "/admin/billing", label: "사용량 · 요금", icon: IconGauge },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="px-3 py-3 lg:py-4" aria-label="운영자 메뉴">
      <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        고객 운영
      </p>
      <div className="space-y-0.5">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
                active
                  ? "bg-slate-100 font-semibold text-slate-900"
                  : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <item.icon size={16} className="shrink-0 text-slate-400" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * 대시보드는 정확히 `/admin`일 때만 활성.
 * 워크스페이스는 목록·생성·상세(`/admin/<slug>`)를 전부 품는다 — `/admin/billing`만 예외다.
 */
function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/billing") return pathname === "/admin/billing";
  return pathname.startsWith("/admin/") && pathname !== "/admin/billing";
}
