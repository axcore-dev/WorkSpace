package com.axcore.workspace.security;

import com.axcore.workspace.user.service.AuthResult;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

/**
 * refresh 쿠키를 만든다.
 *
 * <p>토큰이 나가는 지점이 셋이다 — 로그인, 2단계 통과, 재발급. 각자 쿠키를 조립하면 속성이
 * 어긋나고, 어긋난 속성 하나가 그대로 취약점이 된다. HttpOnly 를 한 곳에서만 빠뜨려도
 * 그 경로로 받은 refresh 는 스크립트가 읽을 수 있다.
 *
 * <p>HttpOnly 는 코드에서 고정이고, 배포 환경에 따라 달라지는 것만 설정으로 받는다.
 */
@Component
public class RefreshCookieFactory {

    private final AuthProperties properties;

    public RefreshCookieFactory(AuthProperties properties) {
        this.properties = properties;
    }

    /**
     * 결과를 그대로 응답으로 만든다. refresh 토큰이 없는 결과(2단계 대기)면 쿠키를 붙이지 않는다.
     *
     * <p>여기서 분기하는 이유는 호출부가 매번 판단하지 않게 하려는 것이다. 판단이 흩어지면
     * 2단계가 끝나기 전에 쿠키가 나가는 경로가 생긴다.
     */
    public ResponseEntity<com.axcore.workspace.user.dto.LoginResponse> toResponse(
            AuthResult result) {
        if (!result.hasRefreshToken()) {
            return ResponseEntity.ok(result.body());
        }
        ResponseCookie cookie =
                create(
                        result.refreshToken(),
                        result.refreshTokenExpiresAt(),
                        result.rememberMe());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(result.body());
    }

    /**
     * "로그인 유지"를 끄면 Max-Age 를 붙이지 않는다. 그러면 브라우저를 닫는 순간 쿠키가 사라져
     * 재접속 시 다시 로그인하게 된다. 공용 PC 를 고려한 기본 동작이다.
     */
    public ResponseCookie create(String value, Instant expiresAt, boolean rememberMe) {
        ResponseCookie.ResponseCookieBuilder builder = base(value);
        if (rememberMe) {
            Duration maxAge = Duration.between(Instant.now(), expiresAt);
            builder.maxAge(maxAge.isNegative() ? Duration.ZERO : maxAge);
        }
        return builder.build();
    }

    /** 삭제용. 같은 속성으로 내보내야 브라우저가 같은 쿠키로 인식해 지운다. */
    public ResponseCookie cleared() {
        return base("").maxAge(Duration.ZERO).build();
    }

    private ResponseCookie.ResponseCookieBuilder base(String value) {
        return ResponseCookie.from(properties.refreshCookieName(), value)
                .httpOnly(true)
                .secure(properties.refreshCookieSecure())
                .path(properties.refreshCookiePath())
                .sameSite(properties.refreshCookieSameSite());
    }
}
