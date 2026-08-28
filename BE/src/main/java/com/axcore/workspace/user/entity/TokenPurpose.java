package com.axcore.workspace.user.entity;

import com.axcore.workspace.common.persistence.DbValued;
import com.axcore.workspace.common.persistence.DbValuedConverter;
import jakarta.persistence.Converter;

import java.time.Duration;

/**
 * 메일로 보내는 일회용 토큰의 용도. (shared.user_tokens.purpose)
 *
 * <p>수명을 여기에 함께 둔다. 두 용도의 성격이 다르기 때문이다. 이메일 확인은 사용자가 편할 때
 * 열어도 되는 링크라 하루를 주고, 비밀번호 재설정은 그 자체가 계정 탈취 경로라 짧게 끊는다.
 */
public enum TokenPurpose implements DbValued {

    /** 가입 직후 보내는 소유 확인 링크. */
    EMAIL_VERIFICATION("email_verification", Duration.ofDays(1)),

    /**
     * 비밀번호 재설정 링크. 이 토큰 한 장이면 비밀번호를 바꿀 수 있으므로 access 토큰보다도
     * 강한 권한이다. 메일함이 열려 있는 시간을 짧게 만드는 것이 유일한 완화책이다.
     */
    PASSWORD_RESET("password_reset", Duration.ofMinutes(30));

    private final String dbValue;
    private final Duration ttl;

    TokenPurpose(String dbValue, Duration ttl) {
        this.dbValue = dbValue;
        this.ttl = ttl;
    }

    @Override
    public String dbValue() {
        return dbValue;
    }

    public Duration ttl() {
        return ttl;
    }

    @Converter(autoApply = true)
    public static class Mapping extends DbValuedConverter<TokenPurpose> {
        public Mapping() {
            super(TokenPurpose.class);
        }
    }
}
