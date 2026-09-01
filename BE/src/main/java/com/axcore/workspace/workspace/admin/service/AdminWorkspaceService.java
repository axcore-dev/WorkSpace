package com.axcore.workspace.workspace.admin.service;

import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.repository.UserRepository;
import com.axcore.workspace.workspace.admin.exception.InternalAdminRequiredException;
import com.axcore.workspace.workspace.admin.exception.WorkspaceStateException;
import com.axcore.workspace.workspace.admin.dto.WorkspaceCreateRequest;
import com.axcore.workspace.workspace.admin.dto.WorkspaceResponse;
import com.axcore.workspace.workspace.admin.dto.WorkspaceSummaryResponse;
import com.axcore.workspace.workspace.admin.dto.WorkspaceUpdateRequest;
import com.axcore.workspace.workspace.entity.WorkspaceStatus;
import com.axcore.workspace.workspace.provisioning.TenantProvisioner;
import com.axcore.workspace.workspace.provisioning.TenantProvisioningException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

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

    public AdminWorkspaceService(
            WorkspaceRegistrar registrar,
            TenantProvisioner provisioner,
            UserRepository userRepository) {
        this.registrar = registrar;
        this.provisioner = provisioner;
        this.userRepository = userRepository;
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

    public Page<WorkspaceSummaryResponse> search(
            String keyword, WorkspaceStatus status, Pageable pageable) {
        return registrar.search(keyword, status, pageable).map(WorkspaceSummaryResponse::from);
    }

    public WorkspaceResponse get(Long id) {
        return registrar.detail(id);
    }

    // ── 개설 ───────────────────────────────────────────────────────────────

    /**
     * 워크스페이스를 열고 테넌트 스키마를 만든다.
     *
     * <p>실패하면 {@code provisioning} 상태의 행이 남는다. 지우지 않는 이유는 무엇이 왜
     * 실패했는지가 남아야 하기 때문이고, 그 행은 목록에서 상태로 구분된다. 다시 시도하려면
     * {@link #retryProvisioning(Long)} 을 부른다.
     */
    public WorkspaceResponse create(WorkspaceCreateRequest request) {
        WorkspaceRegistrar.Registration registration = registrar.register(request);
        provision(registration);
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

    public WorkspaceResponse update(Long id, WorkspaceUpdateRequest request) {
        return registrar.update(id, request);
    }

    public WorkspaceResponse suspend(Long id) {
        return registrar.suspend(id);
    }

    public WorkspaceResponse resume(Long id) {
        return registrar.resume(id);
    }

    public WorkspaceResponse terminate(Long id) {
        return registrar.terminate(id);
    }

    public WorkspaceResponse markLinkSent(Long id) {
        return registrar.markLinkSent(id);
    }
}
