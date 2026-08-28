package com.axcore.workspace.user.entity;

import com.axcore.workspace.common.persistence.DbValued;
import com.axcore.workspace.common.persistence.DbValuedConverter;
import jakarta.persistence.Converter;

import java.util.Arrays;
import java.util.Optional;

/**
 * 소셜 로그인 제공자. (shared.user_identities.provider)
 *
 * <p>URL 경로에도 이 값이 그대로 나타난다 — {@code POST /api/auth/oauth/google}. 그래서 경로에서
 * 열거형으로 되돌리는 {@link #from(String)} 을 여기에 둔다. Spring 의 기본 열거형 변환은 상수
 * 이름(대문자)만 받아들여서 소문자 경로가 들어오면 400 이 아니라 500 이 된다.
 */
public enum AuthProvider implements DbValued {
    GOOGLE("google"),
    NAVER("naver");

    private final String dbValue;

    AuthProvider(String dbValue) {
        this.dbValue = dbValue;
    }

    @Override
    public String dbValue() {
        return dbValue;
    }

    /**
     * 경로 조각에서 제공자를 찾는다. 대소문자를 구분하지 않는다.
     *
     * <p>모르는 값이면 빈 값을 돌려준다. 예외를 던지지 않는 이유는 호출하는 쪽이 404 와 400 중
     * 무엇으로 답할지 결정해야 하기 때문이다.
     */
    public static Optional<AuthProvider> from(String value) {
        if (value == null) {
            return Optional.empty();
        }
        String normalized = value.strip().toLowerCase();
        return Arrays.stream(values()).filter(p -> p.dbValue.equals(normalized)).findFirst();
    }

    @Converter(autoApply = true)
    public static class Mapping extends DbValuedConverter<AuthProvider> {
        public Mapping() {
            super(AuthProvider.class);
        }
    }
}
