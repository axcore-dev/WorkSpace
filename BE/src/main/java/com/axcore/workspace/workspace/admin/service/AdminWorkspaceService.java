package com.axcore.workspace.workspace.admin.service;

import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.repository.UserRepository;
import com.axcore.workspace.workspace.admin.entity.AdminAuditAction;
import com.axcore.workspace.workspace.entity.Workspace;
import com.axcore.workspace.workspace.repository.UserWorkspaceMembershipRepository;
import com.axcore.workspace.workspace.admin.exception.InternalAdminRequiredException;
import com.axcore.workspace.workspace.admin.exception.WorkspaceStateException;
import com.axcore.workspace.workspace.admin.dto.WorkspaceCreateRequest;
import com.axcore.workspace.workspace.admin.dto.WorkspaceResponse;
import com.axcore.workspace.workspace.admin.dto.WorkspaceSummaryResponse;
import com.axcore.workspace.workspace.admin.dto.WorkspaceUpdateRequest;
import com.axcore.workspace.workspace.admin.dto.WorkspaceUpdateResponse;
import com.axcore.workspace.workspace.entity.WorkspaceStatus;
import com.axcore.workspace.workspace.provisioning.TenantProvisioner;
import com.axcore.workspace.workspace.provisioning.TenantProvisioningException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 워크스페이스 개설·관리. 운영자만 쓴다.
 *
 * <p>고객이 사업자번호로 검색해 직접 만드는 방식(PRD 2.2)을 쓰지 않는다. 계약이 끝난 회사를
 * 우리가 대신 열고 접속 링크를 보낸다.
 *
 * <p><b>이 클래스에는 {@code @Transactional} 이 거의 없다.</b> DB 작업은 전부
 * {@link WorkspaceRegistrar} 가 하고 여기서는 순서만 잡는다. 개설이 세 덩어리로 나뉘기
 * 때문이다.
 *
 * <ol>
 *   <li>{@code shared.workspaces} INSERT — PK 를 채번받아야 스키마 이름을 만들 수 있다
 *   <li>{@code CREATE SCHEMA} + 테넌트 마이그레이션 — <b>트랜잭션 밖</b>. Flyway 가 자기
 *       커넥션에서 자기 트랜잭션으로 돈다
 *   <li>상태를 {@code active} 로 — 스키마가 실제로 선 뒤에만
 * </ol>
 *
 * <p>1번과 2번을 한 트랜잭션에 넣으면 안 된다. Flyway 는 다른 커넥션을 쓰므로 아직 커밋되지
 * 않은 행을 볼 수 없고, DDL 이 도는 내내 그 커넥션을 붙잡고 있게 된다. 대신 {@code status} 로
 * 어디까지 됐는지를 표현한다 — {@code provisioning} 상태로 오래 머문 행이 곧 실패한 개설이다.
 */
@Service
public class AdminWorkspaceService {

    private static final Logger log = LoggerFactory.getLogger(AdminWorkspaceService.class);

    private final WorkspaceRegistrar registrar;
    private final TenantProvisioner provisioner;
    private final UserRepository userRepository;
    private final UserWorkspaceMembershipRepository membershipRepository;
    private final WorkspaceMemberReader memberReader;
    private final WorkspaceContactService contacts;
    private final AdminAuditRecorder audit;

    public AdminWorkspaceService(
            WorkspaceRegistrar registrar,
            TenantProvisioner provisioner,
            UserRepository userRepository,
            UserWorkspaceMembershipRepository membershipRepository,
            WorkspaceMemberReader memberReader,
            WorkspaceContactService contacts,
            AdminAuditRecorder audit) {
        this.registrar = registrar;
        this.provisioner = provisioner;
        this.userRepository = userRepository;
        this.membershipRepository = membershipRepository;
        this.memberReader = memberReader;
        this.contacts = contacts;
        this.audit = audit;
    }

    /**
     * 운영자인지 확인한다. 모든 진입점이 이걸 먼저 부른다.
     *
     * <p><b>토큰이 아니라 DB 를 본다.</b> access 토큰은 최대 TTL 만큼 살아 있어서, 클레임으로
     * 두면 권한을 회수해도 그 시간 동안 계속 통한다. 회사 선택이 매번 소속을 다시 확인하는
     * 것과 같은 판단이다({@code WorkspaceService#select}).
     */
    @Transactional(readOnly = true)
    public void requireInternalAdmin(UUID userId) {
        User user =
                userRepository.findById(userId).orElseThrow(InternalAdminRequiredException::new);
        if (!user.isInternalAdmin()) {
            log.warn("운영자가 아닌 계정 {} 가 운영자 API 를 호출했다", userId);
            throw new InternalAdminRequiredException();
        }
    }

    // ── 조회 ───────────────────────────────────────────────────────────────

    /**
     * 목록. 구성원 수는 한 번의 집계 질의로 붙인다.
     *
     * @param status null 이면 해지를 뺀 전부. 해지된 회사는 명시적으로 골라야 보인다
     */
    @Transactional(readOnly = true)
    public Page<WorkspaceSummaryResponse> search(
            String keyword, WorkspaceStatus status, Pageable pageable) {
        Page<Workspace> page = registrar.search(keyword, status, pageable);

        List<Long> ids = page.getContent().stream().map(Workspace::getId).toList();
        Map<Long, Long> counts =
                ids.isEmpty()
                        ? Map.of()
                        : membershipRepository.countByWorkspaceIds(ids).stream()
                                .collect(
                                        Collectors.toMap(
                                                UserWorkspaceMembershipRepository.MemberCount
                                                        ::getWorkspaceId,
                                                UserWorkspaceMembershipRepository.MemberCount
                                                        ::getMemberCount));

        // 집계에 없는 회사는 구성원이 0명이다. 없는 키를 0 으로 읽는 책임이 여기에 있다.
        return page.map(
                w ->
                        WorkspaceSummaryResponse.from(
                                w, counts.getOrDefault(w.getId(), 0L).intValue()));
    }

    /**
     * 상세. 구성원과 마지막 활동은 테넌트 스키마에서 읽는다.
     *
     * <p>한 트랜잭션 안에서 {@code search_path} 를 열었다 닫는다. 열어 둔 상태로 다른 조회가
     * 섞여도 {@code shared} 엔티티는 스키마를 명시하고 있어 영향이 없다.
     */
    @Transactional(readOnly = true)
    public WorkspaceResponse get(Long id) {
        String schemaName = registrar.schemaNameOf(id);
        return registrar
                .detail(id, memberReader.membersOf(schemaName), memberReader.lastActiveAt(schemaName))
                // 담당자가 구성원인지 · 초대 대기인지. 상세 화면의 「접속 링크」 버튼이 이걸 보고 동작을 정한다.
                .withContactStatus(contacts.statusOf(id, Instant.now()));
    }

    // ── 개설 ───────────────────────────────────────────────────────────────

    /**
     * 워크스페이스를 열고 테넌트 스키마를 만든다.
     *
     * <p>실패하면 {@code provisioning} 상태의 행이 남는다. 지우지 않는 이유는 무엇이 왜
     * 실패했는지가 남아야 하기 때문이고, 그 행은 목록에서 상태로 구분된다. 다시 시도하려면
     * {@link #retryProvisioning(Long)} 을 부른다.
     */
    public WorkspaceResponse create(UUID actor, WorkspaceCreateRequest request) {
        WorkspaceRegistrar.Registration registration = registrar.register(request);
        provision(registration);
        audit.record(actor, AdminAuditAction.CREATE, registration.id(), null);
        return registrar.detail(registration.id());
    }

    /**
     * 실패한 개설을 다시 시도한다.
     *
     * <p>{@code CREATE SCHEMA IF NOT EXISTS} 와 Flyway 이력 덕분에 두 번 돌아도 안전하다.
     * 스키마만 남고 테이블이 없는 상태에서도 이어서 적용된다.
     */
    public WorkspaceResponse retryProvisioning(Long id) {
        WorkspaceStatus status = registrar.status(id);
        if (status != WorkspaceStatus.PROVISIONING) {
            throw new WorkspaceStateException(
                    "개설 중인 워크스페이스만 다시 시도할 수 있습니다: " + status.dbValue());
        }
        provision(registrar.readRegistration(id));
        return registrar.detail(id);
    }

    /** 2·3단계. 마이그레이션은 트랜잭션 밖에서 돈다. */
    private void provision(WorkspaceRegistrar.Registration registration) {
        String version;
        try {
            version = provisioner.provision(registration.schemaName(), registration.label());
        } catch (RuntimeException e) {
            // 행은 provisioning 상태로 남는다. 스키마는 롤백돼 없거나 비어 있다 —
            // PostgreSQL 은 DDL 이 트랜잭션 안에서 롤백되고, 테넌트 마이그레이션은
            // group(true) 로 한 덩어리다.
            log.error(
                    "워크스페이스 {} 프로비저닝 실패. 상태를 provisioning 으로 남긴다",
                    registration.id(),
                    e);
            throw new TenantProvisioningException(registration.schemaName(), e);
        }
        registrar.activate(registration.id(), version);
        log.info(
                "워크스페이스 {} 개설 완료. 스키마 {} (v{})",
                registration.id(),
                registration.schemaName(),
                version);
    }

    // ── 수정·상태 ──────────────────────────────────────────────────────────

    /**
     * 정보 수정.
     *
     * <p>어떤 필드가 바뀌었는지는 남기지 않는다(전체 교체 방식). 단 하나 <b>담당자 이메일</b>만
     * 예외다 — 담당자 = 테넌트 소유자라는 규칙이 있어서, 바뀌면 소유자 이전이나 초대 발급이 뒤따라야
     * 한다. 그 비교와 후속 처리는 {@link WorkspaceContactService} 가 저장과 한 트랜잭션으로 한다.
     */
    public WorkspaceUpdateResponse update(UUID actor, Long id, WorkspaceUpdateRequest request) {
        return contacts.update(actor, id, request, Instant.now());
    }

    public WorkspaceResponse suspend(UUID actor, Long id) {
        WorkspaceResponse result = registrar.suspend(id);
        audit.record(actor, AdminAuditAction.DEACTIVATE, id, null);
        return result;
    }

    public WorkspaceResponse resume(UUID actor, Long id) {
        WorkspaceResponse result = registrar.resume(id);
        audit.record(actor, AdminAuditAction.ACTIVATE, id, null);
        return result;
    }

    public WorkspaceResponse terminate(UUID actor, Long id) {
        WorkspaceResponse result = registrar.terminate(id);
        audit.record(actor, AdminAuditAction.TERMINATE, id, null);
        return result;
    }

    /** 링크를 다른 경로로 보냈다는 기록. 발급은 {@code WorkspaceInvitationService} 가 한다. */
    public WorkspaceResponse markLinkSent(UUID actor, Long id) {
        WorkspaceResponse result = registrar.markLinkSent(id);
        audit.record(actor, AdminAuditAction.ISSUE_LINK, id, "접속 링크 발송 기록");
        return result;
    }
}
