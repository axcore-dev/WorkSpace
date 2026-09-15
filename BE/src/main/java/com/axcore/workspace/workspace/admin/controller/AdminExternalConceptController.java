package com.axcore.workspace.workspace.admin.controller;

import com.axcore.workspace.external.ExternalConceptTemplates;
import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.admin.dto.ExternalConceptAdminResponse;
import com.axcore.workspace.workspace.admin.dto.ExternalConceptRequest;
import com.axcore.workspace.workspace.admin.service.AdminExternalConceptService;
import com.axcore.workspace.workspace.admin.service.AdminWorkspaceService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
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
 * 운영자 콘솔 › 워크스페이스 › 연동 — 외부 시스템의 개념(온톨로지).
 *
 * <p>{@link AdminWorkspaceController} 와 같은 이유로 <b>모든 메서드가 {@code requireInternalAdmin} 을 먼저 부른다.</b>
 * 개념은 회사 안에서 유일한 id 를 가지므로 목록 · 수정 · 삭제는 회사 단위 경로이고, 등록 · 템플릿 · 미리보기만 시스템 아래다.
 */
@RestController
@RequestMapping("/api/admin/workspaces/{id}")
public class AdminExternalConceptController {

    private final AdminWorkspaceService workspaces;
    private final AdminExternalConceptService concepts;

    public AdminExternalConceptController(AdminWorkspaceService workspaces, AdminExternalConceptService concepts) {
        this.workspaces = workspaces;
        this.concepts = concepts;
    }

    /** 이 회사의 개념 전부(시스템 순서). 온톨로지 화면이 한 번에 받는다 */
    @GetMapping("/concepts")
    public List<ExternalConceptAdminResponse> list(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        workspaces.requireInternalAdmin(userId(jwt));
        return concepts.list(id);
    }

    @PostMapping("/systems/{systemId}/concepts")
    public ResponseEntity<ExternalConceptAdminResponse> create(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @PathVariable long systemId, @Valid @RequestBody ExternalConceptRequest request) {
        UUID actor = userId(jwt);
        workspaces.requireInternalAdmin(actor);
        return ResponseEntity.status(HttpStatus.CREATED).body(concepts.create(actor, id, systemId, request));
    }

    @PutMapping("/concepts/{conceptId}")
    public ExternalConceptAdminResponse update(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @PathVariable long conceptId, @Valid @RequestBody ExternalConceptRequest request) {
        UUID actor = userId(jwt);
        workspaces.requireInternalAdmin(actor);
        return concepts.update(actor, id, conceptId, request);
    }

    @DeleteMapping("/concepts/{conceptId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @PathVariable long conceptId) {
        UUID actor = userId(jwt);
        workspaces.requireInternalAdmin(actor);
        concepts.delete(actor, id, conceptId);
        return ResponseEntity.noContent().build();
    }

    /** 쓸 수 있는 템플릿. 화면의 「템플릿 적용」 메뉴가 이걸 그린다 */
    public record TemplateResponse(String key, String name, String kind, int conceptCount) {}

    @GetMapping("/concept-templates")
    public List<TemplateResponse> templates(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        workspaces.requireInternalAdmin(userId(jwt));
        return concepts.templates().stream()
                .map(t -> new TemplateResponse(t.key(), t.name(), t.kind(), t.concepts().size())).toList();
    }

    public record TemplateApplyRequest(@NotBlank String template) {}

    /** 템플릿의 개념을 이 시스템에 넣는다. 이미 있는 id 는 건너뛴다. 그 시스템의 개념 전부를 돌려준다 */
    @PostMapping("/systems/{systemId}/concepts/template")
    public List<ExternalConceptAdminResponse> applyTemplate(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @PathVariable long systemId, @Valid @RequestBody TemplateApplyRequest request) {
        UUID actor = userId(jwt);
        workspaces.requireInternalAdmin(actor);
        return concepts.applyTemplate(actor, id, systemId, request.template());
    }

    public record PreviewRequest(@NotBlank String sql) {}

    /** SQL 을 그 시스템의 읽기 전용 풀로 5행만 돌려 본다 — 컬럼 이름을 attrs 와 맞추는 용도 */
    @PostMapping("/systems/{systemId}/concepts/preview")
    public AdminExternalConceptService.Preview preview(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @PathVariable long systemId, @Valid @RequestBody PreviewRequest request) {
        workspaces.requireInternalAdmin(userId(jwt));
        return concepts.preview(id, systemId, request.sql());
    }

    private static UUID userId(Jwt jwt) {
        return JwtPrincipal.of(jwt).userId();
    }
}
