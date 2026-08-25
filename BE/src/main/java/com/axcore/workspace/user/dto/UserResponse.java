package com.axcore.workspace.user.dto;

import com.axcore.workspace.user.entity.User;

import java.time.Instant;
import java.util.UUID;

/**
 * 사용자 응답. passwordHash 는 어떤 경우에도 여기에 담기지 않는다.
 *
 * <p>엔티티를 그대로 직렬화하지 않는 이유가 이것이다. 엔티티에 컬럼이 하나 늘 때마다
 * 응답에 자동으로 새어 나가면 안 된다.
 */
public record UserResponse(
        UUID id,
        String email,
        String name,
        String avatarUrl,
        Instant passwordChangedAt,
        Instant lastLoginAt,
        Instant createdAt) {

    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getAvatarUrl(),
                user.getPasswordChangedAt(),
                user.getLastLoginAt(),
                user.getCreatedAt());
    }
}
