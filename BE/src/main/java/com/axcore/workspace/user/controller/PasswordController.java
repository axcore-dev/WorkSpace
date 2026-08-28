package com.axcore.workspace.user.controller;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.security.RefreshCookieFactory;
import com.axcore.workspace.user.dto.PasswordRequests;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.service.AuthService;
import com.axcore.workspace.user.service.PasswordService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

/**
 * 비밀번호 변경과 재설정.
 *
 * <p>세 경로 모두 끝나면 그 사용자의 모든 세션이 폐기된다. 그래서 응답에 refresh 쿠키 삭제
 * 헤더를 함께 붙인다 — 폐기된 refresh 를 브라우저에 남겨 두면 다음 재발급이 401 로 떨어지고,
 * 화면은 그걸 "세션 만료"로 오해한다.
 */
@RestController
@RequestMapping("/api/auth/password")
public class PasswordController {

    private final PasswordService passwordService;
    private final AuthService authService;
    private final RefreshCookieFactory refreshCookies;

    public PasswordController(
            PasswordService passwordService,
            AuthService authService,
            RefreshCookieFactory refreshCookies) {
        this.passwordService = passwordService;
        this.authService = authService;
        this.refreshCookies = refreshCookies;
    }

    /**
     * 로그인 상태에서의 변경. 현재 비밀번호를 다시 묻는다.
     *
     * <p>바꾸고 나면 지금 이 세션도 함께 끊긴다. 자기 기기만 남기는 선택지를 두지 않는 이유는,
     * 유출이 의심돼 바꾸는 상황에서 "어느 세션이 내 것인가"를 사용자가 확신할 수 없기 때문이다.
     */
    @PostMapping
    public ResponseEntity<Void> change(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody PasswordRequests.ChangeRequest request) {
        User user = authService.requireUser(JwtPrincipal.of(jwt).userId());
        passwordService.change(
                user, request.currentPassword(), request.newPassword(), Instant.now());
        return clearedCookieResponse();
    }

    /**
     * 재설정 링크 요청.
     *
     * <p>가입 여부와 무관하게 항상 202 다. 응답이 갈리면 이 엔드포인트가 가입 여부 조회기가
     * 된다. 인증 없이 부를 수 있는 경로라 특히 그렇다.
     */
    @PostMapping("/reset-request")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void requestReset(@Valid @RequestBody PasswordRequests.ResetRequest request) {
        passwordService.requestReset(request.email(), Instant.now());
    }

    /** 링크의 토큰으로 새 비밀번호를 설정한다. 인증이 필요 없다 — 비밀번호를 잊은 사람이 쓴다. */
    @PostMapping("/reset")
    public ResponseEntity<Void> reset(
            @Valid @RequestBody PasswordRequests.ResetConfirmRequest request) {
        passwordService.reset(request.token(), request.newPassword(), Instant.now());
        return clearedCookieResponse();
    }

    private ResponseEntity<Void> clearedCookieResponse() {
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, refreshCookies.cleared().toString())
                .build();
    }
}
