/**
 * 소셜 로그인 시작 — 제공자로 보내는 쪽.
 *
 * 코드를 받는 것은 BE 가 아니라 이 앱이다. 제공자가 `/oauth/callback/<provider>` 로 되돌려 주고,
 * 그 화면이 code 를 BE 에 넘긴다. 그래서 client secret 은 이 파일에 없다 — 있으면 브라우저에
 * 내려가고, secret 이 노출되면 누구든 임의의 code 를 토큰으로 바꿀 수 있다.
 *
 * client id 는 반대로 공개돼도 되는 값이다. 제공자 콘솔에 등록된 redirect_uri 로만 흐름이
 * 성립하므로 id 만으로는 아무것도 할 수 없다. 그래서 `NEXT_PUBLIC_` 접두어를 붙인다.
 */

export type SocialProvider = "google" | "naver";

type ProviderConfig = {
  /** 제공자의 인증 화면 주소 */
  authorizeUrl: string;
  clientId: string | undefined;
  /** 요청할 권한. 로그인에 필요한 최소만 담는다 */
  scope: string;
  /** 제공자별 추가 파라미터 */
  extraParams?: Record<string, string>;
};

const PROVIDERS: Record<SocialProvider, ProviderConfig> = {
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    // 캘린더·드라이브 권한을 함께 요구하지 않는다. 로그인 한 번에 광범위한 권한을 묶어 받으면
    // 사용자가 동의 화면에서 이탈하고, 연동이 필요해지는 시점에 따로 받는 편이 맞다.
    scope: "openid email profile",
    extraParams: {
      // 사용자가 여러 Google 계정을 쓰는 경우 어느 계정으로 들어갈지 고를 수 있게 한다.
      // 없으면 브라우저에 남은 계정으로 조용히 로그인돼, 의도와 다른 계정이 붙는다.
      prompt: "select_account",
      // refresh 토큰을 받지 않는다. 우리는 "이 사람이 누구인가"만 필요하고 제공자 자원에
      // 접근하지 않는다. 받지 않으면 저장할 것도, 유출될 것도 없다.
      access_type: "online",
    },
  },
  naver: {
    // 네이버는 다음 작업에서 붙인다. 자리만 둔다.
    authorizeUrl: "https://nid.naver.com/oauth2.0/authorize",
    clientId: process.env.NEXT_PUBLIC_NAVER_CLIENT_ID,
    scope: "",
  },
};

/** sessionStorage 키. 탭을 닫으면 사라지고 다른 사이트가 읽을 수 없다. */
const stateKey = (provider: SocialProvider) => `axpoint-oauth-state:${provider}`;

/**
 * 제공자 콘솔에 등록해야 하는 값과 같아야 한다.
 *
 * 현재 주소에서 만든다. 환경변수로 또 받으면 배포마다 두 곳(제공자 콘솔, FE 환경변수)이 아니라
 * 세 곳이 어긋날 수 있다. 단 BE 의 `app.oauth.providers.*.redirect-uri` 와도 같아야 한다 —
 * 제공자가 code 를 교환할 때 두 값을 대조한다.
 */
export function redirectUri(provider: SocialProvider): string {
  return `${window.location.origin}/oauth/callback/${provider}`;
}

/**
 * CSRF 방어용 난수.
 *
 * 이것이 막는 공격은 이렇다 — 공격자가 자기 계정의 code 를 담은 콜백 주소로 피해자를 유도하면,
 * 피해자의 브라우저가 공격자 계정으로 로그인된다. 이후 피해자가 올리는 자료는 공격자가 보게 된다.
 *
 * 시작할 때 만든 값을 sessionStorage 에 넣고 돌아온 값과 비교한다. 공격자는 피해자의
 * sessionStorage 에 쓸 수 없으므로 값을 맞출 수 없다. BE 가 아니라 여기서 검증하는 이유는
 * 로그인 전이라 서버에 이 브라우저를 식별할 세션이 없기 때문이다.
 */
function issueState(provider: SocialProvider): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const state = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  sessionStorage.setItem(stateKey(provider), state);
  return state;
}

/**
 * 돌아온 state 를 검증하고 소비한다.
 *
 * 성공이든 실패든 저장된 값을 지운다. 남겨 두면 같은 state 로 두 번 들어오는 것을 막을 수 없다.
 */
export function consumeState(provider: SocialProvider, returned: string | null): boolean {
  const expected = sessionStorage.getItem(stateKey(provider));
  sessionStorage.removeItem(stateKey(provider));
  return !!expected && !!returned && expected === returned;
}

export class SocialLoginNotConfiguredError extends Error {
  constructor(provider: SocialProvider) {
    super(`${provider} 로그인의 클라이언트 ID가 설정되지 않았습니다`);
  }
}

/**
 * 제공자의 인증 화면으로 이동한다. 이 함수는 돌아오지 않는다.
 *
 * @throws SocialLoginNotConfiguredError 클라이언트 ID 환경변수가 없을 때
 */
export function startSocialLogin(provider: SocialProvider): void {
  const config = PROVIDERS[provider];
  if (!config.clientId) {
    throw new SocialLoginNotConfiguredError(provider);
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri(provider),
    response_type: "code",
    state: issueState(provider),
    ...config.extraParams,
  });
  if (config.scope) {
    params.set("scope", config.scope);
  }

  window.location.assign(`${config.authorizeUrl}?${params.toString()}`);
}

export const PROVIDER_LABELS: Record<SocialProvider, string> = {
  google: "Google",
  naver: "네이버",
};
