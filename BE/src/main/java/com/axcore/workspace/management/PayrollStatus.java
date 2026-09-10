package com.axcore.workspace.management;

import com.axcore.workspace.common.persistence.DbValued;
import com.fasterxml.jackson.annotation.JsonValue;

/** 급여 회차 상태. DB 는 코드, 화면은 한글 표기({@code FE/data/pages/management.ts} 의 PayrollStatus 와 같아야 한다). */
public enum PayrollStatus implements DbValued {
    PENDING("pending", "처리 대기"),
    VOUCHERED("vouchered", "전표 생성"),
    REJECTED("rejected", "전표 반려"),
    PAID("paid", "지급 완료");

    private final String dbValue;
    private final String label;

    PayrollStatus(String dbValue, String label) {
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

    public static PayrollStatus fromDb(String value) {
        for (PayrollStatus s : values()) {
            if (s.dbValue.equals(value)) {
                return s;
            }
        }
        throw new IllegalArgumentException("알 수 없는 급여 상태: " + value);
    }
}
