package com.axcore.workspace.user.entity;

import com.axcore.workspace.common.persistence.DbValued;
import com.axcore.workspace.common.persistence.DbValuedConverter;
import jakarta.persistence.Converter;

/**
 * 2단계 인증 수단. (shared.user_mfa_methods.method — V2 의 CHECK 제약과 같은 목록)
 *
 * <p>지금 구현된 것은 {@link #EMAIL} 하나다. 나머지는 스키마가 이미 허용하고 있어 값만 맞춰 둔다.
 *
 * <p>{@code TOTP} 가 표준적인 선택이지만 검증된 라이브러리가 필요하고 새 의존성은 승인 사항이다.
 * 이메일 OTP 는 발송 경로를 비밀번호 재설정과 공유해서 추가로 들여올 것이 없다. 대신 보안 수준은
 * 메일 계정의 보안 수준을 넘지 못한다 — 메일함이 뚫리면 2단계가 의미를 잃는다.
 */
public enum MfaMethod implements DbValued {

    TOTP("totp"),
    SMS("sms"),
    EMAIL("email"),
    WEBAUTHN("webauthn");

    private final String dbValue;

    MfaMethod(String dbValue) {
        this.dbValue = dbValue;
    }

    @Override
    public String dbValue() {
        return dbValue;
    }

    /** 지금 서버가 실제로 처리할 수 있는 수단인지. */
    public boolean isSupported() {
        return this == EMAIL;
    }

    @Converter(autoApply = true)
    public static class Mapping extends DbValuedConverter<MfaMethod> {
        public Mapping() {
            super(MfaMethod.class);
        }
    }
}
