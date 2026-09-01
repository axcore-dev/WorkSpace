package com.axcore.workspace.user.dto;

import com.axcore.workspace.user.entity.User;

import java.time.Instant;
import java.util.UUID;

/**
 * 사용자 응답. passwordHash 는 어떤 경우에도 여기에 담기지 않는다.
 *
 * <p>엔티티를 그대로 직렬화하지 않는 이유가 이것이다. 엔티티에 컬럼이 하나 늘 때마다
 * 응답에 자동으로 새어 나가면 안 된다.
 *
 * @param emailVerified 화면이 "이메일 확인이 필요합니다" 배너를 띄울 근거. 확인 시각 자체는
 *                      쓸 곳이 없어 불리언으로만 내보낸다.
 * @param internalAdmin 권한 판정에 쓰라고 두는 값이 아니다. 인가는 서버가 요청 시점의 DB 로
 *                      다시 본다. 화면이 로그인 직후 운영자를 콘솔로 보낼지 정하는 데만 쓴다.
 *                      access 토큰에 싣지 않는 것과 이유가 다르다 — 토큰은 회수가 늦어서
 *                      안 싣고, 이 응답은 매 요청 DB 를 보므로 담아도 늦지 않는다.
 */
public record UserResponse(
        UUID id,
        String email,
        String name,
        String avatarUrl,
        boolean emailVerified,
        boolean internalAdmin,
        Instant passwordChangedAt,
        Instant lastLoginAt,
        Instant createdAt) {

    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getAvatarUrl(),
                user.isEmailVerified(),
                user.isInternalAdmin(),
                user.getPasswordChangedAt(),
                user.getLastLoginAt(),
                user.getCreatedAt());
    }
}
