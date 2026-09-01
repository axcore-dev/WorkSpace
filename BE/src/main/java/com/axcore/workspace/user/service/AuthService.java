package com.axcore.workspace.user.service;

import com.axcore.workspace.user.dto.LoginRequest;
import com.axcore.workspace.user.dto.LoginResponse;
import com.axcore.workspace.user.dto.SignUpRequest;
import com.axcore.workspace.user.dto.UserResponse;
import com.axcore.workspace.user.entity.TokenPurpose;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.repository.UserRepository;
import com.axcore.workspace.security.UserPrincipal;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;
import java.time.Instant;

/**
 * 로그인 · 재발급 · 로그아웃.
 *
 * <p>access 토큰(JWT)과 refresh 토큰(난수)을 짝으로 발급한다. 요청마다 DB 를 보지 않는 대신
 * access 수명을 짧게 두고, 끊어야 할 때는 refresh 를 폐기한다.
 *
 * <p>토큰을 실제로 만드는 일은 {@link SessionIssuer} 가 한다. 여기서는 "누구인지 확인하고,
 * 2단계가 필요한지 판단하는" 데까지다.
 */
@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final RefreshTokenService refreshTokenService;
    private final SessionIssuer sessionIssuer;
    private final MfaService mfaService;
    private final VerificationTokenService verificationTokenService;
    private final AccountMailer mailer;
    private final PasswordEncoder passwordEncoder;
    private final UnverifiedAccountReclaimer reclaimer;
    private final LoginAttemptRecorder loginAttemptRecorder;

    public AuthService(
            AuthenticationManager authenticationManager,
            UserRepository userRepository,
            RefreshTokenService refreshTokenService,
            SessionIssuer sessionIssuer,
            MfaService mfaService,
            VerificationTokenService verificationTokenService,
            AccountMailer mailer,
            PasswordEncoder passwordEncoder,
            UnverifiedAccountReclaimer reclaimer,
            LoginAttemptRecorder loginAttemptRecorder) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.refreshTokenService = refreshTokenService;
        this.sessionIssuer = sessionIssuer;
        this.mfaService = mfaService;
        this.verificationTokenService = verificationTokenService;
        this.mailer = mailer;
        this.passwordEncoder = passwordEncoder;
        this.reclaimer = reclaimer;
        this.loginAttemptRecorder = loginAttemptRecorder;
    }

    /**
     * 이메일 가입. 계정을 만들고 소유 확인 메일을 보낸다.
     *
     * <p>확인 전에도 계정은 선다. 확인이 끝날 때까지 계정을 만들지 않으면 미완료 가입 상태를
     * 담아 둘 곳이 따로 필요하고, 소셜 로그인에는 그 자리(가입 폼)가 아예 없어서 같은 장치를
     * 두 벌 만들게 된다. 대신 확인되지 않은 계정은 회사에 들어가지 못한다.
     * ({@link SessionIssuer#nextStep})
     *
     * <p>이미 그 주소로 계정이 있으면 <b>확인 여부로 갈린다.</b> 확인된 계정이면 중복이고,
     * 확인되지 않은 계정이면 그 주소를 점유하지 않으므로 밀어내고 새로 만든다. 남의 주소로
     * 가입해 두는 것만으로 진짜 주인이 가입하지 못하게 되는 것을 막는 장치다.
     * ({@link UnverifiedAccountReclaimer})
     *
     * <p>중복을 그대로 알려 주므로 "이 주소가 가입돼 있는가" 는 지금도 알아낼 수 있다. 가입
     * 화면에서 흔히 받아들이는 교환이지만 이 클래스가 정한 것은 아니다 — 응답을 흐리게 바꾸려면
     * 확인 메일 문구까지 함께 바꿔야 하므로 여기서 다루지 않는다.
     */
    @Transactional
    public UserResponse signUp(SignUpRequest request) {
        String email = User.normalizeEmail(request.email());
        userRepository
                .findByEmail(email)
                .ifPresent(
                        existing -> {
                            if (!reclaimer.reclaimIfUnverified(existing)) {
                                throw new DuplicateEmailException();
                            }
                        });
        User user =
                userRepository.save(
                        User.create(email, passwordEncoder.encode(request.password()), request.name()));

        Instant now = Instant.now();
        String token = verificationTokenService.issue(user, TokenPurpose.EMAIL_VERIFICATION, now);
        mailer.sendEmailVerification(user, token, TokenPurpose.EMAIL_VERIFICATION.ttl());
        return UserResponse.from(user);
    }

    /**
     * 로그인.
     *
     * <p>2단계가 켜져 있으면 여기서 토큰이 나가지 않는다. 챌린지만 만들고 코드를 보낸 뒤
     * {@code MFA_REQUIRED} 를 돌려준다. 세션은 {@link MfaService#verifyLogin} 에서 생긴다.
     */
    @Transactional
    public AuthResult login(LoginRequest request, String userAgent, String ip) {
        User user = authenticate(request);
        Instant now = Instant.now();
        boolean rememberMe = request.rememberMeOrDefault();

        // 비밀번호가 맞았다. 여기까지 온 시점에 연속 실패 기록은 의미가 없다.
        //
        // 2단계가 남아 있어도 지운다. 막으려던 것은 비밀번호 추측이고 그건 이미 끝났다.
        // 2단계 코드 자체는 mfa_challenges 가 5회로 따로 막는다.
        user.clearLoginFailures();

        if (sessionIssuer.requiresMfa(user)) {
            String challengeToken = mfaService.startLoginChallenge(user, rememberMe, now);
            return AuthResult.pending(LoginResponse.mfaRequired(challengeToken));
        }
        return sessionIssuer.issueNewSession(user, rememberMe, userAgent, ip, now);
    }

    /**
     * access 토큰 재발급. 쓰인 refresh 는 회전되어 즉시 무효가 된다.
     *
     * <p>여기서 사용자 정보를 다시 실어 보내는 이유는 FE 가 새로고침 직후 이 엔드포인트만으로
     * 로그인 상태를 복원할 수 있게 하려는 것이다. access 는 메모리에만 두므로 새로고침하면
     * 사라진다.
     *
     * <p>2단계를 다시 묻지 않는다. refresh 를 들고 있다는 것은 이미 통과했다는 뜻이고, 재발급마다
     * 코드를 요구하면 15분마다 메일을 확인해야 한다.
     */
    @Transactional
    public AuthResult refresh(String rawRefreshToken, String userAgent, String ip) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new BadCredentialsException("세션이 만료되었습니다. 다시 로그인해 주세요");
        }
        Instant now = Instant.now();
        RefreshTokenService.IssuedRefreshToken rotated =
                refreshTokenService.rotate(rawRefreshToken, userAgent, ip, now);
        return sessionIssuer.fromSession(rotated.session(), rotated.rawToken(), now);
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        refreshTokenService.revoke(rawRefreshToken, Instant.now());
    }

    @Transactional(readOnly = true)
    public UserResponse currentUser(UUID userId) {
        return UserResponse.from(requireUser(userId));
    }

    /**
     * 토큰의 subject 로 사용자를 찾는다.
     *
     * <p>서명이 유효한 토큰이라도 계정이 사라졌을 수 있다. 그때는 인증 실패로 되돌린다 —
     * 토큰은 멀쩡한데 사용자가 없는 상태를 각 엔드포인트가 알아서 처리하게 두면 빠뜨리는 곳이
     * 생긴다.
     */
    @Transactional(readOnly = true)
    public User requireUser(UUID userId) {
        return userRepository
                .findById(userId)
                .orElseThrow(() -> new BadCredentialsException("세션이 만료되었습니다. 다시 로그인해 주세요"));
    }

    /**
     * 인증 실패는 원인을 가리지 않고 한 가지로 합친다. "없는 계정"과 "틀린 비밀번호"가 구분되면
     * 그 응답만으로 가입 여부를 조회할 수 있다.
     */
    /**
     * 비밀번호를 대조하고 계정을 돌려준다.
     *
     * <p>실패 원인이 무엇이든 같은 메시지로 수렴시킨다. 없는 계정 · 틀린 비밀번호 · 소셜 전용
     * 계정 · 잠긴 계정이 응답으로 구분되면, 그 차이만으로 어떤 주소가 가입돼 있고 어떤 계정이
     * 잠겼는지 알아낼 수 있다.
     */
    private User authenticate(LoginRequest request) {
        String email = User.normalizeEmail(request.email());
        Authentication authentication;
        try {
            authentication =
                    authenticationManager.authenticate(
                            new UsernamePasswordAuthenticationToken(email, request.password()));
        } catch (AuthenticationException e) {
            // 잠긴 계정으로 들어온 시도(LockedException)도 여기로 온다. 기록하는 쪽에서
            // 이미 잠긴 계정은 횟수를 올리지 않으므로 그대로 넘겨도 된다.
            loginAttemptRecorder.recordFailure(email, Instant.now());
            throw new BadCredentialsException("이메일 또는 비밀번호가 올바르지 않습니다");
        }

        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return userRepository
                .findById(principal.getId())
                .orElseThrow(() -> new BadCredentialsException("이메일 또는 비밀번호가 올바르지 않습니다"));
    }

}
