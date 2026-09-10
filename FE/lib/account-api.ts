/**
 * 설정 › 계정 화면이 쓰는 API (`/api/auth/**`) 의 클라이언트 절반.
 *
 * `lib/workspace-api.ts` 와 같은 역할이지만 대상이 다르다. 저기는 **지금 고른 회사**의 설정이고,
 * 여기는 회사와 무관한 **내 계정**이다 — 회사를 옮겨도 같은 값이다.
 *
 * 화면이 쓰는 값 중 일부는 회사 쪽에 있다(부서 · 직책). 그건 `useWorkspaceMe()` 가 준다.
 *
 * **여기 없는 것**: 이메일 주소 변경 · 보조 이메일 · 전화번호 · 사번 · 기본 사업장 ·
 * 패스키 · SMS/인증앱 OTP. 서버에 경로가 없다. 화면도 그 자리를 비웠다.
 * 이메일은 없는 게 아니라 **바꾸지 않기로 정한 값**이다 — 로그인 아이디이고, 회사 초대와 담당자
 * 규칙이 그 주소로 사람을 찾는다.
 */
import { apiDelete, apiGet, apiPatch, apiPost, apiPostAuthed, apiUpload } from "./api";

const BASE = "/api/auth";

/** 이 API 들은 204 를 내지 않는다 — null 은 오지 않으므로 타입만 좁힌다 */
const must = <T,>(v: T | null) => v as T;

export type AccountMeDto = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  internalAdmin: boolean;
  /** 비밀번호를 가진 계정인가. 소셜로만 가입했으면 false — 2단계 인증도 켤 수 없다 */
  hasPassword: boolean;
  passwordChangedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

export type SessionDto = {
  id: string;
  userAgent: string | null;
  ip: string | null;
  rememberMe: boolean;
  /** 지금 이 브라우저의 세션인가 */
  current: boolean;
  createdAt: string;
  expiresAt: string;
};

/** 서버가 실제로 처리하는 수단은 `email` 하나다. 나머지 값은 스키마에만 있다 */
export type MfaMethodDto = {
  method: "email" | "sms" | "totp" | "webauthn";
  enabled: boolean;
  verifiedAt: string | null;
};

export type SocialIdentityDto = {
  provider: "google" | "naver";
  email: string | null;
  connectedAt: string;
};

export const getAccountMe = async () => must(await apiGet<AccountMeDto>(`${BASE}/me`));

/** 이름 변경. 바뀐 계정 전체가 돌아온다 */
export const updateAccountName = async (name: string) =>
  must(await apiPatch<AccountMeDto>(`${BASE}/profile`, { name }));

export const getSocialIdentities = async () =>
  (await apiGet<SocialIdentityDto[]>(`${BASE}/identities`)) ?? [];

/**
 * 소셜 연동 해제. 마지막 로그인 수단(비밀번호 없음 + 유일한 연동)이면 서버가 409 로 막는다 —
 * 화면은 그 전에 버튼을 잠그지만, 진짜 문은 서버다.
 */
export const unlinkSocialIdentity = (provider: SocialIdentityDto["provider"]) =>
  apiDelete<void>(`${BASE}/identities/${provider}`);

/**
 * 소셜 연동 추가 — 로그인한 계정에 제공자를 붙인다. 제공자 동의 화면에서 돌아온 code · state 를 그대로 넘긴다.
 * 그 제공자 계정이 다른 사용자에게 이미 붙어 있으면 409 와 그 사실을 담은 문구가 온다.
 */
export const linkSocialIdentity = async (
  provider: SocialIdentityDto["provider"],
  code: string,
  state: string | null,
) => must(await apiPostAuthed<SocialIdentityDto>(`${BASE}/identities/${provider}`, { code, state }));

/* ─────────────────────────────── 세션 ─────────────────────────────── */

export const getSessions = async () => (await apiGet<SessionDto[]>(`${BASE}/sessions`)) ?? [];

export const revokeSession = (id: string) => apiDelete<void>(`${BASE}/sessions/${id}`);

/* ──────────────────────────── 비밀번호 ──────────────────────────── */

/**
 * 비밀번호 변경. **성공하면 모든 세션이 끊긴다** — 지금 이 브라우저도 포함이다.
 * 서버가 refresh 쿠키까지 지우므로 호출한 쪽은 로그아웃 화면으로 보내야 한다.
 */
export const changePassword = (currentPassword: string, newPassword: string) =>
  apiPostAuthed<void>(`${BASE}/password`, { currentPassword, newPassword });

/* ────────────────────────── 2단계 인증 ────────────────────────── */

export const getMfaMethods = async () => (await apiGet<MfaMethodDto[]>(`${BASE}/mfa/methods`)) ?? [];

/** 등록 시작 — 코드를 메일로 보내고 챌린지 토큰을 돌려준다. 아직 켜지지 않는다 */
export const startEmailMfa = async () =>
  must(await apiPostAuthed<{ mfaToken: string }>(`${BASE}/mfa/email`));

/** 코드가 맞으면 그때 켜진다 */
export const confirmEmailMfa = (mfaToken: string, code: string) =>
  apiPostAuthed<void>(`${BASE}/mfa/email/confirm`, { mfaToken, code });

/**
 * 2단계 끄기. 비밀번호를 다시 묻는다 — access 토큰만 쥔 쪽이 방어를 걷어내지 못하게.
 * 여기서도 모든 세션이 끊긴다.
 */
export const disableEmailMfa = (password: string) =>
  apiDelete<void>(`${BASE}/mfa/email`, { password });

/* ──────────────────────────── 이메일 확인 ──────────────────────────── */

/** 대표 주소로 확인 메일을 다시 보낸다 */
export const resendVerificationEmail = () => apiPostAuthed<void>(`${BASE}/email/verify-request`);

/* ────────────────────────── 프로필 사진 ────────────────────────── */

/**
 * 사진을 올린다. **화면에서 미리 줄여서 보낸다** — 서버에서 줄이려면 이미지 라이브러리가 하나 더
 * 필요하고, 원본 사진은 대개 몇 MB 라 그대로 보내면 상한(2MB)에 걸린다.
 *
 * 응답은 바뀐 계정 전체다. `avatarUrl` 은 서버가 정한 주소이고, 사진을 바꾸면 주소도 바뀐다.
 */
export async function uploadProfilePhoto(file: Blob): Promise<AccountMeDto> {
  const body = new FormData();
  body.append("file", file, "photo");
  return must(await apiUpload<AccountMeDto>(`${BASE}/profile/photo`, body));
}

/** 올린 사진을 지운다. 소셜 사진이 있으면 그쪽으로 되돌아간다 */
export const deleteProfilePhoto = async () =>
  must(await apiDelete<AccountMeDto>(`${BASE}/profile/photo`));

/**
 * 소셜로만 가입한 계정이 비밀번호를 만든다.
 *
 * 지금 로그인해 있어도 그 자리에서 바로 정하게 하지 않는다. access 토큰만 쥔 쪽이 비밀번호를
 * 심어 계정을 통째로 가져가는 것을 막아야 하는데, 대조할 옛 비밀번호가 없으니 남은 증거는
 * **메일함을 열 수 있는가** 하나다. 그래서 재설정 메일과 같은 링크를 보낸다 — 그 링크가 비밀번호를
 * 정하고, 이메일 확인까지 끝내고, 모든 기기를 로그아웃시킨다.
 */
export const requestPasswordSetup = (email: string) =>
  apiPost<void>("/api/auth/password/reset-request", { email });
