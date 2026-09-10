import { SettingsShell } from "@/components/settings/settings-shell";

export default function SettingsGroupLayout({ children }: { children: React.ReactNode }) {
  return <SettingsShell>{children}</SettingsShell>;
}
