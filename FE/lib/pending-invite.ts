/**
 * 진행 중인 초대 — 가입·이메일 확인·소셜 로그인으로 화면을 떠나도 돌아올 수 있게 브라우저에 남긴다.
 *
 * `sessionStorage` 가 아니라 `localStorage` 인 이유가 이것이다. 세션 저장소는 탭 단위라 메일 링크가 새 탭에서 열리면
 * 비어 있다. 24시간이 지나면 버린다 — 링크 자체의 수명(7일)보다 짧지만, 가입 흐름이 하루를 넘기면 사람이 링크를 다시 연다.
 *
 * `kind` 로 두 종류를 가른다. `email` 은 운영자·관리자가 주소로 보낸 초대(`/invite/accept`, 주소 고정),
 * `link` 는 관리자가 만든 누구나 쓰는 링크(`/invite/link`). 돌아갈 화면이 다르다 — `inviteHref()` 가 정한다.
 */
const KEY = "axpoint-pending-invite";

const TTL_MS = 24 * 60 * 60 * 1000;

export type PendingInvite = {
  token: string;
  workspaceName: string;
  /** 이메일 초대만 있다. 링크 초대는 주소에 묶이지 않는다 */
  email: string;
  kind?: "email" | "link";
  savedAt: number;
};

export function rememberInvite(
  token: string,
  workspaceName: string,
  email: string,
  kind: "email" | "link" = "email",
) {
  try {
    const value: PendingInvite = { token, workspaceName, email, kind, savedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // 시크릿 모드·저장 공간 부족. 기억하지 못할 뿐 흐름 자체는 막히지 않는다 —
    // 사용자가 초대 링크를 다시 열면 된다.
  }
}

export function readInvite(): PendingInvite | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;

    const v = JSON.parse(raw) as PendingInvite;
    if (typeof v?.token !== "string" || typeof v?.savedAt !== "number") return null;

    if (Date.now() - v.savedAt > TTL_MS) {
      forgetInvite();
      return null;
    }
    return v;
  } catch {
    return null;
  }
}

export function forgetInvite() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 지우지 못해도 만료로 걸러진다
  }
}

/** 이 초대로 돌아갈 화면 주소 */
export function inviteHref(invite: PendingInvite): string {
  const path = invite.kind === "link" ? "/invite/link" : "/invite/accept";
  return `${path}?token=${encodeURIComponent(invite.token)}`;
}
