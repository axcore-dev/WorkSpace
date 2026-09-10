package com.axcore.workspace.management.dto;

import java.time.LocalDate;
import java.util.List;

/** 회계 작업대 초기값 — 전표 전부와 월별 손익. */
public record AccountingResponse(List<VoucherResponse> vouchers, List<MonthlyPl> monthly) {

    /** @param month 그 달 1일. 금액은 원 */
    public record MonthlyPl(LocalDate month, long sales, long cost) {}
}
