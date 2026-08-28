package com.axcore.workspace.user.service;

import com.axcore.workspace.user.dto.LoginResponse;

import java.time.Instant;

/**
 * 서비스 계층이 컨트롤러에 넘기는 인증 결과.
 *
 * <p>본문과 쿠키를 나눠 담는다. 컨트롤러는 {@code refreshToken} 을 HttpOnly 쿠키로만 내보내고
 * 본문에는 싣지 않는다. 이 구분을 타입으로 강제하려고 {@link LoginResponse} 에 refresh 자리를
 * 두지 않았다.
 *
 * @param refreshToken 2단계가 남은 응답에서는 null 이다. 아직 세션이 발급되지 않았다.
 * @param rememberMe   쿠키에 Max-Age 를 붙일지 정한다. 세션 쿠키로 내보내면 브라우저를 닫는
 *                     순간 사라진다.
 */
public record AuthResult(
        LoginResponse body, String refreshToken, Instant refreshTokenExpiresAt, boolean rememberMe) {

    /** 2단계 인증이 남아 세션이 발급되지 않은 결과. 내보낼 쿠키가 없다. */
    public static AuthResult pending(LoginResponse body) {
        return new AuthResult(body, null, null, false);
    }

    public boolean hasRefreshToken() {
        return refreshToken != null;
    }
}
