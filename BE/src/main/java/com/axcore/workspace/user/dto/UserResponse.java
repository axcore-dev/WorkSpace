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
 * @param hasPassword   비밀번호를 가진 계정인가. 해시가 아니라 "있는가" 만 나간다. 소셜로만 가입한
 *                      계정은 false 라서 계정 화면이 「비밀번호 변경」 대신 「비밀번호 설정」을
 *                      보여야 하고, 2단계 인증 해제(비밀번호 재확인 필요)도 걸 수 없다.
 * @param avatarUrl     화면이 그대로 {@code <img src>} 에 넣을 주소. 올린 사진이 있으면 우리 경로
 *                      ({@code /api/avatars/...})이고, 없으면 소셜 제공자가 준 주소, 둘 다 없으면 null 이다.
 *                      화면이 둘 중 무엇인지 가릴 필요가 없게 여기서 정한다.
 */
public record UserResponse(
        UUID id,
        String email,
        String name,
        String avatarUrl,
        boolean emailVerified,
        boolean internalAdmin,
        boolean hasPassword,
        Instant passwordChangedAt,
        Instant lastLoginAt,
        Instant createdAt) {

    /** 올린 사진을 내려주는 공개 경로. {@code SecurityConfig} 의 permitAll 목록과 같은 모양이어야 한다. */
    public static final String AVATAR_PATH = "/api/avatars/";

    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getName(),
                avatarUrlOf(user),
                user.isEmailVerified(),
                user.isInternalAdmin(),
                user.hasPassword(),
                user.getPasswordChangedAt(),
                user.getLastLoginAt(),
                user.getCreatedAt());
    }

    /**
     * 올린 사진이 소셜 사진을 이긴다. 키에서 {@code profile/} 접두어만 떼고 나머지를 그대로 붙인다 —
     * 주소가 저장 위치를 그대로 따라가서, 주소만 보고 버킷에서 찾을 수 있다.
     * 접두어는 스토리지 안에서만 쓰는 말이라 URL 에 두 번 나올 이유가 없다.
     */
    private static String avatarUrlOf(User user) {
        String key = user.getAvatarObjectKey();
        if (key == null || key.isBlank()) {
            return user.getAvatarUrl();
        }
        return AVATAR_PATH + key.substring(key.indexOf('/') + 1);
    }
}
