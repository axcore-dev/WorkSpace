import { ModuleProvider } from "@/components/module-provider";
import { SettingsShell } from "@/components/settings/settings-shell";

/**
 * `ModuleProvider`로 감싸는 이유: 지금은 `children`을 그대로 반환하는 no-op이고
 * `useModules()`는 모듈 레벨 external store를 써서 프로바이더 없이도 동작한다. 그래도
 * 감싼다 — 그 컴포넌트의 주석이 "향후 컨텍스트 기반 상태로 교체할 수 있도록 경계만 유지"
 * 라고 명시해뒀고, 실제 컨텍스트가 되는 날 설정 그룹만 조용히 깨지는 걸 막는다.
 */
export default function SettingsGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleProvider>
      <SettingsShell>{children}</SettingsShell>
    </ModuleProvider>
  );
}
