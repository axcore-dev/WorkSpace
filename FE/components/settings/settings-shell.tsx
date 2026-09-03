"use client";

import { useRouter } from "next/navigation";
import { IconArrowLeft, IconLogOut } from "@/components/icons";
import { SettingsNav } from "@/components/settings/settings-nav";
import { useLogout } from "@/components/use-logout";
import { DEFAULT_WORKSPACE_ID, DEMO_USER, WORKSPACES } from "@/data/org";

/**
 * 설정 전용 전체화면 셸 — 앱 사이드바를 설정 내비로 갈아끼운다.
 *
 * 반응형은 운영자 콘솔(`app/(admin)/layout.tsx`)과 같은 방식이다 — `lg` 미만에서 내비가
 * 상단으로 접힌다. `fixed` 사이드바 + 본문 패딩이 아니라 flex를 쓰는 이유가 그것이다.
 * 데스크톱에서는 `lg:sticky lg:top-0 lg:h-screen`으로 내비를 붙여둔다 — 설정은 섹션이
 * 길어서 내비가 스크롤에 밀려 올라가면 옮겨 다니기 불편하다.
 *
 * 접기 토글을 두지 않는다: 설정은 들렀다 나가는 곳이고, 2단계 계층은 80px에서 아이콘만으로
 * 읽히지 않는다 (DESIGN.md 「사이드바」 절).
 */
export function SettingsShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const logout = useLogout();

  // **BE 연동 seam**: `GET /api/auth/workspaces`가 이미 있다. 세션의 현재 워크스페이스로
  // 바꾸면 된다 — 지금은 더미 기본값을 읽는다.
  const workspace = WORKSPACES.find((w) => w.id === DEFAULT_WORKSPACE_ID) ?? WORKSPACES[0];

  /** 직전 화면으로. 직전이 없으면(URL 직접 진입·새 탭) 주요 정보로 보낸다 */
  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-slate-200 bg-slate-100 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
        {/* 상단 — 로고·접기 토글 자리에 돌아가기가 들어간다 */}
        <div className="px-5 py-4 lg:pb-0">
          <button
            type="button"
            onClick={goBack}
            className="-ml-2 flex min-h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-200/60 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            <IconArrowLeft size={15} className="shrink-0" />
            돌아가기
          </button>
          <p className="mt-3.5 hidden text-[17px] font-bold tracking-tight text-slate-900 lg:block">
            설정
          </p>
        </div>

        <div className="mx-5 mt-3 hidden h-px bg-slate-200 lg:block" />

        {/* 내비 — lg 이상은 사이드, 미만은 상단 탭 */}
        <div className="hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          <SettingsNav variant="side" />
        </div>
        <div className="lg:hidden">
          <SettingsNav variant="top" />
        </div>

        {/* 하단 — 워크스페이스 이름 + 프로필 + 로그아웃 */}
        <div className="hidden border-t border-slate-200 p-4 lg:block">
          <p className="px-1 pb-2 text-[11px] text-slate-400">
            편집 중인 워크스페이스
            <span className="block text-xs font-semibold text-slate-600">{workspace.name}</span>
          </p>
          <div className="flex items-center gap-2.5 p-1">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white">
              {DEMO_USER.initials}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900">
                {DEMO_USER.name}
              </span>
              <span className="block truncate text-xs text-slate-500">{DEMO_USER.role}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-1.5 flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] font-medium text-red-600 transition-colors duration-150 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
          >
            <IconLogOut size={15} className="shrink-0" />
            로그아웃
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-7 lg:px-8">{children}</div>
      </main>

      {/* lg 미만 — 사이드바 하단이 숨으므로 워크스페이스·로그아웃을 본문 아래에 둔다 */}
      <div className="border-t border-slate-200 px-6 py-5 lg:hidden">
        <p className="text-[11px] text-slate-400">
          편집 중인 워크스페이스
          <span className="block text-xs font-semibold text-slate-600">{workspace.name}</span>
        </p>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] font-medium text-red-600 transition-colors duration-150 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
        >
          <IconLogOut size={15} className="shrink-0" />
          로그아웃
        </button>
      </div>
    </div>
  );
}
