/**
 * 진행 중인 초대를 브라우저에 기억해 둔다.
 *
 * 초대 링크로 들어온 사람이 가입까지 했는데, 서버는 이메일이 확인되기 전에는 회사에 넣어 주지
 * 않는다. 확인은 메일의 링크를 눌러야 끝나고, 그 링크는 보통 **새 탭**에서 열린다. 그 탭에는
 * 초대 토큰이 없어서, 확인을 마쳐도 "그래서 어느 회사였지" 로 끊긴다.
 *
 * 그래서 초대 링크를 연 시점에 토큰을 남겨 둔다. 확인이 끝난 탭이 이 값을 보고 원래 자리로
 * 돌려보낸다.
 *
 * <p>`sessionStorage` 가 아니라 `localStorage` 인 이유가 이것이다. 세션 저장소는 탭 단위라
 * 메일에서 열린 새 탭에서는 비어 있다.
 *
 * <p>담기는 것은 초대 토큰뿐이고, 이 토큰만으로는 아무것도 못 한다 — 서버가 초대 주소와
 * 로그인한 계정이 같은지 다시 본다. 그래도 남겨 둘 이유가 사라지면 바로 지운다(수락 성공,
 * 만료, 무효한 링크).
 */

const KEY = "axpoint-pending-invite";

/**
 * 보관 기한.
 *
 * 초대 자체는 7일이지만 이 기록은 더 짧게 잡는다. "가입하고 메일을 확인하러 가는" 사이를
 * 잇는 값이라 하루면 충분하고, 오래 남을수록 남의 PC 에 방치될 여지만 커진다.
 */
const TTL_MS = 24 * 60 * 60 * 1000;

export type PendingInvite = {
  token: string;
  /** 안내 문구에 쓴다. 서버 응답을 다시 받기 전까지 회사 이름을 보여 줄 수 있다 */
  workspaceName: string;
  email: string;
  savedAt: number;
};

export function rememberInvite(token: string, workspaceName: string, email: string) {
  try {
    const value: PendingInvite = { token, workspaceName, email, savedAt: Date.now() };
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
