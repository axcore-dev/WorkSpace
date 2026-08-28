package com.axcore.workspace.user.entity;

import com.axcore.workspace.common.persistence.DbValued;
import com.axcore.workspace.common.persistence.DbValuedConverter;
import jakarta.persistence.Converter;

/**
 * MFA 챌린지가 무엇을 위한 것인지. (shared.mfa_challenges.purpose)
 *
 * <p>두 경로를 한 테이블에 담되 값으로 구분한다. 섞이면 안 되기 때문이다 — 등록용 코드로 로그인이
 * 통과되면 2단계가 무력화된다. 검증 시점에 purpose 까지 맞춰 조회한다.
 */
public enum MfaPurpose implements DbValued {

    /** 로그인 도중의 2단계. 통과하면 access·refresh 가 발급된다. */
    LOGIN("login"),

    /** 수단을 켜면서 하는 소유 확인. 통과해도 토큰이 나가지 않는다. 이미 로그인된 상태다. */
    ENROLLMENT("enrollment");

    private final String dbValue;

    MfaPurpose(String dbValue) {
        this.dbValue = dbValue;
    }

    @Override
    public String dbValue() {
        return dbValue;
    }

    @Converter(autoApply = true)
    public static class Mapping extends DbValuedConverter<MfaPurpose> {
        public Mapping() {
            super(MfaPurpose.class);
        }
    }
}
