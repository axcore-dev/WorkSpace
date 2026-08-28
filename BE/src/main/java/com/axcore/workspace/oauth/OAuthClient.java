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
     * @param code FE 가 제공자로부터 받아 넘긴 일회용 코드. 한 번만 쓸 수 있다
     * @throws OAuthExchangeException 코드가 이미 쓰였거나 만료됐거나 제공자가 거절한 경우
     */
    OAuthUserInfo fetchUserInfo(String code);
}
