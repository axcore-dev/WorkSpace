"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBuilding, IconDashboard, IconGauge } from "@/components/icons";

const ITEMS = [
  { href: "/admin", label: "대시보드", icon: IconDashboard },
  {
    href: "/admin/workspaces",
    label: "워크스페이스",
    icon: IconBuilding,
    // 만들기는 `/admin/new`에 있다 — `/admin/workspaces/new`로 옮기면 `new`라는 이름의
    // 워크스페이스가 가려진다 (수정요청v9 ① 1-1)
    owns: ["/admin/workspaces", "/admin/new"],
  },
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
          const active = isActive(pathname, item);
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
 * 각 메뉴가 자기 경로를 명시적으로 소유한다 — 「빼기 예외」 방식을 쓰지 않는다.
 *
 * 전에는 「워크스페이스」가 `/admin/` 아래 전부를 주장하고 `billing`만 예외로 뺐다.
 * 메뉴를 추가할 때마다 예외를 붙여야 했고 잊으면 조용히 틀렸다.
 * 상세가 `/admin/workspaces/<slug>`로 옮겨져 `/admin/` 아래에 동적 경로가 없으므로,
 * 이제 접두사 비교만으로 정확하다.
 */
function isActive(pathname: string, item: { href: string; owns?: string[] }) {
  if (pathname === item.href) return true;
  return (item.owns ?? []).some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
