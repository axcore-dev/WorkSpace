import { redirect } from "next/navigation";

/**
 * 대시보드(「지금 손볼 것」 큐)는 수정요청v10 ①에서 삭제했다 — 지금 단계에서는 무의미했다.
 * 주소는 남긴다: 로그인 성공이 `/admin`으로 보내고(`app/(auth)/login/page.tsx`),
 * 기존 북마크도 여기로 온다. 나중에 대시보드를 되살릴 때 이 자리를 도로 쓴다.
 */
export default function AdminHomePage() {
  redirect("/admin/workspaces");
}
