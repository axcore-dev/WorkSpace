package com.axcore.workspace.workspace.admin.controller;

import com.axcore.workspace.external.ExternalConceptTemplates;
import com.axcore.workspace.external.OntologyRules;
import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.admin.dto.ExternalConceptAdminResponse;
import com.axcore.workspace.workspace.admin.dto.ExternalConceptRequest;
import com.axcore.workspace.workspace.admin.service.AdminExternalConceptService;
import com.axcore.workspace.workspace.admin.service.AdminWorkspaceService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
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
import org.springframework.web.bind.annotation.RequestParam;
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

    /**
     * 「AI 로 다듬기」 의 재료 — 개념 · 표 구조 · 값 프로파일 · 통계 규칙 제안. AI 서버가 사용자 토큰으로 부른다.
     * 관리자 판정은 여기 한 곳이다 — AI 서버는 이 응답을 못 받으면 아무것도 못 한다.
     */
    @GetMapping("/concepts/{conceptId}/refine-input")
    public AdminExternalConceptService.RefineInput refineInput(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @PathVariable long conceptId) {
        workspaces.requireInternalAdmin(userId(jwt));
        return concepts.refineInput(id, conceptId);
    }

    /**
     * 템플릿 안의 개념 하나 — 확인 목록의 한 줄.
     *
     * @param table 이 개념이 읽는 표({@code 스키마.표}, 소문자). 화면이 「같은 표를 읽는 개념이 있어요」 를 판정한다. SQL 에서 못 잡으면 null
     */
    public record TemplateConcept(String conceptId, String name, String table) {}

    /** 쓸 수 있는 템플릿. 화면의 「템플릿 적용」 메뉴가 이걸 그리고, 「넣기」 전에 개념마다 확인 목록을 보인다 */
    public record TemplateResponse(String key, String name, String kind, int conceptCount, List<TemplateConcept> concepts) {}

    @GetMapping("/concept-templates")
    public List<TemplateResponse> templates(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        workspaces.requireInternalAdmin(userId(jwt));
        return concepts.templates().stream()
                .map(t -> new TemplateResponse(t.key(), t.name(), t.kind(), t.concepts().size(),
                        t.concepts().stream()
                                .map(c -> new TemplateConcept(c.conceptId(), c.name(),
                                        OntologyRules.fromTable(c.sql()).map(f -> f.schema() + "." + f.table()).orElse(null)))
                                .toList()))
                .toList();
    }

    /** @param conceptIds 넣을 개념 id. 비면 템플릿 전부 */
    public record TemplateApplyRequest(@NotBlank String template, List<@NotBlank String> conceptIds) {}

    /**
     * 템플릿의 개념(체크한 것만)을 이 시스템에 넣는다. 이미 있는 id 는 건너뛴다.
     * <b>이번에 넣은 개념만</b> 돌려준다 — 화면이 행 id 를 받아 토스트의 「되돌리기」({@link #deleteBatch}) 에 쓴다.
     */
    @PostMapping("/systems/{systemId}/concepts/template")
    public List<ExternalConceptAdminResponse> applyTemplate(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @PathVariable long systemId, @Valid @RequestBody TemplateApplyRequest request) {
        UUID actor = userId(jwt);
        workspaces.requireInternalAdmin(actor);
        return concepts.applyTemplate(actor, id, systemId, request.template(), request.conceptIds());
    }

    public record DeleteBatchRequest(@NotEmpty @Size(max = 200) List<Long> ids) {}

    public record DeleteBatchResponse(int deleted) {}

    /** 방금 넣은 묶음(템플릿 · DB 초안)을 한 번에 지운다 — 토스트의 「되돌리기」. 이미 없는 id 는 건너뛴다 */
    @PostMapping("/concepts/delete-batch")
    public DeleteBatchResponse deleteBatch(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @Valid @RequestBody DeleteBatchRequest request) {
        UUID actor = userId(jwt);
        workspaces.requireInternalAdmin(actor);
        return new DeleteBatchResponse(concepts.deleteBatch(actor, id, request.ids()));
    }

    public record PreviewRequest(@NotBlank String sql) {}

    /** SQL 을 그 시스템의 읽기 전용 풀로 5행만 돌려 본다 — 컬럼 이름을 attrs 와 맞추는 용도 */
    @PostMapping("/systems/{systemId}/concepts/preview")
    public AdminExternalConceptService.Preview preview(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @PathVariable long systemId, @Valid @RequestBody PreviewRequest request) {
        workspaces.requireInternalAdmin(userId(jwt));
        return concepts.preview(id, systemId, request.sql());
    }

    /** 외부 DB 의 구조. 「DB 에서 초안 만들기」 모달이 스키마를 고를 때마다 부른다. 데이터는 읽지 않는다 */
    @GetMapping("/systems/{systemId}/introspect")
    public AdminExternalConceptService.Introspection introspect(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @PathVariable long systemId, @RequestParam(required = false) String schema) {
        workspaces.requireInternalAdmin(userId(jwt));
        return concepts.introspect(id, systemId, schema);
    }

    /**
     * @param tables 초안을 만들 표 이름
     * @param prefix 개념 id 접두어(예: {@code mes_}). 비어도 된다
     * @param tab    초안 전부에 붙일 권한 탭
     */
    public record DraftRequest(
            @NotBlank String schema, @NotEmpty List<@NotBlank String> tables, @Size(max = 20) String prefix, @NotBlank String tab) {}

    /** @param ids 넣은 개념의 행 id — 「되돌리기」({@link #deleteBatch}) 에 그대로 보낸다 */
    public record DraftResponse(int added, List<Long> ids) {}

    /** 고른 표를 규칙으로 개념 초안으로 넣는다. 이미 있는 id 는 건너뛴다 */
    @PostMapping("/systems/{systemId}/concepts/draft")
    public DraftResponse draft(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @PathVariable long systemId, @Valid @RequestBody DraftRequest request) {
        UUID actor = userId(jwt);
        workspaces.requireInternalAdmin(actor);
        List<Long> ids = concepts.draft(actor, id, systemId, request.schema(), request.tables(), request.prefix(), request.tab());
        return new DraftResponse(ids.size(), ids);
    }

    private static UUID userId(Jwt jwt) {
        return JwtPrincipal.of(jwt).userId();
    }
}
