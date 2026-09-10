package com.axcore.workspace.management;

import com.axcore.workspace.management.dto.PayrollRunCreateRequest;
import com.axcore.workspace.management.dto.PayrollRunResponse;
import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.settings.SettingsConflictException;
import com.axcore.workspace.workspace.settings.SettingsNotFoundException;
import com.axcore.workspace.workspace.settings.TenantContext;
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
 * 급여 회차. 상태는 한 방향으로만 간다: 처리 대기 → 전표 생성 → 지급 완료. 전표가 반려되면 전표 반려 → (재산출) 처리 대기.
 *
 * <p>어긋난 전이는 409({@code PAYROLL_STATE}). 화면이 버튼을 상태에 맞게 보이지만 그건 안내일 뿐이다.
 */
@Service
public class PayrollService {

    private static final Logger log = LoggerFactory.getLogger(PayrollService.class);
    static final String TAB = "payroll";
    static final String STATE_CONFLICT = "PAYROLL_STATE";

    private final ManagementAccess access;
    private final JdbcTemplate jdbc;
    private final AccountingService accounting;

    public PayrollService(ManagementAccess access, JdbcTemplate jdbc, AccountingService accounting) {
        this.access = access;
        this.jdbc = jdbc;
        this.accounting = accounting;
    }

    /** 양수 합 = 총액, 음수 합 = −공제, 실지급 = 총액 − 공제. */
    public record Totals(long gross, long deduction, long net) {}

    public static Totals totals(List<PayrollRunResponse.Item> items) {
        long gross = 0;
        long deduction = 0;
        for (PayrollRunResponse.Item i : items) {
            if (i.amount() >= 0) {
                gross += i.amount();
            } else {
                deduction -= i.amount();
            }
        }
        return new Totals(gross, deduction, gross - deduction);
    }

    @Transactional(readOnly = true)
    public List<PayrollRunResponse> list(JwtPrincipal principal) {
        access.open(principal, TAB);
        return rows(null);
    }

    /** 가장 최근 정기급여 회차(없으면 가장 최근 회차)를 본으로 항목을 복사한다. 회차가 하나도 없으면 빈 항목으로 만든다. */
    @Transactional
    public PayrollRunResponse create(JwtPrincipal principal, PayrollRunCreateRequest request) {
        TenantContext ctx = access.open(principal, TAB);
        List<String> templateIds =
                jdbc.queryForList(
                        """
                        select id from payroll_runs
                         order by (name like '%정기급여%') desc, pay_date desc, created_at desc
                         limit 1
                        """,
                        String.class);
        PayrollRunResponse template = templateIds.isEmpty() ? null : rows(templateIds.get(0)).get(0);

        String base = request.payDate().toString().substring(0, 7);
        String id = base;
        for (int n = 2; exists(id); n++) {
            id = base + "-" + n;
        }
        int headcount =
                template != null
                        ? template.headcount()
                        : jdbc.queryForObject("select count(*) from members where status = 'active'", Integer.class);
        jdbc.update(
                """
                insert into payroll_runs (id, name, headcount, pay_date, status, created_by)
                values (?, ?, ?, ?, ?, ?)
                """,
                id, request.name().trim(), headcount, request.payDate(), PayrollStatus.PENDING.dbValue(), ctx.userId());
        if (template != null) {
            jdbc.update(
                    """
                    insert into payroll_items (run_id, label, amount, note, sort)
                    select ?, label, amount, note, sort from payroll_items where run_id = ?
                    """,
                    id, template.id());
        }
        log.info("워크스페이스 {} 에 급여 회차 {} 를 사용자 {} 가 만들었다(본: {})", ctx.workspaceId(), id, ctx.userId(),
                template == null ? "-" : template.id());
        return rows(id).get(0);
    }

    @Transactional
    public void delete(JwtPrincipal principal, String id) {
        TenantContext ctx = access.open(principal, TAB);
        PayrollRunResponse run = require(id);
        if (run.status() != PayrollStatus.PENDING) {
            throw new SettingsConflictException(STATE_CONFLICT, "처리 대기 회차만 지울 수 있습니다");
        }
        jdbc.update("delete from payroll_runs where id = ?", id);
        log.info("워크스페이스 {} 의 급여 회차 {} 를 사용자 {} 가 지웠다", ctx.workspaceId(), id, ctx.userId());
    }

    /** 처리 대기 → 전표 생성. 급여 전표(검토중)가 회계 작업대에 생긴다. */
    @Transactional
    public PayrollRunResponse createVoucher(JwtPrincipal principal, String id) {
        TenantContext ctx = access.open(principal, TAB);
        PayrollRunResponse run = require(id);
        if (run.status() != PayrollStatus.PENDING) {
            throw new SettingsConflictException(STATE_CONFLICT, "처리 대기 회차만 전표를 만들 수 있습니다");
        }
        String no = accounting.createPayrollVoucher(ctx, run, LocalDate.now());
        jdbc.update(
                "update payroll_runs set status = ?, voucher_no = ?, updated_at = now() where id = ?",
                PayrollStatus.VOUCHERED.dbValue(), no, id);
        log.info("워크스페이스 {} 의 급여 회차 {} 에서 전표 {} 를 사용자 {} 가 만들었다", ctx.workspaceId(), id, no, ctx.userId());
        return rows(id).get(0);
    }

    /** 전표 생성 → 지급 완료. 지급일은 회차의 지급 예정일로 적는다. */
    @Transactional
    public PayrollRunResponse markPaid(JwtPrincipal principal, String id) {
        TenantContext ctx = access.open(principal, TAB);
        PayrollRunResponse run = require(id);
        if (run.status() != PayrollStatus.VOUCHERED) {
            throw new SettingsConflictException(STATE_CONFLICT, "전표가 만들어진 회차만 지급 완료로 바꿀 수 있습니다");
        }
        jdbc.update(
                "update payroll_runs set status = ?, paid_at = pay_date, updated_at = now() where id = ?",
                PayrollStatus.PAID.dbValue(), id);
        log.info("워크스페이스 {} 의 급여 회차 {} 를 사용자 {} 가 지급 완료로 바꿨다", ctx.workspaceId(), id, ctx.userId());
        return rows(id).get(0);
    }

    /** 전표 반려 → 처리 대기. 반려된 전표는 회계에 그대로 남고 회차의 연결만 끊는다. */
    @Transactional
    public PayrollRunResponse recalc(JwtPrincipal principal, String id) {
        TenantContext ctx = access.open(principal, TAB);
        PayrollRunResponse run = require(id);
        if (run.status() != PayrollStatus.REJECTED) {
            throw new SettingsConflictException(STATE_CONFLICT, "전표가 반려된 회차만 다시 계산할 수 있습니다");
        }
        jdbc.update(
                "update payroll_runs set status = ?, voucher_no = null, updated_at = now() where id = ?",
                PayrollStatus.PENDING.dbValue(), id);
        log.info("워크스페이스 {} 의 급여 회차 {} 를 사용자 {} 가 처리 대기로 되돌렸다", ctx.workspaceId(), id, ctx.userId());
        return rows(id).get(0);
    }

    private boolean exists(String id) {
        return Boolean.TRUE.equals(
                jdbc.queryForObject("select exists(select 1 from payroll_runs where id = ?)", Boolean.class, id));
    }

    private PayrollRunResponse require(String id) {
        List<PayrollRunResponse> rows = rows(id);
        if (rows.isEmpty()) {
            throw new SettingsNotFoundException("급여 회차를 찾을 수 없습니다");
        }
        return rows.get(0);
    }

    /** id 가 null 이면 전부, 지급일 내림차순. */
    private List<PayrollRunResponse> rows(String id) {
        Map<String, List<PayrollRunResponse.Item>> items = new LinkedHashMap<>();
        jdbc.query(
                """
                select run_id, label, amount, note from payroll_items
                 where (?::varchar is null or run_id = ?::varchar)
                 order by run_id, sort, id
                """,
                rs -> {
                    items.computeIfAbsent(rs.getString(1), k -> new ArrayList<>())
                            .add(new PayrollRunResponse.Item(rs.getString(2), rs.getLong(3), rs.getString(4)));
                },
                id, id);
        return jdbc.query(
                """
                select id, name, headcount, pay_date, status, voucher_no, paid_at from payroll_runs
                 where (?::varchar is null or id = ?::varchar)
                 order by pay_date desc, created_at desc
                """,
                (rs, i) -> {
                    List<PayrollRunResponse.Item> list = items.getOrDefault(rs.getString(1), List.of());
                    Totals t = totals(list);
                    return new PayrollRunResponse(
                            rs.getString(1),
                            rs.getString(2),
                            rs.getInt(3),
                            rs.getObject(4, LocalDate.class),
                            t.gross(),
                            t.deduction(),
                            t.net(),
                            list,
                            PayrollStatus.fromDb(rs.getString(5)),
                            rs.getString(6),
                            rs.getObject(7, LocalDate.class));
                },
                id, id);
    }
}
