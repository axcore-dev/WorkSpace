import { AppShell } from "@/components/app-shell";
import { ModuleProvider } from "@/components/module-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleProvider>
      <AppShell>{children}</AppShell>
    </ModuleProvider>
  );
}
