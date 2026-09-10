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
public record SocialIdentityResponse(String provider, String email, Instant connectedAt) {

    /** {@code provider} 는 형제 DTO(MfaMethodResponse 등)와 같이 소문자 {@code dbValue()} 로 낸다. enum 을 그대로 실으면 Jackson 이 {@code name()}(대문자)을 써서 화면이 못 알아본다. */
    public static SocialIdentityResponse from(UserIdentity identity) {
        return new SocialIdentityResponse(
                identity.getProvider().dbValue(), identity.getEmail(), identity.getCreatedAt());
    }
}
