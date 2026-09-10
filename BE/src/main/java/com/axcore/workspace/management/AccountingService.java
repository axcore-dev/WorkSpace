package com.axcore.workspace.management;

import com.axcore.workspace.management.dto.AccountingResponse;
import com.axcore.workspace.management.dto.PayrollRunResponse;
import com.axcore.workspace.management.dto.VoucherResponse;
import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.settings.SettingsConflictException;
import com.axcore.workspace.workspace.settings.SettingsNotFoundException;
import com.axcore.workspace.workspace.settings.TenantContext;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 회계 전표. 검토중 → 승인 | 반려. 급여 전표를 반려하면 원 회차가 "전표 반려" 가 된다(급여 작업대에서 다시 계산한다).
 *
 * <p>전표 번호는 {@code V-YYMM-NNN}, 달마다 001 부터. 번호는 서버가 정한다 — 화면의 미리보기 번호는 같은 규칙으로 계산한
 * 추정값이다.
 */
@Service
public class AccountingService {

    private static final Logger log = LoggerFactory.getLogger(AccountingService.class);
    static final String TAB = "accounting";
    static final String STATE_CONFLICT = "VOUCHER_STATE";

    /** 전표 종류 — DB 코드 → 화면 표기. 저장되는 값은 표의 CHECK 제약이 지킨다. */
    private static final Map<String, String> KIND_LABEL = Map.of("purchase", "매입", "sales", "매출", "payroll", "급여");

    private final ManagementAccess access;
    private final JdbcTemplate jdbc;

    public AccountingService(ManagementAccess access, JdbcTemplate jdbc) {
        this.access = access;
        this.jdbc = jdbc;
    }

    /** 그 달 전표 번호의 앞부분 — {@code V-YYMM-}. */
    static String noPrefix(LocalDate date) {
        return String.format("V-%02d%02d-", date.getYear() % 100, date.getMonthValue());
    }

    /** 같은 달 최댓값({@code maxNo}, 없으면 빈 문자열) 다음 번호. */
    static String nextNo(String prefix, String maxNo) {
        int max = maxNo.startsWith(prefix) ? Integer.parseInt(maxNo.substring(prefix.length())) : 0;
        return prefix + String.format("%03d", max + 1);
    }

    @Transactional(readOnly = true)
    public AccountingResponse list(JwtPrincipal principal) {
        access.open(principal, TAB);
        List<AccountingResponse.MonthlyPl> monthly =
                jdbc.query(
                        "select month, sales, cost from monthly_pl order by month",
                        (rs, i) -> new AccountingResponse.MonthlyPl(rs.getObject(1, LocalDate.class), rs.getLong(2), rs.getLong(3)));
        return new AccountingResponse(rows(null), monthly);
    }

    @Transactional
    public VoucherResponse approve(JwtPrincipal principal, String no) {
        TenantContext ctx = access.open(principal, TAB);
        requireReview(no);
        jdbc.update(
                "update vouchers set status = ?, updated_at = now() where no = ?", VoucherStatus.APPROVED.dbValue(), no);
        log.info("워크스페이스 {} 의 전표 {} 를 사용자 {} 가 승인했다", ctx.workspaceId(), no, ctx.userId());
        return rows(no).get(0);
    }

    @Transactional
    public VoucherResponse reject(JwtPrincipal principal, String no, String reason) {
        TenantContext ctx = access.open(principal, TAB);
        VoucherResponse voucher = requireReview(no);
        String trimmed = reason == null || reason.isBlank() ? null : reason.trim();
        jdbc.update(
                "update vouchers set status = ?, reject_reason = ?, updated_at = now() where no = ?",
                VoucherStatus.REJECTED.dbValue(), trimmed, no);
        if (voucher.runId() != null) {
            jdbc.update(
                    "update payroll_runs set status = ?, updated_at = now() where id = ? and status = ?",
                    PayrollStatus.REJECTED.dbValue(), voucher.runId(), PayrollStatus.VOUCHERED.dbValue());
        }
        log.info("워크스페이스 {} 의 전표 {} 를 사용자 {} 가 반려했다", ctx.workspaceId(), no, ctx.userId());
        return rows(no).get(0);
    }

    /**
     * 급여 회차에서 전표를 만든다. 급여 작업대({@link PayrollService})가 회사를 이미 열었으므로 권한을 다시 보지 않는다.
     * 분개: 급여(차) = 총액 · 예수금(대) = 공제 · 보통예금(대) = 실지급.
     */
    String createPayrollVoucher(TenantContext ctx, PayrollRunResponse run, LocalDate date) {
        String prefix = noPrefix(date);
        String no =
                nextNo(
                        prefix,
                        jdbc.queryForObject(
                                "select coalesce(max(no), '') from vouchers where no like ? and no ~ '^V-[0-9]{4}-[0-9]{3}$'",
                                String.class,
                                prefix + "%"));
        String owner = jdbc.queryForObject("select name from shared.users where id = ?", String.class, ctx.userId());
        jdbc.update(
                """
                insert into vouchers (no, voucher_date, kind, counterparty, summary, amount, account, owner_name, status, run_id, created_by)
                values (?, ?, 'payroll', '임직원', ?, ?, '급여', ?, ?, ?, ?)
                """,
                no, date, run.name() + " (" + run.headcount() + "명)", run.gross(), owner,
                VoucherStatus.REVIEW.dbValue(), run.id(), ctx.userId());
        jdbc.update(
                """
                insert into voucher_lines (voucher_no, account, debit, credit, memo, sort) values
                (?, '급여', ?, null, ?, 0),
                (?, '예수금', null, ?, '4대보험 · 소득세', 1),
                (?, '보통예금', null, ?, '실지급', 2)
                """,
                no, run.gross(), run.headcount() + "명", no, run.deduction(), no, run.net());
        return no;
    }

    private VoucherResponse requireReview(String no) {
        List<VoucherResponse> rows = rows(no);
        if (rows.isEmpty()) {
            throw new SettingsNotFoundException("전표를 찾을 수 없습니다");
        }
        if (rows.get(0).status() != VoucherStatus.REVIEW) {
            throw new SettingsConflictException(STATE_CONFLICT, "검토중인 전표만 처리할 수 있습니다");
        }
        return rows.get(0);
    }

    /** no 가 null 이면 전부, 전표일 · 번호 내림차순. */
    private List<VoucherResponse> rows(String no) {
        Map<String, List<VoucherResponse.Line>> lines = new LinkedHashMap<>();
        jdbc.query(
                """
                select voucher_no, account, debit, credit, memo from voucher_lines
                 where (?::varchar is null or voucher_no = ?::varchar)
                 order by voucher_no, sort, id
                """,
                rs -> {
                    lines.computeIfAbsent(rs.getString(1), k -> new ArrayList<>())
                            .add(new VoucherResponse.Line(
                                    rs.getString(2), rs.getObject(3, Long.class), rs.getObject(4, Long.class), rs.getString(5)));
                },
                no, no);
        return jdbc.query(
                """
                select no, voucher_date, kind, counterparty, summary, amount, vat, account, owner_name, status, run_id, reject_reason,
                       purchase_item, purchase_code, purchase_qty, purchase_unit, purchase_unit_price
                  from vouchers
                 where (?::varchar is null or no = ?::varchar)
                 order by voucher_date desc, no desc
                """,
                (rs, i) -> {
                    String item = rs.getString(13);
                    VoucherResponse.Purchase purchase =
                            item == null
                                    ? null
                                    : new VoucherResponse.Purchase(
                                            item, rs.getString(14), rs.getObject(15, BigDecimal.class), rs.getString(16),
                                            rs.getLong(17));
                    return new VoucherResponse(
                            rs.getString(1),
                            rs.getObject(2, LocalDate.class),
                            KIND_LABEL.get(rs.getString(3)),
                            rs.getString(4),
                            rs.getString(5),
                            rs.getLong(6),
                            rs.getObject(7, Long.class),
                            rs.getString(8),
                            rs.getString(9),
                            VoucherStatus.fromDb(rs.getString(10)),
                            lines.getOrDefault(rs.getString(1), List.of()),
                            purchase,
                            rs.getString(11),
                            rs.getString(12));
                },
                no, no);
    }
}
