package com.axcore.workspace.user.service;

import com.axcore.workspace.security.JwtTokenService;
import com.axcore.workspace.user.dto.LoginResponse;
import com.axcore.workspace.user.dto.UserResponse;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.entity.UserSession;
import com.axcore.workspace.user.repository.UserMfaMethodRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * 인증이 끝난 뒤 세션과 토큰을 발급하는 한 곳.
 *
 * <p>발급 지점이 넷이다 — 로그인, 2단계 통과, refresh 회전, 회사 선택. 각자 토큰을 만들면
 * {@code next} 계산이나 클레임 구성이 조금씩 어긋나고, 그 어긋남은 "특정 경로로 들어왔을 때만
 * 회사가 안 잡힌다" 같은 형태로 나타난다.
 *
 * <p>{@link AuthService} 와 {@link MfaService} 가 서로를 부르지 않게 하는 역할도 한다.
 * 로그인은 2단계 챌린지를 만들어야 하고 2단계 통과는 세션을 발급해야 해서, 발급을 어느 한쪽에
 * 두면 순환 참조가 된다.
 */
@Service
public class SessionIssuer {

    private final RefreshTokenService refreshTokenService;
    private final JwtTokenService jwtTokenService;
    private final UserMfaMethodRepository mfaMethodRepository;

    public SessionIssuer(
            RefreshTokenService refreshTokenService,
            JwtTokenService jwtTokenService,
            UserMfaMethodRepository mfaMethodRepository) {
        this.refreshTokenService = refreshTokenService;
        this.jwtTokenService = jwtTokenService;
        this.mfaMethodRepository = mfaMethodRepository;
    }

    /** 새 세션을 발급한다. 로그인과 2단계 통과가 쓴다. */
    @Transactional
    public AuthResult issueNewSession(
            User user, boolean rememberMe, String userAgent, String ip, Instant now) {
        user.recordLogin(now);
        RefreshTokenService.IssuedRefreshToken refresh =
                refreshTokenService.issue(user, rememberMe, userAgent, ip, now);
        return toResult(user, refresh.session(), refresh.rawToken(), now);
    }

    /**
     * 이미 만들어진 세션으로 결과를 조립한다. refresh 회전이 쓴다.
     *
     * <p>여기서는 {@code recordLogin} 을 하지 않는다. 재발급은 새 로그인이 아니다. 갱신하면
     * "마지막 로그인" 이 15분마다 밀려서 실제로 언제 로그인했는지 알 수 없게 된다.
     */
    public AuthResult fromSession(UserSession session, String rawRefreshToken, Instant now) {
        return toResult(session.getUser(), session, rawRefreshToken, now);
    }

    /**
     * 세션은 그대로 두고 access 토큰만 다시 낸다. 회사 선택이 쓴다.
     *
     * <p>회사를 고르면 {@code wsid} 클레임이 달라져야 하는데, 그것 때문에 refresh 를 회전시킬
     * 이유는 없다. 회전은 재사용 탐지의 장치이지 상태 변경의 장치가 아니다.
     */
    public LoginResponse reissueAccessToken(UserSession session, Instant now) {
        User user = session.getUser();
        JwtTokenService.AccessToken access =
                jwtTokenService.issue(user.getId(), session.getId(), session.getWorkspaceId(), now);
        return LoginResponse.authenticated(
                nextStep(user, session),
                access.value(),
                access.expiresAt(),
                UserResponse.from(user));
    }

    private AuthResult toResult(
            User user, UserSession session, String rawRefreshToken, Instant now) {
        return new AuthResult(
                reissueAccessToken(session, now),
                rawRefreshToken,
                session.getExpiresAt(),
                session.isRememberMe());
    }

    /**
     * 인증이 끝난 뒤 화면이 무엇을 해야 하는지.
     *
     * <p>순서에 의미가 있다. 이메일 확인이 회사 선택보다 앞이다 — 소유가 확인되지 않은 주소로
     * 회사에 들어가면, 오타로 남의 주소를 적은 계정이 그 회사의 데이터를 보게 된다.
     */
    public LoginResponse.AuthStep nextStep(User user, UserSession session) {
        if (!user.isEmailVerified()) {
            return LoginResponse.AuthStep.EMAIL_VERIFICATION_REQUIRED;
        }
        return session.getWorkspaceId() == null
                ? LoginResponse.AuthStep.SELECT_WORKSPACE
                : LoginResponse.AuthStep.READY;
    }

    /**
     * 이 사용자가 2단계를 통과해야 하는가.
     *
     * <p>등록만 하고 확인하지 않은 수단은 세지 않는다. 그러지 않으면 오타 난 주소를 등록한
     * 순간 계정에서 잠긴다.
     */
    @Transactional(readOnly = true)
    public boolean requiresMfa(User user) {
        return !mfaMethodRepository.findByUserIdAndEnabledTrue(user.getId()).isEmpty();
    }
}
