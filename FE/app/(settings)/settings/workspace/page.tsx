import { redirect } from "next/navigation";
import { SETTINGS_HOME, settingsRedirect } from "@/data/settings-nav";

export default function WorkspaceIndex() {
  // `??`는 도달하지 않는다 — settingsRedirect가 그룹 경로에 null을 주지 않는 걸
  // data/settings-nav.test.ts가 못 박고 있다. 어설션(!) 대신 폴백을 두는 이유는
  // 내비를 고치다 이 경로가 그룹에서 빠져도 화면이 죽지 않게 하려는 것이다.
  redirect(settingsRedirect("/settings/workspace") ?? SETTINGS_HOME);
}
