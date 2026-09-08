package com.axcore.workspace.user.dto;

import com.axcore.workspace.user.entity.AuthProvider;
import com.axcore.workspace.user.entity.UserIdentity;

import java.time.Instant;

/**
 * 계정에 연결된 소셜 제공자 한 줄. 계정 화면의 「소셜 로그인」 목록이 읽는다.
 *
 * <p>{@code providerUserId} 는 내보내지 않는다 — 화면이 쓸 일이 없고, 제공자 쪽 계정을 특정하는 값이다.
 * {@code email} 은 연결하던 시점의 기록이라 지금 제공자 쪽 주소와 다를 수 있다.
 *
 * @param connectedAt 연결한 시각
 */
public record SocialIdentityResponse(AuthProvider provider, String email, Instant connectedAt) {

    public static SocialIdentityResponse from(UserIdentity identity) {
        return new SocialIdentityResponse(
                identity.getProvider(), identity.getEmail(), identity.getCreatedAt());
    }
}
