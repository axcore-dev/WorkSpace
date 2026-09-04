"use client";

import { useRouter } from "next/navigation";
import { endSession } from "@/components/use-logout";
import { Button } from "@/components/ui";

/**
 * 운영자 콘솔 진입 거부 화면.
 *
 * 운영자가 아닌 계정이나 로그인하지 않은 사람이 `/admin/**` 를 직접 열었을 때 보인다.
 * 운영 메뉴·레이아웃은 그리지 않는다 — 어떤 메뉴가 있는지조차 보여 줄 이유가 없다.
 *
 * - `forbidden`: 로그인은 됐지만 운영자가 아니다. 자기 워크스페이스로 돌아가거나, 운영자 계정으로
 *   바꿔 로그인할 수 있게 한다(계정 전환은 지금 세션을 끝내야 한다 — 그냥 /login 으로 보내면 refresh
 *   쿠키가 살아 있어 같은 계정으로 다시 들어온다).
 * - `unauthenticated`: 로그인부터.
 * - `error`: 서버에 닿지 못했다. 권한 판정을 못 했으니 열어 주지 않고 다시 시도만 안내한다.
 */
export function AccessDenied({
  reason,
  message,
}: {
  reason: "forbidden" | "unauthenticated" | "error";
  message?: string;
}) {
  const router = useRouter();

  async function switchAccount() {
    await endSession();
    router.replace("/login");
  }

  const title = reason === "error" ? "확인할 수 없는 경로입니다" : "접근할 수 없는 경로입니다";
  const desc =
    reason === "forbidden"
      ? "권한이 없는 사용자입니다. 이 화면은 AXCORE 운영자 계정만 열 수 있어요."
      : reason === "unauthenticated"
        ? "로그인이 필요한 화면입니다. 운영자 계정으로 로그인해 주세요."
        : (message ?? "잠시 후 다시 시도해 주세요.");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
        <p className="text-xs font-semibold tracking-wide text-slate-400">403</p>
        <h1 className="mt-2 text-xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{desc}</p>

        <div className="mt-7 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
          {reason === "forbidden" && (
            <>
              <Button href="/workspace">내 워크스페이스로</Button>
              <Button variant="secondary" onClick={() => void switchAccount()}>
                다른 계정으로 로그인
              </Button>
            </>
          )}
          {reason === "unauthenticated" && <Button href="/login">로그인</Button>}
          {reason === "error" && (
            <Button variant="secondary" onClick={() => router.refresh()}>
              다시 시도
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
