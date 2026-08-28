package com.axcore.workspace.user.controller;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.user.dto.EmailVerificationRequest;
import com.axcore.workspace.user.dto.UserResponse;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.service.AuthService;
import com.axcore.workspace.user.service.EmailVerificationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

/**
 * 이메일 소유 확인.
 *
 * <p>{@code /verify} 는 인증이 필요 없다. 확인 링크는 로그인하지 않은 브라우저에서 열릴 수 있고,
 * 토큰을 가진 것 자체가 그 메일함을 열었다는 증거다.
 *
 * <p>재발송은 로그인이 필요하다. 이메일을 받아 재발송하는 형태로 두면 인증 없이 임의의 주소로
 * 메일을 보낼 수 있는 발송기가 된다.
 */
@RestController
@RequestMapping("/api/auth/email")
public class EmailVerificationController {

    private final EmailVerificationService emailVerificationService;
    private final AuthService authService;

    public EmailVerificationController(
            EmailVerificationService emailVerificationService, AuthService authService) {
        this.emailVerificationService = emailVerificationService;
        this.authService = authService;
    }

    /**
     * 링크의 토큰으로 확인 처리한다.
     *
     * <p>확인된 사용자를 돌려주는 이유: 화면이 "○○님, 확인이 완료되었습니다"를 띄울 수 있어야
     * 하고, 이미 로그인해 있던 탭이 상태를 갱신할 근거가 된다. 토큰을 가진 쪽은 그 메일함의
     * 주인이므로 자기 정보를 보는 것이다.
     */
    @PostMapping("/verify")
    public UserResponse verify(@Valid @RequestBody EmailVerificationRequest request) {
        User user = emailVerificationService.verify(request.token(), Instant.now());
        return UserResponse.from(user);
    }

    /** 확인 메일 재발송. 이미 확인된 계정이면 409 다. */
    @PostMapping("/verify-request")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void resend(@AuthenticationPrincipal Jwt jwt) {
        User user = authService.requireUser(JwtPrincipal.of(jwt).userId());
        emailVerificationService.resend(user, Instant.now());
    }
}
