package com.axcore.workspace.user.service;

import com.axcore.workspace.security.JwtProperties;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.entity.UserSession;
import com.axcore.workspace.user.repository.UserSessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

/**
 * refresh 토큰 발급·회전·폐기.
 *
 * <p>refresh 는 JWT 가 아니라 난수다. 저장해서 폐기할 수 있어야 하는 값에 self-contained 토큰을
 * 쓸 이유가 없다. 어차피 DB 를 보는데 서명까지 검증하는 건 낭비다.
 *
 * <p>DB 에는 원문이 남지 않는다. 유출된 덤프만으로는 로그인할 수 없어야 한다.
 */
@Service
public class RefreshTokenService {

    private static final Logger log = LoggerFactory.getLogger(RefreshTokenService.class);

    /** 256비트. 추측이 불가능한 수준이면 충분하고, 늘려도 얻는 게 없다. */
    private static final int TOKEN_BYTES = 32;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();

    private final UserSessionRepository sessionRepository;
    private final SessionRevoker sessionRevoker;
    private final JwtProperties jwtProperties;

    public RefreshTokenService(
            UserSessionRepository sessionRepository,
            SessionRevoker sessionRevoker,
            JwtProperties jwtProperties) {
        this.sessionRepository = sessionRepository;
        this.sessionRevoker = sessionRevoker;
        this.jwtProperties = jwtProperties;
    }

    @Transactional
    public IssuedRefreshToken issue(
            User user, boolean rememberMe, String userAgent, String ip, Instant now) {
        return persist(
                user,
                rememberMe,
                userAgent,
                ip,
                now.plus(jwtProperties.refreshTtl(rememberMe)));
    }

    /**
     * 재발급. 쓰인 refresh 는 그 자리에서 폐기하고 새 것을 낸다.
     *
     * <p>회전하지 않으면 재사용 탐지가 성립하지 않는다. 한 번 쓴 토큰이 계속 유효하면, 탈취된
     * 사본이 들어와도 정상 요청과 구분할 근거가 없다.
     *
     * <p>만료 시각은 이어받는다. 회전할 때마다 수명을 새로 주면 활성 사용자의 세션이 무한히
     * 연장돼서 "14일" 이 아무 의미가 없어진다.
     */
    @Transactional
    public IssuedRefreshToken rotate(String rawToken, String userAgent, String ip, Instant now) {
        UserSession current =
                sessionRepository
                        .findByTokenHashWithUser(hash(rawToken))
                        .orElseThrow(RefreshTokenService::invalidToken);

        if (current.isReuseAttempt()) {
            // 정상 클라이언트라면 이미 회전된 새 토큰을 들고 있다. 옛 토큰이 다시 왔다는 것은
            // 사본이 돌아다닌다는 뜻이라, 어느 쪽이 진짜인지 가릴 수 없으니 전부 끊는다.
            //
            // 폐기는 별도 트랜잭션이어야 한다. 바로 아래에서 던지는 예외가 이 트랜잭션을
            // 롤백시키기 때문에, 같은 트랜잭션에서 끊으면 끊은 것이 되돌아간다.
            int revoked = sessionRevoker.revokeAll(current.getUser().getId(), now);
            log.warn(
                    "refresh 토큰 재사용 감지 — 사용자 {} 의 세션 {}개를 폐기했다",
                    current.getUser().getId(),
                    revoked);
            throw invalidToken();
        }

        if (!current.isActive(now)) {
            throw invalidToken();
        }

        IssuedRefreshToken next =
                persist(
                        current.getUser(),
                        current.isRememberMe(),
                        userAgent,
                        ip,
                        current.getExpiresAt());
        next.session().selectWorkspace(current.getWorkspaceId());
        current.rotateTo(next.session().getId(), now);
        return next;
    }

    /**
     * 로그아웃. 이미 없거나 폐기된 토큰이어도 조용히 넘어간다.
     *
     * <p>여기서 404 를 주면 "이 토큰은 존재한다"는 정보가 새고, 클라이언트 입장에서도 재시도할
     * 방법이 없는 실패라 쓸모가 없다.
     */
    @Transactional
    public void revoke(String rawToken, Instant now) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        sessionRepository
                .findByTokenHashWithUser(hash(rawToken))
                .ifPresent(session -> session.revoke(now));
    }

    private IssuedRefreshToken persist(
            User user, boolean rememberMe, String userAgent, String ip, Instant expiresAt) {
        String raw = generate();
        UserSession session =
                sessionRepository.save(
                        UserSession.issue(user, hash(raw), rememberMe, userAgent, ip, expiresAt));
        return new IssuedRefreshToken(session, raw);
    }

    private static String generate() {
        byte[] bytes = new byte[TOKEN_BYTES];
        SECURE_RANDOM.nextBytes(bytes);
        return ENCODER.encodeToString(bytes);
    }

    /**
     * BCrypt 가 아니라 SHA-256 인 이유는 이 값이 사람이 고른 문자열이 아니기 때문이다. 256비트
     * 난수는 사전 공격 대상이 아니고, 느린 해시는 재발급 경로에 지연으로만 얹힌다.
     */
    private static String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of()
                    .formatHex(digest.digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 은 모든 JVM 이 제공한다", e);
        }
    }

    /** 없는 토큰·만료된 토큰·재사용을 한 가지 응답으로 합친다. 어느 쪽인지 알려 줄 이유가 없다. */
    private static BadCredentialsException invalidToken() {
        return new BadCredentialsException("세션이 만료되었습니다. 다시 로그인해 주세요");
    }

    /**
     * @param rawToken 이 값이 클라이언트로 나가는 유일한 지점이다. 로그에 남기지 않는다.
     */
    public record IssuedRefreshToken(UserSession session, String rawToken) {
    }
}
