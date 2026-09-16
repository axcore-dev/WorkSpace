package com.axcore.workspace.user.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.axcore.workspace.security.JwtProperties;
import com.axcore.workspace.security.RevokedSessionRegistry;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.entity.UserSession;
import com.axcore.workspace.user.repository.UserSessionRepository;
import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;

/**
 * 「다른 기기 모두 로그아웃」 — 지금 세션이 살아 있을 때만, 저장소에 <b>지금 세션 id 를 제외하라</b>고 넘기고, 끊은 세션의
 * 토큰이 즉시 막히도록 레지스트리에 넣는지. JPQL 자체는 여기서 돌지 않는다(DB 없음). 저장소는 리플렉션 프록시로 흉내 낸다 —
 * 이 모듈의 다른 서비스 테스트와 같은 방식.
 */
class UserSessionServiceRevokeOthersTest {

    private final Instant now = Instant.parse("2026-09-16T06:00:00Z");
    private final UUID userId = UUID.randomUUID();
    private final UUID currentSid = UUID.randomUUID();
    private final UUID otherSid = UUID.randomUUID();
    private final List<Object[]> revokeCalls = new ArrayList<>();
    private final RevokedSessionRegistry registry =
            new RevokedSessionRegistry(new JwtProperties("test-secret-test-secret-test-secret", "axpoint", Duration.ofMinutes(15), Duration.ofDays(14), Duration.ofHours(12)));

    private UserSessionRepository repository(UserSession current, List<UserSession> active) {
        return (UserSessionRepository) Proxy.newProxyInstance(
                UserSessionRepository.class.getClassLoader(),
                new Class<?>[] {UserSessionRepository.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "findByIdAndUserIdWithUser" -> Optional.ofNullable(current);
                    case "findActiveByUserId" -> active;
                    case "revokeAllByUserIdExcept" -> {
                        revokeCalls.add(args);
                        yield active.size() - 1;
                    }
                    default -> throw new UnsupportedOperationException(method.getName());
                });
    }

    private UserSession session(UUID id, Instant expiresAt) {
        User user = User.create("a@b.c", "x", "이름");
        UserSession s = UserSession.issue(user, "hash", true, "ua", "127.0.0.1", expiresAt);
        try {
            Field f = UserSession.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(s, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
        return s;
    }

    @Test
    void 살아_있는_세션이면_지금_세션만_빼고_끊고_그_토큰을_바로_막는다() {
        UserSession current = session(currentSid, now.plus(Duration.ofDays(1)));
        UserSession other = session(otherSid, now.plus(Duration.ofDays(1)));
        UserSessionService service = new UserSessionService(repository(current, List.of(current, other)), registry);

        int revoked = service.revokeOthers(userId, currentSid, now);

        assertEquals(1, revoked);
        assertEquals(1, revokeCalls.size());
        Object[] args = revokeCalls.get(0);
        assertEquals(userId, args[0]);
        assertEquals(currentSid, args[1], "저장소에 지금 세션 id 를 제외하라고 넘겨야 한다");
        assertEquals(now, args[2]);
        assertTrue(registry.isRevoked(otherSid, now), "끊은 세션의 토큰은 즉시 막혀야 한다");
        assertFalse(registry.isRevoked(currentSid, now), "지금 세션은 막히면 안 된다");
    }

    @Test
    void 이미_끊긴_세션으로는_남의_기기를_못_끊는다() {
        UserSession revokedSession = session(currentSid, now.plus(Duration.ofDays(1)));
        revokedSession.revoke(now.minusSeconds(60));
        UserSessionService service = new UserSessionService(repository(revokedSession, List.of()), registry);

        assertThrows(BadCredentialsException.class, () -> service.revokeOthers(userId, currentSid, now));
        assertEquals(0, revokeCalls.size(), "저장소를 부르기 전에 막혀야 한다");
    }

    @Test
    void 만료된_세션도_마찬가지다() {
        UserSessionService service = new UserSessionService(repository(session(currentSid, now.minusSeconds(1)), List.of()), registry);

        assertThrows(BadCredentialsException.class, () -> service.revokeOthers(userId, currentSid, now));
        assertEquals(0, revokeCalls.size());
    }
}
