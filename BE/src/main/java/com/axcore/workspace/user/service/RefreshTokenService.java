package com.axcore.workspace.user.service;

import com.axcore.workspace.security.JwtProperties;
import com.axcore.workspace.security.SecureTokens;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.entity.UserSession;
import com.axcore.workspace.user.repository.UserSessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

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

    /** 유예 창 안에서 회전이 거듭돼도 이만큼만 따라간다. 정상 상황에서 1~2 를 넘지 않는다. */
    private static final int MAX_ROTATION_HOPS = 8;

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
                        .findByTokenHashWithUser(SecureTokens.hash(rawToken))
                        .orElseThrow(RefreshTokenService::invalidToken);

        if (current.isReuseAttempt()) {
            // 회전 직후라면 탈취가 아니라 동시 요청일 가능성이 훨씬 높다. 탭 두 개가 같은
            // 쿠키로 동시에 재발급을 부르면 뒤에 도착한 쪽이 항상 이 자리에 온다.
            if (current.isWithinRotationGrace(now)) {
                return reissueWithinGrace(current, now);
            }

            // 유예를 넘겨서 온 옛 토큰은 사본이 돌아다닌다는 뜻이다. 어느 쪽이 진짜인지
            // 가릴 수 없으니 전부 끊는다.
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
                .findByTokenHashWithUser(SecureTokens.hash(rawToken))
                .ifPresent(session -> session.revoke(now));
    }

    /**
     * 유예 창 안에 들어온 옛 토큰을 받아 준다.
     *
     * <p>새 refresh 토큰을 발급하지 않는 것이 핵심이다. raw 값이 {@code null} 이면
     * {@code RefreshCookieFactory} 가 Set-Cookie 를 붙이지 않는다. 여기서 쿠키를 다시 심으면
     * 먼저 처리된 요청이 심어 둔 새 쿠키를 덮어써서, 그쪽이 방금 받은 토큰이 무효가 된다.
     * 쿠키는 브라우저 단위로 공유되므로 이미 새 토큰을 갖고 있다.
     *
     * <p>대신 회전된 세션을 따라가 access 토큰만 다시 끊어 준다. 세션은 늘지 않는다.
     */
    private IssuedRefreshToken reissueWithinGrace(UserSession rotated, Instant now) {
        UserSession successor = activeSuccessorOf(rotated, now);
        if (successor == null) {
            // 회전은 됐는데 이어받을 살아 있는 세션이 없다. 로그아웃했거나 그 사이에 세션이
            // 전부 폐기된 경우다. 공격 징후가 아니므로 전체 폐기까지 갈 일은 아니다.
            throw invalidToken();
        }
        log.debug(
                "회전 유예 창 안의 refresh 재요청 — 세션 {} 대신 {} 의 access 토큰을 재발급한다",
                rotated.getId(),
                successor.getId());
        return new IssuedRefreshToken(successor, null);
    }

    /**
     * {@code rotatedTo} 를 따라가 살아 있는 세션을 찾는다.
     *
     * <p>유예 창 안에 회전이 두 번 일어날 수 있어서 한 칸만 보면 이미 폐기된 세션을 집게 된다.
     * 무한 순환을 막기 위해 hop 수를 제한한다. 정상 상황에서 1~2 를 넘지 않는다.
     */
    private UserSession activeSuccessorOf(UserSession from, Instant now) {
        UserSession cursor = from;
        for (int hop = 0; hop < MAX_ROTATION_HOPS; hop++) {
            UUID nextId = cursor.getRotatedTo();
            if (nextId == null) {
                return null;
            }
            UserSession next = sessionRepository.findById(nextId).orElse(null);
            if (next == null) {
                return null;
            }
            if (next.isActive(now)) {
                return next;
            }
            cursor = next;
        }
        log.warn("회전 체인이 {} 단계를 넘었다. 세션 {} 부터 추적을 멈춘다", MAX_ROTATION_HOPS, from.getId());
        return null;
    }

    private IssuedRefreshToken persist(
            User user, boolean rememberMe, String userAgent, String ip, Instant expiresAt) {
        String raw = SecureTokens.generate();
        UserSession session =
                sessionRepository.save(
                        UserSession.issue(user, SecureTokens.hash(raw), rememberMe, userAgent, ip, expiresAt));
        return new IssuedRefreshToken(session, raw);
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
