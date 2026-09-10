package com.axcore.workspace.management;

import com.axcore.workspace.management.dto.AccountingResponse;
import com.axcore.workspace.management.dto.OrgResponse;
import com.axcore.workspace.management.dto.PayrollRunCreateRequest;
import com.axcore.workspace.management.dto.PayrollRunResponse;
import com.axcore.workspace.management.dto.VoucherRejectRequest;
import com.axcore.workspace.management.dto.VoucherResponse;
import com.axcore.workspace.security.JwtPrincipal;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 경영지원 — 인사 · 급여 · 회계. 회사를 고른 토큰(wsid)이어야 하고, 탭 권한과 기능 켜짐은 {@link ManagementAccess} 가 본다.
 */
@RestController
@RequestMapping("/api/workspace/management")
public class ManagementController {

    private final HrService hr;
    private final PayrollService payroll;
    private final AccountingService accounting;

    public ManagementController(HrService hr, PayrollService payroll, AccountingService accounting) {
        this.hr = hr;
        this.payroll = payroll;
        this.accounting = accounting;
    }

    // ---------------------------------------------------------------- 인사

    @GetMapping("/org")
    public OrgResponse org(@AuthenticationPrincipal Jwt jwt) {
        return hr.org(JwtPrincipal.of(jwt));
    }

    // ---------------------------------------------------------------- 급여

    @GetMapping("/payroll")
    public List<PayrollRunResponse> payroll(@AuthenticationPrincipal Jwt jwt) {
        return payroll.list(JwtPrincipal.of(jwt));
    }

    @PostMapping("/payroll")
    public ResponseEntity<PayrollRunResponse> createRun(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PayrollRunCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(payroll.create(JwtPrincipal.of(jwt), request));
    }

    @DeleteMapping("/payroll/{id}")
    public ResponseEntity<Void> deleteRun(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        payroll.delete(JwtPrincipal.of(jwt), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/payroll/{id}/voucher")
    public PayrollRunResponse createVoucher(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        return payroll.createVoucher(JwtPrincipal.of(jwt), id);
    }

    @PostMapping("/payroll/{id}/paid")
    public PayrollRunResponse markPaid(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        return payroll.markPaid(JwtPrincipal.of(jwt), id);
    }

    @PostMapping("/payroll/{id}/recalc")
    public PayrollRunResponse recalc(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        return payroll.recalc(JwtPrincipal.of(jwt), id);
    }

    // ---------------------------------------------------------------- 회계

    @GetMapping("/accounting")
    public AccountingResponse accounting(@AuthenticationPrincipal Jwt jwt) {
        return accounting.list(JwtPrincipal.of(jwt));
    }

    @PostMapping("/accounting/vouchers/{no}/approve")
    public VoucherResponse approve(@AuthenticationPrincipal Jwt jwt, @PathVariable String no) {
        return accounting.approve(JwtPrincipal.of(jwt), no);
    }

    @PostMapping("/accounting/vouchers/{no}/reject")
    public VoucherResponse reject(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String no, @Valid @RequestBody VoucherRejectRequest request) {
        return accounting.reject(JwtPrincipal.of(jwt), no, request.reason());
    }
}
