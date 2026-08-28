package com.axcore.workspace.user.controller;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.security.RefreshCookieFactory;
import com.axcore.workspace.user.dto.LoginRequest;
import com.axcore.workspace.user.dto.LoginResponse;
import com.axcore.workspace.user.dto.SignUpRequest;
import com.axcore.workspace.user.dto.UserResponse;
import com.axcore.workspace.user.service.AuthResult;
import com.axcore.workspace.user.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 인증 엔드포인트.
 *
 * <p>access 토큰은 응답 본문으로, refresh 토큰은 HttpOnly 쿠키로 나간다. 두 개를 다른 통로로
 * 보내는 이유는 노출 면적이 다르기 때문이다. access 는 15분짜리라 메모리에 두면 되고, refresh 는
 * 며칠짜리 재발급 권한이라 스크립트가 읽을 수 있는 곳에 두면 안 된다.
 *
 * <p>계정 관리(비밀번호 · 이메일 확인 · 2단계 · 세션 · 회사)는 각각의 컨트롤러로 나뉘어 있다.
 * 여기는 "로그인 세션을 만들고 없애는" 경로만 둔다.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final RefreshCookieFactory refreshCookies;

    public AuthController(AuthService authService, RefreshCookieFactory refreshCookies) {
        this.authService = authService;
        this.refreshCookies = refreshCookies;
    }

    /**
     * 가입. 계정을 만들고 소유 확인 메일을 보낸다.
     *
     * <p>확인 전에도 계정은 선다. 확인될 때까지 회사 진입이 막힐 뿐이다.
     * ({@code AuthService#signUp} 주석 참고)
     */
    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse signUp(@Valid @RequestBody SignUpRequest request) {
        return authService.signUp(request);
    }

    /**
     * 로그인.
     *
     * <p>2단계가 켜져 있으면 여기서 토큰이 나가지 않는다. {@code next=MFA_REQUIRED} 와
     * {@code mfaToken} 만 돌려주고, 세션은 {@code POST /api/auth/mfa/verify} 에서 생긴다.
     */
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(
            @Valid @RequestBody LoginRequest request, HttpServletRequest servletRequest) {
        AuthResult result =
                authService.login(request, userAgent(servletRequest), clientIp(servletRequest));
        return refreshCookies.toResponse(result);
    }

    /**
     * access 재발급. 쿠키에 실린 refresh 는 이 호출로 즉시 회전되어 무효가 된다.
     *
     * <p>인증이 필요 없는 경로다. 유효한 refresh 쿠키를 가진 것 자체가 자격 증명이다.
     */
    @PostMapping("/refresh")
    public ResponseEntity<LoginResponse> refresh(
            @CookieValue(name = "${app.auth.refresh-cookie-name}", required = false)
                    String refreshToken,
            HttpServletRequest servletRequest) {
        AuthResult result =
                authService.refresh(
                        refreshToken, userAgent(servletRequest), clientIp(servletRequest));
        return refreshCookies.toResponse(result);
    }

    /**
     * 로그아웃. refresh 를 폐기하고 쿠키를 지운다.
     *
     * <p>이미 나가 있는 access 토큰은 서명만으로 통과하므로 최대 access TTL 만큼 더 살아 있다.
     * 그 시간을 0 으로 만들려면 요청마다 DB 를 봐야 하고, 그러면 JWT 를 쓸 이유가 없어진다.
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @CookieValue(name = "${app.auth.refresh-cookie-name}", required = false)
                    String refreshToken) {
        authService.logout(refreshToken);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, refreshCookies.cleared().toString())
                .build();
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal Jwt jwt) {
        return authService.currentUser(JwtPrincipal.of(jwt).userId());
    }

    private static String userAgent(HttpServletRequest request) {
        return request.getHeader(HttpHeaders.USER_AGENT);
    }

    /**
     * X-Forwarded-For 를 직접 읽지 않는다. 그 헤더는 클라이언트가 마음대로 보낼 수 있어서,
     * 신뢰할 수 있는 프록시 뒤에 있다는 전제가 없으면 그대로 위조된 IP 를 기록하게 된다.
     * 프록시를 두게 되면 {@code server.forward-headers-strategy} 로 처리한다.
     */
    private static String clientIp(HttpServletRequest request) {
        return request.getRemoteAddr();
    }
}
