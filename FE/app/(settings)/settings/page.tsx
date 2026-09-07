import { redirect } from "next/navigation";
import { SETTINGS_HOME } from "@/data/settings-nav";

export default function SettingsIndex() {
  redirect(SETTINGS_HOME);
}
