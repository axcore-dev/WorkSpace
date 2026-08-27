package com.axcore.workspace.user.service;

import com.axcore.workspace.security.JwtTokenService;
import com.axcore.workspace.security.UserPrincipal;
import com.axcore.workspace.user.dto.LoginRequest;
import com.axcore.workspace.user.dto.LoginResponse;
import com.axcore.workspace.user.dto.SignUpRequest;
import com.axcore.workspace.user.dto.UserResponse;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.entity.UserSession;
import com.axcore.workspace.user.repository.UserRepository;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * 로그인 · 재발급 · 로그아웃.
 *
 * <p>access 토큰(JWT)과 refresh 토큰(난수)을 짝으로 발급한다. 요청마다 DB 를 보지 않는 대신
 * access 수명을 짧게 두고, 끊어야 할 때는 refresh 를 폐기한다.
 */
@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final RefreshTokenService refreshTokenService;
    private final JwtTokenService jwtTokenService;
    private final PasswordEncoder passwordEncoder;

    public AuthService(
            AuthenticationManager authenticationManager,
            UserRepository userRepository,
            RefreshTokenService refreshTokenService,
            JwtTokenService jwtTokenService,
            PasswordEncoder passwordEncoder) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.refreshTokenService = refreshTokenService;
        this.jwtTokenService = jwtTokenService;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * 이메일 가입.
     *
     * <p>명세 2.1.5 의 최종 형태는 인증 메일을 먼저 보내고 링크를 연 뒤에 계정이 서는 것이다.
     * 지금은 그 단계가 없어 즉시 계정이 만들어진다. 이메일 소유 확인이 붙기 전까지는 남의 주소로
     * 가입할 수 있는 상태라는 뜻이라, 외부에 열기 전에 반드시 채워야 한다.
     */
    @Transactional
    public UserResponse signUp(SignUpRequest request) {
        String email = User.normalizeEmail(request.email());
        if (userRepository.existsByEmail(email)) {
            throw new DuplicateEmailException();
        }
        User user =
                User.create(email, passwordEncoder.encode(request.password()), request.name());
        return UserResponse.from(userRepository.save(user));
    }

    @Transactional
    public AuthResult login(LoginRequest request, String userAgent, String ip) {
        User user = authenticate(request);
        Instant now = Instant.now();
        user.recordLogin(now);

        RefreshTokenService.IssuedRefreshToken refresh =
                refreshTokenService.issue(user, request.rememberMeOrDefault(), userAgent, ip, now);
        return toResult(user, refresh, now);
    }

    /**
     * access 토큰 재발급. 쓰인 refresh 는 회전되어 즉시 무효가 된다.
     *
     * <p>여기서 사용자 정보를 다시 실어 보내는 이유는 FE 가 새로고침 직후 이 엔드포인트만으로
     * 로그인 상태를 복원할 수 있게 하려는 것이다. access 는 메모리에만 두므로 새로고침하면
     * 사라진다.
     */
    @Transactional
    public AuthResult refresh(String rawRefreshToken, String userAgent, String ip) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new BadCredentialsException("세션이 만료되었습니다. 다시 로그인해 주세요");
        }
        Instant now = Instant.now();
        RefreshTokenService.IssuedRefreshToken rotated =
                refreshTokenService.rotate(rawRefreshToken, userAgent, ip, now);
        return toResult(rotated.session().getUser(), rotated, now);
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        refreshTokenService.revoke(rawRefreshToken, Instant.now());
    }

    @Transactional(readOnly = true)
    public UserResponse currentUser(UUID userId) {
        return userRepository
                .findById(userId)
                .map(UserResponse::from)
                .orElseThrow(() -> new BadCredentialsException("세션이 만료되었습니다. 다시 로그인해 주세요"));
    }

    /**
     * 인증 실패는 원인을 가리지 않고 한 가지로 합친다. "없는 계정"과 "틀린 비밀번호"가 구분되면
     * 그 응답만으로 가입 여부를 조회할 수 있다. (명세 2.1.4 의 "계정 존재 노출 방지")
     */
    private User authenticate(LoginRequest request) {
        Authentication authentication;
        try {
            authentication =
                    authenticationManager.authenticate(
                            new UsernamePasswordAuthenticationToken(
                                    User.normalizeEmail(request.email()), request.password()));
        } catch (AuthenticationException e) {
            throw new BadCredentialsException("이메일 또는 비밀번호가 올바르지 않습니다");
        }

        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return userRepository
                .findById(principal.getId())
                .orElseThrow(() -> new BadCredentialsException("이메일 또는 비밀번호가 올바르지 않습니다"));
    }

    private AuthResult toResult(
            User user, RefreshTokenService.IssuedRefreshToken refresh, Instant now) {
        UserSession session = refresh.session();
        JwtTokenService.AccessToken access = jwtTokenService.issue(user.getId(), session.getId(), now);
        LoginResponse body =
                new LoginResponse(
                        nextStep(session), access.value(), access.expiresAt(), UserResponse.from(user));
        return new AuthResult(body, refresh.rawToken(), session.getExpiresAt(), session.isRememberMe());
    }

    /**
     * 회사를 고르기 전에는 어느 스키마를 열지 정해지지 않는다. 회사 선택 엔드포인트가 붙기
     * 전까지는 항상 SELECT_WORKSPACE 가 나간다.
     */
    private static LoginResponse.AuthStep nextStep(UserSession session) {
        return session.getWorkspaceId() == null
                ? LoginResponse.AuthStep.SELECT_WORKSPACE
                : LoginResponse.AuthStep.READY;
    }

    /**
     * @param refreshToken 컨트롤러가 쿠키로만 내보낸다. 응답 본문에 실리지 않는다.
     */
    public record AuthResult(
            LoginResponse body,
            String refreshToken,
            Instant refreshTokenExpiresAt,
            boolean rememberMe) {
    }
}
