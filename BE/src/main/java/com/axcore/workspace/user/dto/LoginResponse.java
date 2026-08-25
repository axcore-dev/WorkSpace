package com.axcore.workspace.user.dto;

import java.time.Instant;

/**
 * 로그인 응답.
 *
 * <p>accessToken 원문이 노출되는 유일한 지점이다. 서버는 해시만 저장하므로
 * 이 응답을 잃어버리면 다시 발급받는 수밖에 없다.
 */
public record LoginResponse(String accessToken, Instant expiresAt, UserResponse user) {
}
