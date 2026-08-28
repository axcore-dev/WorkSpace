package com.axcore.workspace.user.controller;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.security.RefreshCookieFactory;
import com.axcore.workspace.user.dto.LoginResponse;
import com.axcore.workspace.user.dto.MfaChallengeResponse;
import com.axcore.workspace.user.dto.MfaMethodResponse;
import com.axcore.workspace.user.dto.MfaRequests;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.service.AuthResult;
import com.axcore.workspace.user.service.AuthService;
import com.axcore.workspace.user.service.MfaService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

/**
 * 2단계 인증.
 *
 * <p>{@code /verify} 만 인증 없이 열려 있다. 로그인 도중에 부르는 경로라 access 토큰이 아직
 * 없다. 나머지(등록·해제·조회)는 로그인된 상태에서 자기 설정을 다루는 것이라 인증이 필요하다.
 */
@RestController
@RequestMapping("/api/auth/mfa")
public class MfaController {

    private final MfaService mfaService;
    private final AuthService authService;
    private final RefreshCookieFactory refreshCookies;
    private final PasswordEncoder passwordEncoder;

    public MfaController(
            MfaService mfaService,
            AuthService authService,
            RefreshCookieFactory refreshCookies,
            PasswordEncoder passwordEncoder) {
        this.mfaService = mfaService;
        this.authService = authService;
        this.refreshCookies = refreshCookies;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * 로그인 2단계 통과. 여기서 비로소 세션과 토큰이 발급된다.
     *
     * <p>인증이 필요 없는 경로다. 챌린지 토큰과 코드를 함께 가진 것이 자격 증명이다.
     */
    @PostMapping("/verify")
    public ResponseEntity<LoginResponse> verify(
            @Valid @RequestBody MfaRequests.VerifyRequest request,
            HttpServletRequest servletRequest) {
        AuthResult result =
                mfaService.verifyLogin(
                        request.mfaToken(),
                        request.code(),
                        servletRequest.getHeader(HttpHeaders.USER_AGENT),
                        servletRequest.getRemoteAddr(),
                        Instant.now());
        return refreshCookies.toResponse(result);
    }

    @GetMapping("/methods")
    public List<MfaMethodResponse> methods(@AuthenticationPrincipal Jwt jwt) {
        User user = authService.requireUser(JwtPrincipal.of(jwt).userId());
        return mfaService.methodsOf(user).stream().map(MfaMethodResponse::from).toList();
    }

    /**
     * 이메일 2단계 등록 시작. 확인 코드를 보내고 챌린지를 돌려준다. 아직 켜지지 않는다.
     */
    @PostMapping("/email")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public MfaChallengeResponse startEmailEnrollment(@AuthenticationPrincipal Jwt jwt) {
        User user = authService.requireUser(JwtPrincipal.of(jwt).userId());
        String token = mfaService.startEmailEnrollment(user, Instant.now());
        return new MfaChallengeResponse(token);
    }

    /** 등록 확인. 코드가 맞으면 그때 켜진다. */
    @PostMapping("/email/confirm")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void confirmEmailEnrollment(@Valid @RequestBody MfaRequests.ConfirmRequest request) {
        mfaService.confirmEmailEnrollment(request.mfaToken(), request.code(), Instant.now());
    }

    /**
     * 2단계 끄기.
     *
     * <p>비밀번호를 다시 묻는다. access 토큰만 탈취한 쪽이 방어를 걷어내는 것을 막는다.
     * 끄고 나면 모든 세션이 폐기된다 — 이 조작이 탈취된 세션에서 일어났다면, 끊지 않는 한
     * 공격자의 세션만 살아남는다.
     */
    @DeleteMapping("/email")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void disableEmailMfa(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody MfaRequests.DisableRequest request) {
        User user = authService.requireUser(JwtPrincipal.of(jwt).userId());
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BadCredentialsException("비밀번호가 올바르지 않습니다");
        }
        mfaService.disableEmailMfa(user, Instant.now());
    }
}
