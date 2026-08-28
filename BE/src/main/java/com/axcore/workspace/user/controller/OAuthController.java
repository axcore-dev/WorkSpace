package com.axcore.workspace.user.controller;

import com.axcore.workspace.security.RefreshCookieFactory;
import com.axcore.workspace.user.dto.LoginResponse;
import com.axcore.workspace.user.dto.OAuthLoginRequest;
import com.axcore.workspace.user.entity.AuthProvider;
import com.axcore.workspace.user.service.AuthResult;
import com.axcore.workspace.user.service.SocialLoginService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

/**
 * 소셜 로그인 엔드포인트.
 *
 * <p>제공자를 경로로 받는다 — {@code POST /api/auth/oauth/google}. 응답은 이메일 로그인과
 * 완전히 같은 {@link LoginResponse} 다. 2단계가 켜져 있으면 여기서도 {@code next=MFA_REQUIRED} 가
 * 나오고 세션은 {@code POST /api/auth/mfa/verify} 에서 생긴다. FE 는 어느 경로로 들어왔는지와
 * 무관하게 같은 분기를 쓰면 된다.
 *
 * <p>인증이 필요 없는 경로다. 제공자가 발급한 code 를 가진 것 자체가 자격 증명이다.
 */
@RestController
@RequestMapping("/api/auth/oauth")
public class OAuthController {

    private final SocialLoginService socialLoginService;
    private final RefreshCookieFactory refreshCookies;

    public OAuthController(
            SocialLoginService socialLoginService, RefreshCookieFactory refreshCookies) {
        this.socialLoginService = socialLoginService;
        this.refreshCookies = refreshCookies;
    }

    @PostMapping("/{provider}")
    public ResponseEntity<LoginResponse> login(
            @PathVariable String provider,
            @Valid @RequestBody OAuthLoginRequest request,
            HttpServletRequest servletRequest) {

        AuthResult result =
                socialLoginService.login(
                        resolveProvider(provider),
                        request.code(),
                        request.rememberMeOrDefault(),
                        servletRequest.getHeader(HttpHeaders.USER_AGENT),
                        servletRequest.getRemoteAddr());

        return refreshCookies.toResponse(result);
    }

    /**
     * 경로 조각을 제공자로 바꾼다.
     *
     * <p>{@code @PathVariable AuthProvider} 로 직접 받지 않는 이유: Spring 의 기본 열거형 변환은
     * 상수 이름(대문자)만 받아들여서 {@code /oauth/google} 이 변환 실패로 500 이 된다. 경로에는
     * 소문자가 오는 게 자연스럽고, 모르는 제공자는 404 로 답해야 한다.
     */
    private static AuthProvider resolveProvider(String provider) {
        return AuthProvider.from(provider)
                .orElseThrow(
                        () ->
                                new ResponseStatusException(
                                        HttpStatus.NOT_FOUND, "지원하지 않는 로그인 제공자입니다"));
    }
}
