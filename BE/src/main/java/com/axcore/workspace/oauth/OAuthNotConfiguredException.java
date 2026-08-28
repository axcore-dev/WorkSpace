package com.axcore.workspace.oauth;

import com.axcore.workspace.user.entity.AuthProvider;

/**
 * 이 제공자의 자격증명이 설정되지 않았다.
 *
 * <p>부팅을 막지 않고 여기까지 미루는 이유는 {@link OAuthProperties} 주석에 있다. 사용자 잘못이
 * 아니라 서버 설정 문제이므로 4xx 가 아니라 503 으로 답한다.
 */
public class OAuthNotConfiguredException extends RuntimeException {

    private final AuthProvider provider;

    public OAuthNotConfiguredException(AuthProvider provider) {
        super("%s 로그인이 설정되지 않았습니다".formatted(provider.dbValue()));
        this.provider = provider;
    }

    public AuthProvider getProvider() {
        return provider;
    }
}
