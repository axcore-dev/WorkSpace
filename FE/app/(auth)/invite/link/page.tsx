"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthPrimaryButton, AuthSpinner, AuthSplit } from "@/components/auth-shell";
import { ApiRequestError, apiGet, apiPost, apiPostAuthed } from "@/lib/api";
import { setAccessToken } from "@/lib/session";
import { forgetInvite, rememberInvite } from "@/lib/pending-invite";

/**
 * 회사 관리자가 만든 **초대 링크**를 연 사람이 도착하는 화면.
 *
 * `/invite/accept`(이메일 초대)와 다른 점 하나 — 주소에 묶이지 않는다. 링크를 받은 사람 누구든 로그인(또는 가입)한
 * 계정으로 들어간다. 그래서 이메일 고정 상자도, 그 주소용 로그인 폼도 없다. 로그인 전이면 로그인·가입 화면으로 보내고,
 * 끝나면 `pending-invite` 가 여기로 돌려보낸다.
 *
 * 수락은 서버의 단일 트랜잭션이다(토큰 재검증 → 한도 선점 → 구성원 등록). 화면은 그 결과만 받는다.
 */
type Preview = {
  workspaceId: number;
  workspaceName: string;
  roleName: string;
  departmentName: string | null;
  expiresAt: string;
};

type Me = { email: string; emailVerified: boolean };
type Membership = { id: number; enterable: boolean };
type SelectResult = { accessToken?: string | null; accessTokenExpiresAt?: string | null };

type Stage =
  | { kind: "loading" }
  | { kind: "invalid"; message: string }
  /** 로그인 전 */
  | { kind: "anonymous"; preview: Preview }
  /** 로그인은 됐는데 이메일 확인이 남았다 */
  | { kind: "verify"; preview: Preview; email: string }
  | { kind: "ready"; preview: Preview; email: string };

export default function InviteLinkPage() {
  return (
    <Suspense
      fallback={
        <AuthSplit>
          <AuthSpinner label="초대 링크를 확인하고 있어요" />
        </AuthSplit>
      }
    >
      <InviteLink />
    </Suspense>
  );
}

function InviteLink() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  // 토큰이 없으면 물어볼 것도 없다 — 첫 렌더부터 거부 화면이다
  const [stage, setStage] = useState<Stage>(
    token ? { kind: "loading" } : { kind: "invalid", message: "초대 링크가 올바르지 않아요." },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    async function load() {
      let preview: Preview;
      try {
        const p = await apiPost<Preview>("/api/auth/invite-links/preview", { token });
        if (!p) throw new Error("empty");
        preview = p;
        // 로그인·가입·이메일 확인을 거쳐 돌아올 자리를 남긴다
        rememberInvite(token, p.workspaceName, "", "link");
      } catch (e: unknown) {
        if (!alive) return;
        forgetInvite();
        setStage({
          kind: "invalid",
          message: e instanceof ApiRequestError ? e.body.message : "초대 링크를 확인하지 못했어요. 다시 열어 주세요.",
        });
        return;
      }
      let me: Me | null = null;
      try {
        me = await apiGet<Me>("/api/auth/me");
      } catch {
        me = null;
      }
      if (!alive) return;
      if (!me) setStage({ kind: "anonymous", preview });
      else if (!me.emailVerified) setStage({ kind: "verify", preview, email: me.email });
      else setStage({ kind: "ready", preview, email: me.email });
    }
    void load();
    return () => {
      alive = false;
    };
  }, [token]);

  async function accept() {
    setError(null);
    setBusy(true);
    try {
      const membership = await apiPostAuthed<Membership>("/api/auth/invite-links/accept", { token });
      forgetInvite();
      if (membership?.enterable) {
        const result = await apiPostAuthed<SelectResult>(`/api/auth/workspaces/${membership.id}/select`);
        setAccessToken(result?.accessToken ?? null, result?.accessTokenExpiresAt ?? null);
        router.push("/dashboard");
        return;
      }
      router.push("/workspace");
    } catch (e: unknown) {
      setError(e instanceof ApiRequestError ? e.body.message : "수락하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  if (stage.kind === "loading") {
    return (
      <AuthSplit>
        <AuthSpinner label="초대 링크를 확인하고 있어요" />
      </AuthSplit>
    );
  }

  if (stage.kind === "invalid") {
    return (
      <AuthSplit>
        <p className="text-xs font-semibold text-primary-600">초대</p>
        <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
          이 링크는 쓸 수 없어요
        </h2>
        <p className="mt-3 text-[15px] leading-[1.65] text-slate-500">{stage.message}</p>
        <p className="mt-2 text-[15px] leading-[1.65] text-slate-500">
          링크는 정해진 인원까지만 쓸 수 있고 기한이 지나면 만료돼요. 초대한 분에게 새 링크를 요청해 주세요.
        </p>
      </AuthSplit>
    );
  }

  const { preview } = stage;
  const where = preview.departmentName ? `${preview.departmentName} · ${preview.roleName}` : preview.roleName;

  return (
    <AuthSplit>
      <p className="text-xs font-semibold text-primary-600">워크스페이스 초대</p>
      <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
        {preview.workspaceName}
        <br />
        워크스페이스 초대예요
      </h2>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
        <p className="text-xs text-slate-500">들어가면 받는 자리</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{where}</p>
        <p className="mt-1.5 text-xs text-slate-500">권한은 이 직급이 정해요. 들어간 뒤 관리자가 바꿀 수 있어요.</p>
      </div>

      {error && (
        <p className="mt-5 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {stage.kind === "ready" && (
        <div className="mt-7">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{stage.email}</span> 계정으로 들어가요.
          </p>
          <div className="mt-4">
            <AuthPrimaryButton type="button" disabled={busy} onClick={() => void accept()}>
              {busy ? "들어가는 중…" : "초대 수락하고 들어가기"}
            </AuthPrimaryButton>
          </div>
        </div>
      )}

      {stage.kind === "verify" && (
        <div className="mt-7">
          <p className="text-[15px] leading-[1.65] text-slate-500">
            <span className="font-semibold text-slate-800">{stage.email}</span> 의 이메일 확인이 아직이에요. 확인 메일의
            링크를 열면 이 초대로 자동으로 돌아와요.
          </p>
        </div>
      )}

      {stage.kind === "anonymous" && (
        <div className="mt-7">
          <p className="text-sm text-slate-600">로그인하거나 계정을 만들면 이 초대를 수락할 수 있어요. 끝나면 여기로 돌아와요.</p>
          <div className="mt-4 flex flex-col gap-2">
            <AuthPrimaryButton type="button" onClick={() => router.push("/login")}>
              로그인
            </AuthPrimaryButton>
            <button
              type="button"
              onClick={() => router.push("/signup")}
              className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white py-3.5 text-center text-sm font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50"
            >
              계정 만들기
            </button>
          </div>
        </div>
      )}
    </AuthSplit>
  );
}
