package com.axcore.workspace.workspace.admin.controller;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.admin.dto.AuditLogResponse;
import com.axcore.workspace.workspace.admin.repository.AdminAuditLogRepository;
import com.axcore.workspace.workspace.admin.service.AdminWorkspaceService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * 운영자 행위 조회.
 *
 * <p>읽기만 있다. 기록은 행위가 일어나는 자리에서 자동으로 남고, 나중에 고치거나 지울 수 있는
 * 경로를 열지 않는다 — 고칠 수 있는 기록은 증적이 아니다.
 */
@RestController
@RequestMapping("/api/admin/audit-logs")
public class AdminAuditController {

    private static final int MAX_PAGE_SIZE = 200;

    private final AdminAuditLogRepository auditRepository;
    private final AdminWorkspaceService adminService;

    public AdminAuditController(
            AdminAuditLogRepository auditRepository, AdminWorkspaceService adminService) {
        this.auditRepository = auditRepository;
        this.adminService = adminService;
    }

    /**
     * 최근 것부터.
     *
     * <p>같은 시각의 기록이 여럿일 수 있어 id 를 두 번째 정렬 키로 둔다. 없으면 페이지 경계에서
     * 같은 행이 두 번 나오거나 빠진다.
     *
     * @param workspaceId 주면 그 회사 것만. 상세 화면이 쓴다
     */
    @GetMapping
    public Page<AuditLogResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) Long workspaceId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        adminService.requireInternalAdmin(userId(jwt));
        return auditRepository
                .search(
                        workspaceId,
                        PageRequest.of(
                                Math.max(page, 0),
                                Math.clamp(size, 1, MAX_PAGE_SIZE),
                                Sort.by(Sort.Direction.DESC, "occurredAt", "id")))
                .map(AuditLogResponse::from);
    }

    private static UUID userId(Jwt jwt) {
        return JwtPrincipal.of(jwt).userId();
    }
}
