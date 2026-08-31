package com.axcore.workspace.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 소셜 로그인 요청.
 *
 * <p><b>{@code state} 를 받지만 검증하지는 않는다.</b> CSRF 방어용 검증은 <b>FE 가 만들고 FE 가
 * 한다</b> — 인증 URL 을 만들 때 sessionStorage 에 넣어 두고, 제공자가 되돌려준 값과 비교한
 * 뒤에야 이 요청을 보낸다. 공격자는 피해자의 sessionStorage 에 쓸 수 없으므로 이 검증으로
 * 충분하다. BE 가 검증하려면 발급한 state 를 서버에 저장해야 하는데, 로그인 전이라 세션이
 * 없어서 그것만을 위한 저장소가 필요해진다.
 *
 * <p>그런데도 값을 받는 이유는 <b>네이버가 토큰 요청에 이 값을 요구하기 때문</b>이다. 서버는
 * 제공자에게 그대로 넘겨주기만 한다. Google 은 쓰지 않는다.
 *
 * @param code       제공자가 발급한 일회용 authorization code. 한 번만 교환할 수 있고 수 분 안에
 *                   만료된다. 길이 상한을 두는 이유는 임의로 긴 문자열이 제공자 호출까지
 *                   내려가지 않게 하려는 것이다
 * @param state      FE 가 발급해 제공자를 거쳐 돌아온 값. 네이버는 필수, Google 은 무시한다.
 *                   여기서 {@code @NotBlank} 를 걸지 않는 것은 제공자마다 필요 여부가 달라서다 —
 *                   없을 때 무엇을 할지는 각 {@link com.axcore.workspace.oauth.OAuthClient} 가
 *                   정한다
 * @param rememberMe 로그인 화면의 "로그인 유지" 체크값. 이메일 로그인과 같은 규칙으로 없으면
 *                   해제로 본다
 */
public record OAuthLoginRequest(
        @NotBlank(message = "인증 코드는 필수입니다")
                @Size(max = 2048, message = "인증 코드가 올바르지 않습니다")
                String code,
        @Size(max = 512, message = "상태 값이 올바르지 않습니다") String state,
        Boolean rememberMe) {

    public boolean rememberMeOrDefault() {
        return Boolean.TRUE.equals(rememberMe);
    }
}
