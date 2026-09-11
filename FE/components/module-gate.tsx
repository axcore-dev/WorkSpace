"use client";

import { IconLock } from "@/components/icons";
import { Button } from "@/components/ui";
import type { ModuleDef } from "@/data/types";
import { useWorkspaceMe } from "@/lib/workspace-me";

/**
 * 이 기능을 볼 자격이 있는지 보고 없으면 안내만 그린다.
 *
 * 자격은 서버가 계산한 {@code me.modules} 다 — 회사가 켠 기능 ∩ 내 직급이 가진 탭 ∩ 내 개별 권한
 * ({@code ModuleAccessReader}). 사이드바도 같은 값으로 그리므로 여기까지 온 사람은 주소를 직접 쳤거나
 * 옛 링크를 열었다.
 *
 * <b>보안 경계가 아니다.</b> 이 문을 지나도 데이터는 BE 가 403 으로 막는다. 여기서 막는 이유는 권한이 없는
 * 사람에게 "불러오지 못했어요" 같은 빨간 오류 대신 왜 못 보는지를 알려 주기 위해서다.
 *
 * 받기 전(`idle`·`loading`)에는 아무것도 그리지 않는다 — 잠긴 것처럼도, 열린 것처럼도 그리지 않는다.
 */
export function ModuleGate({ mod, children }: { mod: ModuleDef; children: React.ReactNode }) {
  const { me, status } = useWorkspaceMe();

  if (status === "idle" || status === "loading") return null;
  if (status === "ready" && me && !me.modules.includes(mod.slug)) {
    return (
      <>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{mod.name}</h1>
        <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-slate-300 px-6 py-14 text-center">
          <IconLock size={26} className="text-slate-400" />
          <p className="mt-3 text-sm font-semibold text-slate-900">이 기능을 볼 권한이 없어요</p>
          <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-slate-500">
            {mod.name}은(는) 지금 직급({me.member.roleName})에 열려 있지 않아요. 필요하면 회사 소유자에게 요청해 주세요.
          </p>
          <Button variant="secondary" size="sm" className="mt-5" href="/dashboard">
            주요 정보로 가기
          </Button>
        </div>
      </>
    );
  }
  return <>{children}</>;
}
