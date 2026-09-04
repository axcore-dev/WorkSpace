import { redirect } from "next/navigation";
import { SETTINGS_HOME, settingsRedirect } from "@/data/settings-nav";

export default function AdminIndex() {
  redirect(settingsRedirect("/settings/admin") ?? SETTINGS_HOME);
}
