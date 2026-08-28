import { redirect } from "next/navigation";

// 데모: demo@axcore.it.kr 계정으로 자동 로그인된 상태를 가정하고 워크스페이스로 바로 진입
export default function Home() {
  redirect("/login");
}
