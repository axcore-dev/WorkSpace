"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthSplit } from "@/components/auth-shell";
import { useLogout } from "@/components/use-logout";
import { SUPPORT_EMAIL } from "@/data/org";
import { ApiRequestError, apiGet, apiPostAuthed } from "@/lib/api";
import { setAccessToken } from "@/lib/session";
import { readInvite, type PendingInvite } from "@/lib/pending-invite";

/**
 * 로그인 뒤 어디로 들어갈지 정하는 화면.
 *
 * 한 사람이 여러 회사에 속할 수 있어서(컨설턴트·그룹사) 로그인만으로는 어느 회사인지 정해지지
 * 않는다. BE 는 이 단계를 `next=SELECT_WORKSPACE` 로 알려 주고, 고른 회사는 세션에 남아
 * 이후 토큰의 `wsid` 클레임이 된다.
 *
 * 소속이 하나도 없으면 개설 대기 안내를 그대로 보여 준다. 워크스페이스는 계약 시점에 AXCORE
 * 내부 관리자가 개설하고(`/admin`), 고객이 직접 만드는 경로는 없다. 두 경우가 사실은 같은
 * 질문("지금 들어갈 회사가 있는가")이라 주소를 나누지 않았다 — 나누면 어느 쪽으로 보낼지를
 * 판단하려고 목록을 먼저 불러야 하고, 그 판단이 두 곳에 생긴다.
 */

type Membership = {
  id: number;
  name: string;
  plan: string;
  workspaceStatus: string;
  membershipStatus: string;
  /** 소속과 회사가 둘 다 살아 있을 때만 true. 화면은 이 값만 보면 된다 */
  enterable: boolean;
};

type SelectResult = {
  next: string;
  accessToken?: string | null;
  accessTokenExpiresAt?: string | null;
};

/** 들어갈 수 없는 이유 — 사용자가 누구에게 문의해야 하는지가 달라진다 */
function blockedReason(m: Membership): string {
  if (m.membershipStatus === "invited") return "초대 수락이 필요해요";
  if (m.membershipStatus !== "active") return "이 회사에 대한 접근 권한이 없어요";
  if (m.workspaceStatus === "pending") return "개설 준비 중이에요";
  if (m.workspaceStatus === "suspended") return "지금 이용할 수 없어요";
  return "들어갈 수 없어요";
}

export default function WorkspaceSelectPage() {
  const router = useRouter();

  const [list, setList] = useState<Membership[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 어느 회사를 누르는 중인지 — 버튼 여러 개가 동시에 도는 것을 막는다 */
  const [entering, setEntering] = useState<number | null>(null);
  /**
   * 진행하다 만 초대.
   *
   * 소속이 아직 없는 사람이 여기로 오면 "개설 대기" 안내가 뜨는데, 실은 수락만 남은
   * 초대를 들고 있을 수 있다. 그 경우 기다리라고 하는 것은 틀린 안내다.
   */
  const [pending, setPending] = useState<PendingInvite | null>(null);

  useEffect(() => {
    let alive = true;
    apiGet<Membership[]>("/api/auth/workspaces")
      .then((rows) => {
        if (!alive) return;
        setList(rows ?? []);
        // localStorage 는 서버 렌더에서 못 읽는다. 응답을 받은 뒤(=브라우저)에 함께 채운다.
        setPending(readInvite());
      })
      .catch((e: unknown) => {
        if (!alive) return;
        // 401 이면 세션이 끊긴 것이다. 빈 목록으로 보여 주면 "회사가 없다" 는 거짓말이 된다.
        if (e instanceof ApiRequestError && e.status === 401) {
          router.push("/login");
          return;
        }
        setError("회사 목록을 불러오지 못했어요.");
        setList([]);
      });
    return () => {
      alive = false;
    };
  }, [router]);

  async function enter(m: Membership) {
    setError(null);
    setEntering(m.id);
    try {
      // 고른 회사가 담긴 새 access 토큰을 받는다. 갈아 끼우지 않으면 이후 요청이 여전히
      // 회사 없는 토큰으로 나간다.
      const result = await apiPostAuthed<SelectResult>(`/api/auth/workspaces/${m.id}/select`);
      setAccessToken(result?.accessToken ?? null, result?.accessTokenExpiresAt ?? null);
      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof ApiRequestError ? e.body.message : "회사에 들어가지 못했어요.");
    } finally {
      setEntering(null);
    }
  }

  const logout = useLogout();

  /* ── 불러오는 중 ── */
  if (list === null) {
    return (
      <AuthSplit>
        <div className="flex items-center gap-3.5" role="status" aria-live="polite">
          <span className="spinner shrink-0" />
          <span className="text-sm text-slate-600">소속 회사를 확인하고 있어요</span>
        </div>
      </AuthSplit>
    );
  }

  /* ── 소속이 없다 — 개설 대기 안내 (기존 화면 그대로) ── */
  if (list.length === 0) {
    return (
      <AuthSplit>
        <p className="text-xs font-semibold text-primary-600">워크스페이스 준비 중</p>
        <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
          워크스페이스를
          <br />
          준비하고 있어요
        </h2>
        <p className="mt-3 text-[15px] leading-[1.65] text-slate-500">
          계약이 확인되면 담당 매니저가 워크스페이스를 개설해요. 준비가 끝나면 접속 링크를
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

        {pending && (
          <a
            href={`/invite/accept?token=${encodeURIComponent(pending.token)}`}
            className="mt-6 block rounded-xl border border-primary-200 bg-primary-50 px-4 py-4 transition-colors hover:border-primary-300"
          >
            <p className="text-sm font-semibold text-slate-900">
              {pending.workspaceName} 초대가 남아 있어요
            </p>
            <p className="mt-1 text-xs text-slate-600">이어서 수락하기</p>
          </a>
        )}

        <div className="mt-6 space-y-3">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white py-3.5 text-center text-sm font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50"
          >
            담당 매니저에게 문의하기
          </a>
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full cursor-pointer py-1 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
          >
            다른 계정으로 로그인
          </button>
        </div>

        <p className="mt-6 text-[12.5px] leading-[1.6] text-slate-400">
          계약을 마쳤는데도 이 화면이 계속 보이면 담당 매니저에게 알려주세요. 개설 상태를 바로
          확인해 드려요.
        </p>
      </AuthSplit>
    );
  }

  /* ── 고를 회사가 있다 ── */
  return (
    <AuthSplit>
      <p className="text-xs font-semibold text-primary-600">회사 선택</p>
      <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
        어느 회사로
        <br />
        들어갈까요?
      </h2>
      <p className="mt-3 text-[15px] leading-[1.65] text-slate-500">
        고른 회사의 데이터만 보여요. 들어간 뒤에도 언제든 바꿀 수 있어요.
      </p>

      {error && (
        <p className="mt-5 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <ul className="mt-8 space-y-2.5">
        {list.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              disabled={!m.enterable || entering !== null}
              onClick={() => void enter(m)}
              className={`flex w-full items-center gap-4 rounded-xl border px-4 py-4 text-left transition-colors ${
                m.enterable
                  ? "cursor-pointer border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50"
                  : "cursor-not-allowed border-slate-200 bg-slate-50"
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                  m.enterable ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-400"
                }`}
                aria-hidden
              >
                {m.name.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-sm font-semibold ${
                    m.enterable ? "text-slate-900" : "text-slate-400"
                  }`}
                >
                  {m.name}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {m.enterable ? m.plan : blockedReason(m)}
                </span>
              </span>
              {entering === m.id && <span className="spinner shrink-0" />}
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => void logout()}
        className="mt-7 w-full cursor-pointer py-1 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
      >
        다른 계정으로 로그인
      </button>
    </AuthSplit>
  );
}
