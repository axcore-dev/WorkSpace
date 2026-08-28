package com.axcore.workspace.user.dto;

import com.axcore.workspace.user.entity.UserMfaMethod;

import java.time.Instant;

/**
 * 사용자가 등록한 2단계 인증 수단 하나.
 *
 * <p>{@code secretRef} 는 내보내지 않는다. 비밀 저장소의 참조 키라 화면이 쓸 일이 없다.
 *
 * @param enabled  실제로 로그인에 걸리는가. 등록만 하고 확인하지 않은 수단은 false 다.
 */
public record MfaMethodResponse(String method, boolean enabled, Instant verifiedAt) {

    public static MfaMethodResponse from(UserMfaMethod method) {
        return new MfaMethodResponse(
                method.getMethod().dbValue(), method.isEnabled(), method.getVerifiedAt());
    }
}
