package com.axcore.workspace.workspace.admin.controller;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.admin.dto.ExternalSystemAdminResponse;
import com.axcore.workspace.workspace.admin.dto.ExternalSystemRequest;
import com.axcore.workspace.workspace.admin.service.AdminExternalSystemService;
import com.axcore.workspace.workspace.admin.service.AdminWorkspaceService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 운영자 콘솔 › 워크스페이스 › 연동 — 회사의 외부 시스템(ERP · MES …) 등록.
 *
 * <p>고객은 이 표를 만지지 못한다(설정 › 연동은 읽기 전용). {@link AdminWorkspaceController} 와 같은 이유로
 * <b>모든 메서드가 {@code requireInternalAdmin} 을 먼저 부른다.</b>
 */
@RestController
@RequestMapping("/api/admin/workspaces/{id}/systems")
public class AdminExternalSystemController {

    private final AdminWorkspaceService workspaces;
    private final AdminExternalSystemService systems;

    public AdminExternalSystemController(AdminWorkspaceService workspaces, AdminExternalSystemService systems) {
        this.workspaces = workspaces;
        this.systems = systems;
    }

    @GetMapping
    public List<ExternalSystemAdminResponse> list(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        workspaces.requireInternalAdmin(userId(jwt));
        return systems.list(id);
    }

    @PostMapping
    public ResponseEntity<ExternalSystemAdminResponse> create(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @Valid @RequestBody ExternalSystemRequest request) {
        UUID actor = userId(jwt);
        workspaces.requireInternalAdmin(actor);
        return ResponseEntity.status(HttpStatus.CREATED).body(systems.create(actor, id, request));
    }

    /** 전체 교체. 비밀번호만 예외 — 비우면 저장된 값을 유지한다({@link ExternalSystemRequest}). */
    @PutMapping("/{systemId}")
    public ExternalSystemAdminResponse update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id,
            @PathVariable long systemId,
            @Valid @RequestBody ExternalSystemRequest request) {
        UUID actor = userId(jwt);
        workspaces.requireInternalAdmin(actor);
        return systems.update(actor, id, systemId, request);
    }

    @DeleteMapping("/{systemId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @PathVariable long systemId) {
        UUID actor = userId(jwt);
        workspaces.requireInternalAdmin(actor);
        systems.delete(actor, id, systemId);
        return ResponseEntity.noContent().build();
    }

    /** 저장된 접속 정보로 붙어 본다. {@code {ok: true}} 또는 {@code {ok: false, message}}. */
    @PostMapping("/{systemId}/test")
    public Map<String, Object> test(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @PathVariable long systemId) {
        workspaces.requireInternalAdmin(userId(jwt));
        return systems.test(id, systemId)
                .<Map<String, Object>>map(m -> Map.of("ok", false, "message", m))
                .orElse(Map.of("ok", true));
    }

    private static UUID userId(Jwt jwt) {
        return JwtPrincipal.of(jwt).userId();
    }
}
