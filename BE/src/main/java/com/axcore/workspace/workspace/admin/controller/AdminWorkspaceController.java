package com.axcore.workspace.workspace.admin.controller;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.admin.dto.ConsoleStatus;
import com.axcore.workspace.workspace.admin.dto.InvitationCreateRequest;
import com.axcore.workspace.workspace.admin.dto.InvitationIssuedResponse;
import com.axcore.workspace.workspace.admin.dto.InvitationResponse;
import com.axcore.workspace.workspace.admin.dto.WorkspaceCreateRequest;
import com.axcore.workspace.workspace.admin.dto.WorkspaceResponse;
import com.axcore.workspace.workspace.admin.dto.WorkspaceSummaryResponse;
import com.axcore.workspace.workspace.admin.dto.WorkspaceUpdateRequest;
import com.axcore.workspace.workspace.admin.service.AdminWorkspaceService;
import com.axcore.workspace.workspace.entity.WorkspaceStatus;
import com.axcore.workspace.workspace.provisioning.TenantMigrationRunner;
import com.axcore.workspace.workspace.service.WorkspaceInvitationService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 운영자 콘솔의 워크스페이스 관리.
 *
 * <p>워크스페이스는 고객이 직접 만들지 않는다. 계약이 끝난 회사를 우리가 대신 열고 접속 링크를
 * 보낸다. 그래서 이 API 는 전부 운영자 전용이다.
 *
 * <p><b>모든 메서드가 {@link AdminWorkspaceService#requireInternalAdmin} 을 먼저 부른다.</b>
 * {@code SecurityConfig} 의 경로 규칙만으로는 "로그인한 사람" 까지밖에 못 가르고, 운영자
 * 여부는 요청 시점의 DB 값이라 서비스에서 본다. 애너테이션 하나로 처리하지 않는 이유는
 * 빠뜨렸을 때 조용히 열리기 때문이다 — 여기서는 눈에 보이게 반복한다.
 */
@RestController
@RequestMapping("/api/admin/workspaces")
public class AdminWorkspaceController {

    /** 목록 한 페이지의 최대 크기. 운영자 화면이라 크게 두지만 무제한은 아니다. */
    private static final int MAX_PAGE_SIZE = 200;

    private final AdminWorkspaceService service;
    private final TenantMigrationRunner migrationRunner;
    private final WorkspaceInvitationService invitationService;

    public AdminWorkspaceController(
            AdminWorkspaceService service,
            TenantMigrationRunner migrationRunner,
            WorkspaceInvitationService invitationService) {
        this.service = service;
        this.migrationRunner = migrationRunner;
        this.invitationService = invitationService;
    }

    /**
     * 목록. 상호·사업자번호로 찾고 상태로 거른다.
     *
     * @param status {@code provisioning} · {@code active} · {@code suspended} ·
     *     {@code terminated}. 없으면 전체다
     */
    @GetMapping
    public Page<WorkspaceSummaryResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        service.requireInternalAdmin(userId(jwt));
        return service.search(
                keyword,
                parseStatus(status),
                PageRequest.of(
                        Math.max(page, 0),
                        Math.clamp(size, 1, MAX_PAGE_SIZE),
                        Sort.by(Sort.Direction.DESC, "id")));
    }

    @GetMapping("/{id}")
    public WorkspaceResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        service.requireInternalAdmin(userId(jwt));
        return service.get(id);
    }

    /**
     * 개설. 응답이 돌아온 시점에는 테넌트 스키마까지 서 있다.
     *
     * <p>스키마 생성과 마이그레이션이 이 요청 안에서 동기로 돈다. 회사 수가 늘어 느려지면
     * 비동기로 옮겨야 하지만, 그때도 {@code status} 가 이미 진행 상태를 표현하고 있어 화면
     * 계약은 바뀌지 않는다.
     */
    @PostMapping
    public ResponseEntity<WorkspaceResponse> create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody WorkspaceCreateRequest request) {

        UUID actor = userId(jwt);
        service.requireInternalAdmin(actor);
        WorkspaceResponse created = service.create(actor, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * 상세 수정. <b>부분 수정이 아니라 전체 교체다.</b>
     *
     * <p>화면이 상세 폼 전체를 들고 저장을 누르므로 PUT 이 맞다. PATCH 로 두면 null 을
     * "바꾸지 않음" 으로 읽어야 하고, 그러면 값을 비우는 조작을 표현할 수 없다.
     */
    @PutMapping("/{id}")
    public WorkspaceResponse update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id,
            @Valid @RequestBody WorkspaceUpdateRequest request) {

        UUID actor = userId(jwt);
        service.requireInternalAdmin(actor);
        return service.update(actor, id, request);
    }

    /** 개설에 실패해 {@code provisioning} 으로 남은 회사를 다시 시도한다. */
    @PostMapping("/{id}/provision")
    public WorkspaceResponse retryProvisioning(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        service.requireInternalAdmin(userId(jwt));
        return service.retryProvisioning(id);
    }

    /** 진입만 막는다. 스키마와 데이터는 그대로 둔다. */
    @PostMapping("/{id}/suspend")
    public WorkspaceResponse suspend(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        UUID actor = userId(jwt);
        service.requireInternalAdmin(actor);
        return service.suspend(actor, id);
    }

    @PostMapping("/{id}/resume")
    public WorkspaceResponse resume(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        UUID actor = userId(jwt);
        service.requireInternalAdmin(actor);
        return service.resume(actor, id);
    }

    /** 접속 링크를 보냈다고 기록한다. 실제 발송은 별도 기능이다. */
    @PostMapping("/{id}/link-sent")
    public WorkspaceResponse markLinkSent(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        UUID actor = userId(jwt);
        service.requireInternalAdmin(actor);
        return service.markLinkSent(actor, id);
    }

    /**
     * 해지. <b>스키마를 지우지 않는다.</b>
     *
     * <p>상태만 {@code terminated} 로 바꾼다. 실제 {@code DROP SCHEMA} 는 유예기간이 지난 뒤
     * 덤프를 남기고 배치가 한다. 그 배치는 아직 없다.
     */
    @DeleteMapping("/{id}")
    public WorkspaceResponse terminate(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        UUID actor = userId(jwt);
        service.requireInternalAdmin(actor);
        return service.terminate(actor, id);
    }

    /**
     * 접속 링크를 발급한다. <b>메일은 보내지 않는다.</b>
     *
     * <p>응답의 {@code link} 를 콘솔이 복사해 담당자에게 전달한다. 화면의 "접속 링크 복사"
     * 버튼이 이 엔드포인트를 부르면 된다 — 누를 때마다 새 링크가 나가고 이전 링크는 죽는다.
     *
     * <p>{@code link} 는 이 응답에서만 나간다. 토큰은 해시로만 저장해서 나중에 다시 꺼낼 수
     * 없다. 실제로 보낸 사실은 {@code /link-sent} 로 따로 기록한다.
     */
    @PostMapping("/{id}/invitations")
    public ResponseEntity<InvitationIssuedResponse> issueLink(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id,
            @Valid @RequestBody(required = false) InvitationCreateRequest request) {
        UUID actor = userId(jwt);
        service.requireInternalAdmin(actor);
        InvitationIssuedResponse issued =
                invitationService.issueLink(
                        id, request == null ? null : request.email(), actor, Instant.now());
        return ResponseEntity.status(HttpStatus.CREATED).body(issued);
    }

    @GetMapping("/{id}/invitations")
    public List<InvitationResponse> invitations(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        service.requireInternalAdmin(userId(jwt));
        return invitationService.list(id, Instant.now());
    }

    /** 잘못 보낸 링크를 무효화한다. 이미 수락된 초대는 409 다 — 멤버십은 따로 끊어야 한다. */
    @DeleteMapping("/{id}/invitations/{invitationId}")
    public InvitationResponse revokeInvitation(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id,
            @PathVariable UUID invitationId) {
        service.requireInternalAdmin(userId(jwt));
        return invitationService.revoke(id, invitationId, Instant.now());
    }

    /**
     * 전 테넌트 스키마에 밀린 마이그레이션을 적용한다. 배포 후 한 번 돌린다.
     *
     * <p>부팅 경로에 두지 않는 이유는 스키마가 늘수록 부팅이 선형으로 느려지고 인스턴스가
     * 동시에 부팅하면 같은 스키마를 건드리기 때문이다. 지금은 이 엔드포인트가 유일한 호출
     * 지점이고, 나중에 배포 파이프라인의 CLI 커맨드로 옮겨도 안쪽 코드는 그대로다.
     *
     * <p>일부가 실패해도 200 이다. 응답의 {@code failures} 로 어느 회사가 왜 실패했는지
     * 돌려준다 — 한 회사의 실패를 전체 실패로 표현하면 성공한 것들의 결과가 사라진다.
     */
    @PostMapping("/migrate")
    public TenantMigrationRunner.Result migrateAll(@AuthenticationPrincipal Jwt jwt) {
        service.requireInternalAdmin(userId(jwt));
        return migrationRunner.migrateAll();
    }

    private static UUID userId(Jwt jwt) {
        return JwtPrincipal.of(jwt).userId();
    }

    /** 모르는 상태 값은 400 이다. 조용히 전체 목록을 돌려주면 필터가 걸린 줄 알고 오해한다. */
    /**
     * 화면 어휘를 도메인 상태로 옮긴다.
     *
     * <p>응답이 {@code pending} 으로 나가므로 질의도 같은 말을 받아야 한다. DB 값
     * ({@code provisioning})을 받으면 화면이 방금 받은 값으로 되물을 수 없다.
     *
     * @return null 이면 전체(해지 제외). {@code WorkspaceSpecifications} 가 처리한다
     */
    private static WorkspaceStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        return ConsoleStatus.from(status)
                .map(ConsoleStatus::domain)
                .orElseThrow(
                        () ->
                                new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "알 수 없는 상태입니다: " + status));
    }
}
