package com.axcore.workspace.workspace.entity;

import com.axcore.workspace.common.persistence.DbValued;
import com.axcore.workspace.common.persistence.DbValuedConverter;
import jakarta.persistence.Converter;

/**
 * 소속 상태. (shared.user_workspace_memberships.status — V2 의 CHECK 제약과 같은 목록)
 *
 * <p>{@link #INVITED} 는 초대를 받았지만 아직 수락하지 않은 상태다. 목록에는 보여도 진입은
 * 막아야 한다. 수락 엔드포인트가 붙기 전까지는 {@code active} 로 바뀔 경로가 없다.
 */
public enum MembershipStatus implements DbValued {

    ACTIVE("active"),
    INVITED("invited"),
    SUSPENDED("suspended"),
    LEFT("left");

    private final String dbValue;

    MembershipStatus(String dbValue) {
        this.dbValue = dbValue;
    }

    @Override
    public String dbValue() {
        return dbValue;
    }

    public boolean isEnterable() {
        return this == ACTIVE;
    }

    @Converter(autoApply = true)
    public static class Mapping extends DbValuedConverter<MembershipStatus> {
        public Mapping() {
            super(MembershipStatus.class);
        }
    }
}
