package com.axcore.workspace.workspace.admin.entity;

import com.axcore.workspace.common.persistence.DbValued;
import com.axcore.workspace.common.persistence.DbValuedConverter;
import jakarta.persistence.Converter;

/**
 * 운영자가 한 일.
 *
 * <p>{@code deactivate} · {@code activate} 는 화면 어휘(비활성화 · 활성화)를 따른다. 코드
 * 안에서는 중지 · 재개라고 부르지만, 기록은 사람이 화면에서 본 것과 같은 말로 남는 편이 낫다.
 *
 * <p>{@code enter} 가 가장 무거운 항목이다. 운영자가 소속 없이 고객 워크스페이스 안으로
 * 들어간 것이라, 고객 데이터에 손이 닿았을 수 있다는 뜻이다.
 *
 * <p>{@code transfer_owner} 는 담당자 변경으로 테넌트의 소유자 역할이 다른 사람에게 넘어간 것이다.
 * 운영자가 이미 멤버인 사람으로 바꿨을 때, 그리고 새 담당자가 초대를 수락했을 때 남는다. 값을 늘리면
 * {@code shared.admin_audit_logs} 의 CHECK 제약(V13 → V14)도 같이 늘려야 한다.
 */
public enum AdminAuditAction implements DbValued {
    CREATE("create"),
    UPDATE("update"),
    DEACTIVATE("deactivate"),
    ACTIVATE("activate"),
    TERMINATE("terminate"),
    ISSUE_LINK("issue_link"),
    ENTER("enter"),
    TRANSFER_OWNER("transfer_owner");

    private final String dbValue;

    AdminAuditAction(String dbValue) {
        this.dbValue = dbValue;
    }

    @Override
    public String dbValue() {
        return dbValue;
    }

    @Converter(autoApply = true)
    public static class Mapping extends DbValuedConverter<AdminAuditAction> {
        public Mapping() {
            super(AdminAuditAction.class);
        }
    }
}
