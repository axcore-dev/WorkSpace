package com.axcore.workspace.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

/** 끊긴 세션은 access 토큰 수명(+ 여유) 동안만 막고, 그 뒤엔 표에서 빠진다. 검증기는 sid 가 없는 토큰을 건드리지 않는다 */
class RevokedSessionRegistryTest {

    private final Instant now = Instant.parse("2026-09-16T06:00:00Z");
    private final RevokedSessionRegistry registry =
            new RevokedSessionRegistry(new JwtProperties("test-secret-test-secret-test-secret", "axpoint", Duration.ofMinutes(15), Duration.ofDays(14), Duration.ofHours(12)));

    private Jwt jwt(Map<String, Object> claims) {
        return new Jwt("token", now, now.plus(Duration.ofMinutes(15)), Map.of("alg", "HS256"), claims);
    }

    @Test
    void 끊은_세션은_토큰_수명_동안_막히고_그_뒤엔_빠진다() {
        UUID sid = UUID.randomUUID();
        registry.revoke(sid, now);

        assertTrue(registry.isRevoked(sid, now));
        assertTrue(registry.isRevoked(sid, now.plus(Duration.ofMinutes(15))), "토큰 수명 안");
        assertFalse(registry.isRevoked(sid, now.plus(Duration.ofMinutes(17))), "수명 + 여유가 지나면 풀린다");
        assertEquals(0, registry.size(), "지난 항목은 표에서 빠진다");
    }

    @Test
    void 검증기는_끊긴_sid_만_거절한다() {
        UUID revoked = UUID.randomUUID();
        UUID alive = UUID.randomUUID();
        registry.revokeAll(List.of(revoked), Instant.now());

        assertTrue(registry.validate(jwt(Map.of("sub", "u", "sid", revoked.toString()))).hasErrors());
        assertFalse(registry.validate(jwt(Map.of("sub", "u", "sid", alive.toString()))).hasErrors());
        assertFalse(registry.validate(jwt(Map.of("sub", "u"))).hasErrors(), "sid 가 없으면 다른 검증기 몫");
        assertFalse(registry.validate(jwt(Map.of("sub", "u", "sid", "not-a-uuid"))).hasErrors());
    }

    @Test
    void 끊을_때_지난_항목을_정리한다() {
        registry.revoke(UUID.randomUUID(), now);
        registry.revoke(UUID.randomUUID(), now.plus(Duration.ofMinutes(30)));

        assertEquals(1, registry.size());
    }
}
