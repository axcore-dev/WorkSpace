package com.axcore.workspace.management;

import com.axcore.workspace.common.persistence.DbValued;
import com.fasterxml.jackson.annotation.JsonValue;

/** 전표 상태. DB 는 코드, 화면은 한글 표기. */
public enum VoucherStatus implements DbValued {
    REVIEW("review", "검토중"),
    APPROVED("approved", "승인"),
    REJECTED("rejected", "반려");

    private final String dbValue;
    private final String label;

    VoucherStatus(String dbValue, String label) {
        this.dbValue = dbValue;
        this.label = label;
    }

    @Override
    public String dbValue() {
        return dbValue;
    }

    @JsonValue
    public String label() {
        return label;
    }

    public static VoucherStatus fromDb(String value) {
        for (VoucherStatus s : values()) {
            if (s.dbValue.equals(value)) {
                return s;
            }
        }
        throw new IllegalArgumentException("알 수 없는 전표 상태: " + value);
    }
}
