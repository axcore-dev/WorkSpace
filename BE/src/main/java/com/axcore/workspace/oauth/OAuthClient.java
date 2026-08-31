package com.axcore.workspace.oauth;

import com.axcore.workspace.user.entity.AuthProvider;

/**
 * 제공자와 실제로 통신하는 쪽.
 *
 * <p>구현체가 하는 일은 두 단계다 — FE 가 넘긴 authorization code 를 access 토큰으로 바꾸고,
 * 그 토큰으로 사용자 정보를 조회한다. 결과를 {@link OAuthUserInfo} 한 모양으로 맞춰 돌려준다.
 *
 * <p>access 토큰을 저장하지 않는다. 우리가 필요한 것은 "이 사람이 누구인가" 뿐이고, 제공자의
 * 캘린더·드라이브 같은 자원에 접근하지 않는다. 저장하지 않으면 유출될 것도 없고 갱신 로직도
 * 필요 없다. 나중에 Google Calendar 연동을 붙일 때는 그때 별도로 동의를 받는 편이 맞다 —
 * 로그인 한 번에 광범위한 권한을 함께 요구하지 않는다.
 */
public interface OAuthClient {

    AuthProvider provider();

    /**
     * authorization code 를 사용자 정보로 바꾼다.
     *
     * <p>{@code state} 를 함께 받는 이유는 네이버가 토큰 요청에 이 값을 요구하기 때문이다.
     * <b>여기서 state 를 검증하지는 않는다.</b> CSRF 방어용 검증은 FE 가 한다 — 인증 URL 을
     * 만들 때 sessionStorage 에 넣어 두고 돌아온 값과 대조한 뒤에야 이 경로로 들어온다
     * ({@link com.axcore.workspace.user.dto.OAuthLoginRequest}). 서버는 제공자에게 그대로
     * 넘겨주는 역할만 한다.
     *
     * @param code  FE 가 제공자로부터 받아 넘긴 일회용 코드. 한 번만 쓸 수 있다
     * @param state FE 가 발급해 제공자를 거쳐 돌아온 값. 쓰지 않는 제공자는 무시한다. 없을 수 있다
     * @throws OAuthExchangeException 코드가 이미 쓰였거나 만료됐거나 제공자가 거절한 경우
     */
    OAuthUserInfo fetchUserInfo(String code, String state);
}
