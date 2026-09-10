package com.axcore.workspace.management.dto;

import com.axcore.workspace.management.PayrollStatus;
import java.time.LocalDate;
import java.util.List;

/** 급여 회차. 총액 · 공제 · 실지급은 항목에서 계산한 값이다(양수 합 = gross, 음수 합 = −deduction). */
public record PayrollRunResponse(
        String id,
        String name,
        int headcount,
        LocalDate payDate,
        long gross,
        long deduction,
        long net,
        List<Item> items,
        PayrollStatus status,
        String voucherNo,
        LocalDate paidAt) {

    /** @param amount 공제는 음수 */
    public record Item(String label, long amount, String note) {}
}
