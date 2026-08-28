package com.axcore.workspace.user.dto;

import com.axcore.workspace.user.entity.UserSession;

import java.time.Instant;
import java.util.UUID;

/**
 * 로그인된 기기 하나.
 *
 * <p>{@code current} 는 access 토큰의 {@code sid} 클레임과 대조해 서버가 채운다. 화면이 스스로
 * 판단하려면 자기 세션 id 를 알아야 하는데, 그러려면 토큰을 파싱해야 한다.
 *
 * <p>토큰 해시는 어떤 형태로도 나가지 않는다. 세션을 끊는 데 필요한 것은 id 뿐이다.
 *
 * @param ip 기록해 둔 접속 IP. 프록시 뒤에서는 프록시의 주소가 잡힌다
 *           ({@code AuthController#clientIp} 주석 참고).
 */
public record SessionResponse(
        UUID id,
        String userAgent,
        String ip,
        boolean rememberMe,
        boolean current,
        Instant createdAt,
        Instant expiresAt) {

    public static SessionResponse from(UserSession session, UUID currentSessionId) {
        return new SessionResponse(
                session.getId(),
                session.getUserAgent(),
                session.getIp(),
                session.isRememberMe(),
                session.getId().equals(currentSessionId),
                session.getCreatedAt(),
                session.getExpiresAt());
    }
}
