"use client";

import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { AdminNav } from "@/components/admin/admin-nav";
import { AccessDenied } from "@/components/admin/access-denied";
import { useAdminSession } from "@/components/admin/use-admin-session";
import { useSidebarCollapsed } from "@/components/use-sidebar-collapsed";
import { endSession } from "@/components/use-logout";
import { IconChevronLeft, IconChevronRight, IconLogOut } from "@/components/icons";

/**
 * 내부 관리자(AXCORE 운영) 콘솔 레이아웃 — 고객 앱(AppShell)과 크롬을 분리한다.
 *
 * 좌측 내비 + 넓은 본문. 고객 앱의 사이드바를 재사용하지 않는 이유는 메뉴·권한·데이터가
 * 전혀 다르기 때문이다. 운영자 계정 관리 메뉴는 두지 않는다 — 지금은 모든 운영자가 같은 권한이다.
 *
 * 진입 판정: 마운트 시 `/api/auth/me` 로 로그인·운영자 여부를 확인하고(useAdminSession), 운영자가
 * 아니면 레이아웃을 그리지 않고 거부 화면(AccessDenied)만 보여 준다. 이 판정은 **보안 경계가 아니다** —
 * `/api/admin/**` 는 서버가 요청마다 DB 로 다시 본다. 여기서는 운영 메뉴 껍데기가 새지 않게 하고,
 * 사이드바에 실제 로그인한 사람을 표시하는 것이 목적이다.
 *
 * 사이드바 접기(240 ↔ 80)는 `lg` 이상에서만 동작한다 — `lg` 미만은 내비가 상단으로
 * 접히는 기존 반응형 동작을 그대로 유지한다(DESIGN.md 「사이드바」 절).
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = useAdminSession();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed("axpoint-admin-nav-collapsed");
  const router = useRouter();

  async function logout() {
    await endSession();
    router.replace("/login");
  }

  if (session.status === "loading") {
    // 판정 전에는 아무것도 그리지 않는다. 운영 메뉴가 잠깐이라도 보이면 안 된다.
    return <div className="min-h-screen bg-slate-50" aria-busy="true" />;
  }
  if (session.status !== "ok") {
    return (
      <AccessDenied
        reason={session.status}
        message={session.status === "error" ? session.message : undefined}
      />
    );
  }

  const { me } = session;

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside
        className={`flex flex-col border-b border-slate-200 bg-white transition-[width] duration-300 lg:shrink-0 lg:border-b-0 lg:border-r ${
          collapsed ? "lg:w-20" : "lg:w-60"
        }`}
      >
        <div
          className={`flex items-center gap-2.5 border-b border-slate-100 px-5 py-4 ${
            collapsed ? "lg:justify-center" : ""
          }`}
        >
          <div className={`flex items-center gap-2.5 ${collapsed ? "lg:hidden" : ""}`}>
            <Logo height={17} />
            <span className="rounded border border-slate-300 px-1.5 py-px text-[10px] font-semibold tracking-wide text-slate-500">
              운영자
            </span>
          </div>
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
            onClick={toggleCollapsed}
            className={`hidden shrink-0 cursor-pointer items-center justify-center rounded-md p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 lg:flex ${
              collapsed ? "" : "ml-auto"
            }`}
          >
            {collapsed ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
          </button>
        </div>
        <AdminNav collapsed={collapsed} />
        <div
          className={`mt-auto border-t border-slate-100 px-5 py-4 text-xs leading-relaxed text-slate-500 ${
            collapsed ? "lg:flex lg:justify-center" : ""
          }`}
        >
          {/* 로그인한 운영자 본인. 데모 상수가 아니라 /api/auth/me 값이다. */}
          <div className={collapsed ? "lg:hidden" : ""}>
            <p className="font-medium text-slate-700">{me.name}</p>
            <p className="mt-0.5 break-all">{me.email}</p>
            <button
              type="button"
              onClick={() => void logout()}
              className="mt-2 inline-block cursor-pointer font-medium text-slate-500 transition-colors duration-150 hover:text-slate-800"
            >
              로그아웃
            </button>
          </div>
          <button
            type="button"
            aria-label="로그아웃"
            title={`${me.email} 로그아웃`}
            onClick={() => void logout()}
            className={`hidden cursor-pointer rounded-md p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 ${
              collapsed ? "lg:flex" : ""
            }`}
          >
            <IconLogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-6 py-7 lg:px-8">{children}</main>
    </div>
  );
}
