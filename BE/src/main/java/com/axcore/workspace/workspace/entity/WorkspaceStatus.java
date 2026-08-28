package com.axcore.workspace.workspace.entity;

import com.axcore.workspace.common.persistence.DbValued;
import com.axcore.workspace.common.persistence.DbValuedConverter;
import jakarta.persistence.Converter;

/**
 * 회사(워크스페이스)의 상태. (shared.workspaces.status — V2 의 CHECK 제약과 같은 목록)
 *
 * <p>{@link #PROVISIONING} 은 행은 있지만 테넌트 스키마가 아직 없는 구간이다. 이때 진입시키면
 * 열 스키마가 없으므로 선택 대상에서 뺀다.
 */
public enum WorkspaceStatus implements DbValued {

    PROVISIONING("provisioning"),
    ACTIVE("active"),
    SUSPENDED("suspended"),
    TERMINATED("terminated");

    private final String dbValue;

    WorkspaceStatus(String dbValue) {
        this.dbValue = dbValue;
    }

    @Override
    public String dbValue() {
        return dbValue;
    }

    /** 지금 이 회사로 들어갈 수 있는가. */
    public boolean isEnterable() {
        return this == ACTIVE;
    }

    @Converter(autoApply = true)
    public static class Mapping extends DbValuedConverter<WorkspaceStatus> {
        public Mapping() {
            super(WorkspaceStatus.class);
        }
    }
}
