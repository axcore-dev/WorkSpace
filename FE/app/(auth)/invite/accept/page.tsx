"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthPrimaryButton, AuthSplit } from "@/components/auth-shell";
import { FIELD_LG } from "@/components/ui";
import { ApiRequestError, apiGet, apiPost, apiPostAuthed } from "@/lib/api";
import { clearSession, setAccessToken } from "@/lib/session";
import { forgetInvite, rememberInvite } from "@/lib/pending-invite";

/**
 * 초대 링크를 연 사람이 도착하는 화면.
 *
 * 링크 하나가 두 사람을 상대한다 — 이미 계정이 있는 사람과 없는 사람. 어느 쪽인지 미리 알 수
 * 없어서 화면 안에서 갈린다.
 *
 * <p><b>이메일은 고정이다.</b> 초대는 사용자가 아니라 주소에 매달려 있고, 그 주소의 주인만
 * 수락할 수 있다. 입력 칸으로 열어 두면 링크를 받은 사람이 다른 주소로 바꿔 들어올 수 있다고
 * 오해하게 되는데, 서버는 어차피 거절한다. 처음부터 바꿀 수 없게 보여 주는 편이 정직하다.
 *
 * <p>수락 자체는 서버의 단일 트랜잭션이다(토큰 재검증 → 이메일 일치 → 구성원 등록 → 토큰
 * 소멸). 화면은 그 결과만 받는다.
 */

type Preview = {
  workspaceId: number;
  workspaceName: string;
  email: string;
  expiresAt: string;
};

type Me = { email: string; emailVerified: boolean };

type Membership = { id: number; enterable: boolean };

type SelectResult = { accessToken?: string | null; accessTokenExpiresAt?: string | null };

/** 화면이 서 있는 자리. 링크 상태와 로그인 상태의 조합이라 한 값으로 모은다 */
type Stage =
  | { kind: "loading" }
  /** 토큰이 없거나 만료·사용됨 */
  | { kind: "invalid"; message: string }
  /** 로그인돼 있고 초대 주소와 같다 — 바로 수락할 수 있다 */
  | { kind: "ready"; preview: Preview }
  /** 로그인돼 있는데 다른 계정이다 */
  | { kind: "mismatch"; preview: Preview; current: string }
  /** 로그인 전 */
  | { kind: "anonymous"; preview: Preview }
  /** 가입은 끝났고 이메일 확인이 남았다 */
  | { kind: "verify"; preview: Preview };

export default function InviteAcceptPage() {
  return (
    <Suspense fallback={<AuthSplit><Spinner label="초대를 확인하고 있어요" /></AuthSplit>}>
      <InviteAccept />
    </Suspense>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3.5" role="status" aria-live="polite">
      <span className="spinner shrink-0" />
      <span className="text-sm text-slate-600">{label}</span>
    </div>
  );
}

function InviteAccept() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── 링크 확인 + 지금 누구인지 ── */
  useEffect(() => {
    let alive = true;

    async function load() {
      if (!token) {
        if (alive) setStage({ kind: "invalid", message: "초대 링크가 올바르지 않아요." });
        return;
      }
      let preview: Preview;
      try {
        // 링크를 연 시각도 여기서 기록된다. 운영자 화면이 "보냈는데 열지 않았다" 를 가려낸다.
        const p = await apiPost<Preview>("/api/auth/invitations/preview", { token });
        if (!p) throw new Error("empty");
        preview = p;
        // 가입 → 메일 확인 사이에 탭이 바뀌어도 돌아올 수 있게 남겨 둔다.
        rememberInvite(token, p.workspaceName, p.email);
      } catch (e: unknown) {
        if (!alive) return;
        // 못 쓰는 링크를 계속 들고 있을 이유가 없다.
        forgetInvite();
        setStage({
          kind: "invalid",
          message:
            e instanceof ApiRequestError
              ? e.body.message
              : "초대를 확인하지 못했어요. 링크를 다시 열어 주세요.",
        });
        return;
      }

      // 로그인돼 있는지는 물어봐야 안다. refresh 쿠키가 살아 있으면 여기서 살아난다.
      let me: Me | null = null;
      try {
        me = await apiGet<Me>("/api/auth/me");
      } catch {
        me = null;
      }
      if (!alive) return;

      if (!me) {
        setStage({ kind: "anonymous", preview });
      } else if (me.email.toLowerCase() !== preview.email.toLowerCase()) {
        setStage({ kind: "mismatch", preview, current: me.email });
      } else if (!me.emailVerified) {
        // 로그인은 됐는데 주소 확인이 안 끝났다. 서버가 수락을 거절하므로 버튼을 주면 안 된다.
        setStage({ kind: "verify", preview });
      } else {
        setStage({ kind: "ready", preview });
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, [token]);

  /* ── 수락 → 그 회사로 진입 ── */
  async function accept() {
    setError(null);
    setBusy(true);
    try {
      const membership = await apiPostAuthed<Membership>("/api/auth/invitations/accept", { token });
      forgetInvite();

      // 수락했다고 바로 들어가지는 않는다. 어느 회사인지는 세션에 따로 새겨야 한다.
      if (membership?.enterable) {
        const result = await apiPostAuthed<SelectResult>(
          `/api/auth/workspaces/${membership.id}/select`,
        );
        setAccessToken(result?.accessToken ?? null, result?.accessTokenExpiresAt ?? null);
        router.push("/dashboard");
        return;
      }
      // 회사가 아직 열리지 않았거나 중지된 경우. 소속은 생겼으니 목록에서 상태를 보여 준다.
      router.push("/workspace");
    } catch (e: unknown) {
      setError(e instanceof ApiRequestError ? e.body.message : "수락하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  /* ── 이미 계정이 있는 사람 ── */
  async function signIn(preview: Preview) {
    setError(null);
    setBusy(true);
    try {
      const r = await apiPost<{ accessToken?: string | null; accessTokenExpiresAt?: string | null }>(
        "/api/auth/login",
        { email: preview.email, password, rememberMe: true },
      );
      setAccessToken(r?.accessToken ?? null, r?.accessTokenExpiresAt ?? null);
      await accept();
    } catch (e: unknown) {
      setError(e instanceof ApiRequestError ? e.body.message : "로그인하지 못했어요.");
      setBusy(false);
    }
  }

  /* ── 계정이 없는 사람 ── */
  async function signUp(preview: Preview) {
    setError(null);
    setBusy(true);
    try {
      await apiPost("/api/auth/signup", { email: preview.email, password, name: name.trim() });

      // 서버는 확인되지 않은 주소로 회사에 들어오는 것을 막는다. 그래서 여기서 수락까지
      // 가지 않고 메일을 열고 오라고 안내한다.
      //
      // 다만 로그인은 지금 해 둔다. 방금 만든 비밀번호를 알고 있는 것은 이 화면뿐이라,
      // 확인을 마치고 돌아왔을 때 다시 묻지 않으려면 지금이 유일한 기회다.
      try {
        const r = await apiPost<{
          accessToken?: string | null;
          accessTokenExpiresAt?: string | null;
        }>("/api/auth/login", { email: preview.email, password, rememberMe: true });
        setAccessToken(r?.accessToken ?? null, r?.accessTokenExpiresAt ?? null);
      } catch {
        // 로그인이 안 돼도 확인 안내는 그대로 보여 준다. 돌아왔을 때 비밀번호를 한 번 더
        // 물을 뿐이다.
      }
      setStage({ kind: "verify", preview });
    } catch (e: unknown) {
      setError(e instanceof ApiRequestError ? e.body.message : "가입하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  function switchAccount() {
    clearSession();
    localStorage.removeItem("axpoint-user");
    setStage({ kind: "loading" });
    // 로그아웃은 쿠키까지 지워야 한다. 안 지우면 /api/auth/me 가 다시 살아난다.
    void apiPost("/api/auth/logout").finally(() => window.location.reload());
  }

  /* ────────────────────────── 렌더 ────────────────────────── */

  if (stage.kind === "loading") {
    return (
      <AuthSplit>
        <Spinner label="초대를 확인하고 있어요" />
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
          링크는 한 번만 쓸 수 있고 기한이 지나면 만료돼요. 담당 매니저에게 새 링크를 요청해
          주세요.
        </p>
      </AuthSplit>
    );
  }

  const { preview } = stage;

  return (
    <AuthSplit>
      <p className="text-xs font-semibold text-primary-600">워크스페이스 초대</p>
      <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
        {preview.workspaceName}
        <br />
        워크스페이스 초대예요
      </h2>

      {/* 이메일 고정 표시 — 이 주소의 계정만 수락할 수 있다 */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
        <p className="text-xs text-slate-500">초대받은 이메일</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{preview.email}</p>
        <p className="mt-1.5 text-xs text-slate-500">
          이 주소로 만든 계정만 수락할 수 있어요. 주소는 바꿀 수 없어요.
        </p>
      </div>

      {error && (
        <p className="mt-5 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {/* ── 바로 수락 ── */}
      {stage.kind === "ready" && (
        <div className="mt-7">
          <AuthPrimaryButton type="button" disabled={busy} onClick={() => void accept()}>
            {busy ? "들어가는 중…" : "초대 수락하고 들어가기"}
          </AuthPrimaryButton>
        </div>
      )}

      {/* ── 다른 계정으로 로그인돼 있다 ── */}
      {stage.kind === "mismatch" && (
        <div className="mt-7">
          <p className="text-sm text-slate-600">
            지금은 <span className="font-semibold text-slate-900">{stage.current}</span> 로
            로그인돼 있어요. 초대받은 주소와 달라서 수락할 수 없어요.
          </p>
          <button
            type="button"
            onClick={switchAccount}
            className="mt-5 w-full cursor-pointer rounded-lg border border-slate-300 bg-white py-3.5 text-center text-sm font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50"
          >
            로그아웃하고 {preview.email} 로 진행하기
          </button>
        </div>
      )}

      {/* ── 가입은 했고 메일 확인이 남았다 ── */}
      {stage.kind === "verify" && (
        <div className="mt-7">
          <div className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white px-4 py-4">
            <span className="spinner shrink-0" />
            <span className="text-sm text-slate-600">이메일 확인을 기다리고 있어요</span>
          </div>
          <p className="mt-4 text-[15px] leading-[1.65] text-slate-500">
            <span className="font-semibold text-slate-800">{preview.email}</span> 로 보낸 확인
            메일의 링크를 열어 주세요. 확인이 끝나면 이 초대로 <b>자동으로 돌아와요</b> — 링크를
            다시 찾지 않아도 돼요.
          </p>
          <p className="mt-2 text-[12.5px] leading-[1.6] text-slate-400">
            다른 기기에서 메일을 열었다면, 확인을 마친 뒤 이 초대 링크를 한 번 더 열어 주세요.
          </p>
        </div>
      )}

      {/* ── 로그인 전 ── */}
      {stage.kind === "anonymous" && (
        <>
          <div className="mt-7 flex gap-1 border-b border-slate-200" role="tablist">
            {(
              [
                ["signin", "이미 계정이 있어요"],
                ["signup", "계정 만들기"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mode === key}
                onClick={() => {
                  setMode(key);
                  setError(null);
                }}
                className={`-mb-px cursor-pointer border-b-2 px-3.5 py-2.5 text-sm transition-colors ${
                  mode === key
                    ? "border-slate-800 font-semibold text-slate-900"
                    : "border-transparent font-medium text-slate-500 hover:text-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form
            className="mt-6 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              void (mode === "signin" ? signIn(preview) : signUp(preview));
            }}
          >
            {mode === "signup" && (
              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-medium text-slate-700">
                  이름
                </label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className={FIELD_LG}
                />
              </div>
            )}

            <div>
              <label htmlFor="pw" className="mb-2 block text-sm font-medium text-slate-700">
                비밀번호
              </label>
              <input
                id="pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                className={FIELD_LG}
              />
              {mode === "signup" && (
                <p className="mt-1.5 text-xs text-slate-500">
                  영문·숫자·특수문자를 모두 넣어 8~16자로 만들어 주세요.
                </p>
              )}
            </div>

            <AuthPrimaryButton disabled={busy}>
              {busy
                ? "진행 중…"
                : mode === "signin"
                  ? "로그인하고 수락하기"
                  : "가입하고 계속하기"}
            </AuthPrimaryButton>
          </form>
        </>
      )}
    </AuthSplit>
  );
}
