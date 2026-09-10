package com.axcore.workspace.management.dto;

import com.axcore.workspace.management.VoucherStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 회계 전표. 분개(lines)의 차변 합 = 대변 합.
 *
 * @param kind 매입 · 매출 · 급여 — DB 코드를 화면 표기로 옮긴 값
 */
public record VoucherResponse(
        String no,
        LocalDate date,
        String kind,
        String counterparty,
        String summary,
        long amount,
        Long vat,
        String account,
        String owner,
        VoucherStatus status,
        List<Line> lines,
        Purchase purchase,
        String runId,
        String rejectReason) {

    public record Line(String account, Long debit, Long credit, String memo) {}

    public record Purchase(String item, String code, BigDecimal qty, String unit, long unitPrice) {}
}
