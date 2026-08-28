package com.axcore.workspace.user.dto;

import java.time.Instant;

/**
 * 로그인·재발급 응답.
 *
 * <p>refresh 토큰은 여기에 없다. HttpOnly 쿠키로만 나간다. 응답 본문에 담으면 JS 가 읽을 수
 * 있게 되고, 그러면 XSS 한 번에 재발급 권한이 통째로 넘어간다.
 *
 * <p>{@code next} 를 두는 이유: 로그인은 한 번의 왕복으로 끝나지 않는다. 2단계 인증(명세 2.1.3)과
 * 회사 선택이 뒤에 붙으면 이 엔드포인트는 토큰 대신 "다음에 할 일"을 돌려주는 순간이 생긴다.
 * 그때 응답 스키마를 바꾸지 않으려고 처음부터 단계를 명시한다.
 *
 * @param accessToken          {@code next} 가 MFA_REQUIRED 인 동안에는 null 이다.
 * @param accessTokenExpiresAt FE 가 만료 직전에 미리 재발급하도록 알려 준다.
 */
public record LoginResponse(
        AuthStep next, String accessToken, Instant accessTokenExpiresAt, UserResponse user) {

    public enum AuthStep {
        /** 비밀번호는 맞았지만 2단계 인증이 남았다. (명세 2.1.3 — 아직 미구현) */
        MFA_REQUIRED,
        /** 인증은 끝났고 소속 회사를 골라야 한다. 회사가 정해져야 스키마가 정해진다. */
        SELECT_WORKSPACE,
        /** 바로 업무 화면으로 진입할 수 있다. */
        READY
    }

    public static LoginResponse of(
            AuthStep next, String accessToken, Instant expiresAt, UserResponse user) {
        return new LoginResponse(next, accessToken, expiresAt, user);
    }
}
