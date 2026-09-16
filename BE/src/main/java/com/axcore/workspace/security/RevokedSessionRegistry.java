package com.axcore.workspace.security;

import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

/**
 * 끊긴 세션 id 를 access 토큰이 만료될 때까지 기억한다 — 세션을 끊는 즉시 그 토큰이 막히게.
 *
 * <p>access 토큰은 서명만 보고 통과하므로, 세션을 끊어도 토큰 수명(15분)까지는 일반 API 가 열려 있었다. 요청마다 세션 표를
 * 조회하는 대신, 끊은 순간 {@code sid} 를 여기 넣고 JWT 검증기가 대조한다. 항목은 토큰 수명이 지나면 저절로 빠진다 — 그 뒤엔
 * 토큰 자체가 만료라 볼 이유가 없다.
 *
 * <p>ponytail: 서버 메모리라 <b>한 대일 때만</b> 정확하다(지금 배포는 한 대). 여러 대가 되면 이 표를 Redis 나 DB 로 옮기고
 * {@link #validate} 만 그쪽을 보게 한다. 서버 재시작으로 비면 그 순간 살아 있던 끊긴 토큰은 만료까지 통과한다 — 재발급 경로가
 * 세션 표를 보므로 그 뒤로는 이어지지 않는다.
 *
 * <p>끊는 쪽 셋이 부른다: 개별 · 「다른 기기 모두」({@code UserSessionService}), 비밀번호 변경 · MFA 해제 · 재사용 감지
 * ({@code SessionRevoker}), 로그아웃({@code RefreshTokenService}).
 */
@Component
public class RevokedSessionRegistry implements OAuth2TokenValidator<Jwt> {

    static final OAuth2Error REVOKED =
            new OAuth2Error("invalid_token", "세션이 끊겼습니다. 다시 로그인해 주세요", null);

    /** 시계가 조금 어긋나도 만료 직전 토큰이 새지 않게 — 토큰 수명에 더한다 */
    private static final Duration SKEW = Duration.ofSeconds(60);

    /** sid → 이 시각까지 막는다 */
    private final ConcurrentHashMap<UUID, Instant> until = new ConcurrentHashMap<>();
    private final Duration keep;

    public RevokedSessionRegistry(JwtProperties properties) {
        this.keep = properties.accessTokenTtl().plus(SKEW);
    }

    public void revoke(UUID sessionId, Instant now) {
        if (sessionId == null) {
            return;
        }
        sweep(now);
        until.put(sessionId, now.plus(keep));
    }

    public void revokeAll(Collection<UUID> sessionIds, Instant now) {
        sweep(now);
        Instant limit = now.plus(keep);
        for (UUID id : sessionIds) {
            if (id != null) {
                until.put(id, limit);
            }
        }
    }

    public boolean isRevoked(UUID sessionId, Instant now) {
        Instant limit = until.get(sessionId);
        if (limit == null) {
            return false;
        }
        if (!limit.isAfter(now)) {
            until.remove(sessionId);
            return false;
        }
        return true;
    }

    /** 만료된 항목 정리 — 끊을 때마다 한 번. 표는 「최근 15분 안에 끊긴 세션」 뿐이라 작다 */
    private void sweep(Instant now) {
        until.entrySet().removeIf(e -> !e.getValue().isAfter(now));
    }

    int size() {
        return until.size();
    }

    /** JWT 검증기 — sid 가 끊긴 세션이면 401(invalid_token). sid 가 없거나 모양이 아니면 다른 검증기에 맡긴다 */
    @Override
    public OAuth2TokenValidatorResult validate(Jwt token) {
        String sid = token.getClaimAsString("sid");
        if (sid == null) {
            return OAuth2TokenValidatorResult.success();
        }
        UUID id;
        try {
            id = UUID.fromString(sid);
        } catch (IllegalArgumentException e) {
            return OAuth2TokenValidatorResult.success();
        }
        return isRevoked(id, Instant.now())
                ? OAuth2TokenValidatorResult.failure(REVOKED)
                : OAuth2TokenValidatorResult.success();
    }
}
