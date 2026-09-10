package com.axcore.workspace.management;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.axcore.workspace.management.dto.PayrollRunResponse;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

/** 순수 규칙만 — 전표 번호와 회차 합계. DB 없이 돈다. */
class ManagementRulesTest {

    @Test
    void 전표_번호는_그_달_최대에_하나를_더한다() {
        String july = AccountingService.noPrefix(LocalDate.of(2026, 7, 6));
        assertEquals("V-2607-", july);
        assertEquals("V-2607-004", AccountingService.nextNo(july, "V-2607-003"));
        assertEquals("V-2607-010", AccountingService.nextNo(july, "V-2607-009"));
        // 그 달 전표가 없으면 빈 문자열이 온다(coalesce)
        assertEquals("V-2607-001", AccountingService.nextNo(july, ""));
        assertEquals("V-2601-001", AccountingService.nextNo(AccountingService.noPrefix(LocalDate.of(2026, 1, 31)), ""));
    }

    @Test
    void 회차_합계는_양수합_음수합_차이다() {
        PayrollService.Totals t =
                PayrollService.totals(
                        List.of(
                                new PayrollRunResponse.Item("기본급", 3_000_000, ""),
                                new PayrollRunResponse.Item("연장수당", 500_000, ""),
                                new PayrollRunResponse.Item("국민연금·건강보험", -300_000, "공제"),
                                new PayrollRunResponse.Item("소득세·지방세", -150_000, "공제")));
        assertEquals(3_500_000, t.gross());
        assertEquals(450_000, t.deduction());
        assertEquals(3_050_000, t.net());
        assertEquals(new PayrollService.Totals(0, 0, 0), PayrollService.totals(List.of()));
    }
}
