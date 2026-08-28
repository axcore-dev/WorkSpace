package com.axcore.workspace.user.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;

/**
 * 로그인·재발급 응답.
 *
 * <p>refresh 토큰은 여기에 없다. HttpOnly 쿠키로만 나간다. 응답 본문에 담으면 JS 가 읽을 수
 * 있게 되고, 그러면 XSS 한 번에 재발급 권한이 통째로 넘어간다.
 *
 * <p>{@code next} 를 두는 이유: 로그인은 한 번의 왕복으로 끝나지 않는다. 비밀번호가 맞아도
 * 2단계 인증 · 이메일 확인 · 회사 선택이 남아 있을 수 있다. 각 단계마다 응답 스키마를 바꾸지
 * 않으려고 처음부터 단계를 명시한다.
 *
 * @param accessToken          {@code next} 가 MFA_REQUIRED 인 동안에는 null 이다. 그 단계에서는
 *                             아직 인증이 끝나지 않아 어떤 API 도 열리면 안 된다.
 * @param accessTokenExpiresAt FE 가 만료 직전에 미리 재발급하도록 알려 준다.
 * @param mfaToken             MFA_REQUIRED 일 때만 채워진다. 이것만으로는 아무것도 못 하고,
 *                             메일로 받은 코드와 함께 제출해야 통과한다.
 * @param user                 MFA_REQUIRED 일 때는 null 이다. 2단계를 통과하기 전에 이름을
 *                             내보내면 비밀번호만 아는 쪽에게 계정 정보가 새어 나간다.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record LoginResponse(
        AuthStep next,
        String accessToken,
        Instant accessTokenExpiresAt,
        String mfaToken,
        UserResponse user) {

    public enum AuthStep {
        /** 비밀번호는 맞았지만 2단계 인증이 남았다. */
        MFA_REQUIRED,
        /** 인증은 끝났지만 이메일 소유가 확인되지 않았다. 회사 진입이 막힌다. */
        EMAIL_VERIFICATION_REQUIRED,
        /** 인증은 끝났고 소속 회사를 골라야 한다. 회사가 정해져야 스키마가 정해진다. */
        SELECT_WORKSPACE,
        /** 바로 업무 화면으로 진입할 수 있다. */
        READY
    }

    /** 2단계가 남은 상태. 토큰도 사용자 정보도 나가지 않는다. */
    public static LoginResponse mfaRequired(String mfaToken) {
        return new LoginResponse(AuthStep.MFA_REQUIRED, null, null, mfaToken, null);
    }

    /** 인증이 끝난 상태. 남은 단계는 {@code next} 가 말해 준다. */
    public static LoginResponse authenticated(
            AuthStep next, String accessToken, Instant expiresAt, UserResponse user) {
        return new LoginResponse(next, accessToken, expiresAt, null, user);
    }
}
