package com.axcore.workspace.management;

import com.axcore.workspace.common.persistence.DbValued;
import com.fasterxml.jackson.annotation.JsonValue;

/** 전표 종류. DB 는 코드, 화면은 한글 표기. */
public enum VoucherKind implements DbValued {
    PURCHASE("purchase", "매입"),
    SALES("sales", "매출"),
    PAYROLL("payroll", "급여");

    private final String dbValue;
    private final String label;

    VoucherKind(String dbValue, String label) {
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

    public static VoucherKind fromDb(String value) {
        for (VoucherKind k : values()) {
            if (k.dbValue.equals(value)) {
                return k;
            }
        }
        throw new IllegalArgumentException("알 수 없는 전표 종류: " + value);
    }
}
