"use client";

import { useRouter } from "next/navigation";
import { AuthSplit } from "@/components/auth-shell";
import { DEMO_USER, SUPPORT_EMAIL } from "@/data/org";

/**
 * 개설 대기 안내 — 워크스페이스가 아직 없는 계정이 인증을 마치고 도착하는 화면.
 *
 * 워크스페이스는 계약 시점에 AXCORE 내부 관리자가 개설한다(`/admin`). 고객이 직접 만드는
 * 경로는 없다. 개설되면 이 계정으로 초대 메일이 나가고, 그때부터 /dashboard로 들어간다.
 */
export default function WorkspacePendingPage() {
  const router = useRouter();

  function logout() {
    localStorage.removeItem("axpoint-user");
    router.push("/login");
  }

  return (
    <AuthSplit>
      <p className="text-xs font-semibold text-primary-600">워크스페이스 준비 중</p>
      <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
        워크스페이스를
        <br />
        준비하고 있어요
      </h2>
      <p className="mt-3 text-[15px] leading-[1.65] text-slate-500">
        계약이 확인되면 담당 매니저가 워크스페이스를 개설해요. 준비가 끝나면{" "}
        <span className="font-semibold text-slate-800">{DEMO_USER.email}</span> 주소로 초대 메일을
        보내드려요.
      </p>

      <div
        className="mt-8 flex items-center gap-3.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4"
        role="status"
        aria-live="polite"
      >
        <span className="spinner shrink-0" />
        <span className="text-sm text-slate-600">
          계약 확인 중 · <span className="font-medium text-slate-900">개설 대기</span>
        </span>
      </div>

      <div className="mt-6 space-y-3">
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white py-3.5 text-center text-sm font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50"
        >
          담당 매니저에게 문의하기
        </a>
        <button
          type="button"
          onClick={logout}
          className="w-full cursor-pointer py-1 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
        >
          다른 계정으로 로그인
        </button>
      </div>

      <p className="mt-6 text-[12.5px] leading-[1.6] text-slate-400">
        계약을 마쳤는데도 이 화면이 계속 보이면 담당 매니저에게 알려주세요. 개설 상태를 바로 확인해
        드려요.
      </p>
    </AuthSplit>
  );
}
