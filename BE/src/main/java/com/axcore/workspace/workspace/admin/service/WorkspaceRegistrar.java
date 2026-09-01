package com.axcore.workspace.workspace.admin.service;

import com.axcore.workspace.workspace.admin.exception.DuplicateBizNumberException;
import com.axcore.workspace.workspace.admin.exception.WorkspaceNotFoundException;
import com.axcore.workspace.workspace.admin.exception.WorkspaceStateException;
import com.axcore.workspace.workspace.admin.dto.WorkspaceCreateRequest;
import com.axcore.workspace.workspace.admin.dto.WorkspaceMemberResponse;
import com.axcore.workspace.workspace.admin.dto.WorkspaceResponse;
import com.axcore.workspace.workspace.admin.dto.WorkspaceSiteRequest;
import com.axcore.workspace.workspace.admin.dto.WorkspaceUpdateRequest;
import com.axcore.workspace.workspace.entity.Workspace;
import com.axcore.workspace.workspace.entity.WorkspaceSite;
import com.axcore.workspace.workspace.entity.WorkspaceStatus;
import com.axcore.workspace.workspace.repository.WorkspaceRepository;
import com.axcore.workspace.workspace.repository.WorkspaceSpecifications;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Set;

/**
 * {@code shared.workspaces} 에 대한 트랜잭션 단위 작업.
 *
 * <p>{@link AdminWorkspaceService} 와 나뉘어 있는 이유는 <b>스프링 프록시</b> 때문이다. 개설은
 * "행 INSERT(커밋) → 스키마 생성(트랜잭션 밖) → 상태 변경(커밋)" 세 덩어리인데, 이 셋을 한
 * 클래스에 두고 서로 부르면 {@code @Transactional} 이 통째로 무시된다. 자기 자신을 부르는
 * 호출은 프록시를 거치지 않기 때문이다. 그러면 세 단계가 하나의 트랜잭션도, 세 개의 트랜잭션도
 * 아닌 상태가 된다.
 *
 * <p><b>엔티티를 밖으로 내보내지 않는다.</b> 사업장·참조 수신이 지연 로딩이라, 트랜잭션이 끝난
 * 뒤 응답을 만들면 세션이 닫혀 실패한다. 매핑까지 여기서 끝내고 DTO 만 돌려준다.
 */
@Service
public class WorkspaceRegistrar {

    private static final Logger log = LoggerFactory.getLogger(WorkspaceRegistrar.class);

    private final WorkspaceRepository workspaceRepository;

    public WorkspaceRegistrar(WorkspaceRepository workspaceRepository) {
        this.workspaceRepository = workspaceRepository;
    }

    /**
     * 1단계 — 행을 만들고 스키마 이름을 붙인다. 이 트랜잭션이 커밋돼야 PK 가 확정된다.
     *
     * @return 만들어진 워크스페이스의 id 와 스키마 이름
     */
    @Transactional
    public Registration register(WorkspaceCreateRequest request) {
        workspaceRepository
                .findByBizNumber(request.bizNumber())
                .ifPresent(
                        existing -> {
                            throw new DuplicateBizNumberException(
                                    request.bizNumber(), existing.getName());
                        });

        Workspace workspace = Workspace.open(request.name(), request.bizNumber());
        workspace.changeCeoName(request.ceoName());
        applyPlan(workspace, request.plan());
        workspace.updateCompanyInfo(
                request.corpNumber(),
                request.bizType(),
                request.bizItem(),
                request.address(),
                request.website(),
                request.taxEmail(),
                request.memo(),
                request.operatorName());
        applyContacts(workspace, request.contacts());
        workspace.replaceSites(toSites(request.sites()));

        Workspace saved = workspaceRepository.save(workspace);
        // 채번된 PK 로 스키마 이름을 계산해 같은 트랜잭션에서 저장한다. 파생값이지만 저장하는
        // 이유는, 접두사·자릿수 규칙이 바뀌어도 이미 만들어진 스키마를 찾을 수 있어야 하기
        // 때문이다. 계산으로만 두면 규칙 변경이 곧 전 테넌트 장애다.
        String schema = saved.assignSchema();

        log.info("워크스페이스 {} 행을 만들었다. 스키마 {} 는 아직 없다", saved.getId(), schema);
        return new Registration(
                saved.getId(),
                schema,
                "%s / biz %s".formatted(saved.getName(), saved.getBizNumber()));
    }

    /** 프로비저닝에 필요한 값만 꺼낸다. 재시도 경로가 쓴다. */
    @Transactional(readOnly = true)
    public Registration readRegistration(Long id) {
        Workspace workspace = require(id);
        if (workspace.getSchemaName() == null) {
            throw new IllegalStateException("스키마 이름이 없는 워크스페이스입니다: " + id);
        }
        return new Registration(
                workspace.getId(),
                workspace.getSchemaName(),
                "%s / biz %s".formatted(workspace.getName(), workspace.getBizNumber()));
    }

    /** 3단계 — 스키마가 실제로 선 뒤에만 부른다. */
    @Transactional
    public void activate(Long id, String schemaVersion) {
        require(id).activate(schemaVersion);
    }

    @Transactional(readOnly = true)
    public WorkspaceStatus status(Long id) {
        return require(id).getStatus();
    }

    // ── 조회 ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public WorkspaceResponse detail(Long id) {
        return WorkspaceResponse.from(require(id));
    }

    /** 개설 전이면 null. 구성원을 읽을 스키마가 아직 없다는 뜻이다. */
    @Transactional(readOnly = true)
    public String schemaNameOf(Long id) {
        return require(id).getSchemaName();
    }

    /**
     * 구성원까지 담은 상세.
     *
     * <p>구성원은 테넌트 스키마에 있어 JPA 로 못 읽는다. 읽는 일은 부르는 쪽이 하고 여기서는
     * 받아서 합치기만 한다 — 등록·상태 전이를 다루는 이 클래스가 스키마를 여는 일까지 맡으면
     * 트랜잭션 경계가 뒤섞인다.
     */
    @Transactional(readOnly = true)
    public WorkspaceResponse detail(
            Long id, List<WorkspaceMemberResponse> members, Instant lastActiveAt) {
        return WorkspaceResponse.from(require(id), members, lastActiveAt);
    }

    @Transactional(readOnly = true)
    public Page<Workspace> search(String keyword, WorkspaceStatus status, Pageable pageable) {
        return workspaceRepository.findAll(
                WorkspaceSpecifications.search(keyword, status), pageable);
    }

    /**
     * 순회 배포 대상.
     *
     * <p>{@code suspended} 를 포함한다. 진입만 막힌 것이지 데이터는 살아 있고, 재개했을 때
     * 혼자만 구조가 뒤처져 있으면 안 된다.
     */
    @Transactional(readOnly = true)
    public List<Workspace> findAllMigratable() {
        return workspaceRepository.findByStatusInAndSchemaNameIsNotNullOrderByIdAsc(
                List.of(WorkspaceStatus.ACTIVE, WorkspaceStatus.SUSPENDED));
    }

    @Transactional
    public void recordSchemaVersion(Long id, String schemaVersion) {
        require(id).recordSchemaVersion(schemaVersion);
    }

    // ── 수정 ───────────────────────────────────────────────────────────────

    @Transactional
    public WorkspaceResponse update(Long id, WorkspaceUpdateRequest request) {
        Workspace workspace = require(id);
        workspace.rename(request.name());
        workspace.changeCeoName(request.ceoName());
        applyPlan(workspace, request.plan());
        workspace.updateCompanyInfo(
                request.corpNumber(),
                request.bizType(),
                request.bizItem(),
                request.address(),
                request.website(),
                request.taxEmail(),
                request.memo(),
                request.operatorName());
        applyContacts(workspace, request.contacts());
        workspace.replaceSites(toSites(request.sites()));
        return WorkspaceResponse.from(workspace);
    }

    @Transactional
    public WorkspaceResponse suspend(Long id) {
        Workspace workspace = require(id);
        if (workspace.getStatus() != WorkspaceStatus.ACTIVE) {
            throw new WorkspaceStateException("운영 중인 워크스페이스만 중지할 수 있습니다");
        }
        workspace.suspend();
        log.info("워크스페이스 {} 를 중지했다", id);
        return WorkspaceResponse.from(workspace);
    }

    @Transactional
    public WorkspaceResponse resume(Long id) {
        Workspace workspace = require(id);
        if (workspace.getStatus() != WorkspaceStatus.SUSPENDED) {
            throw new WorkspaceStateException("중지된 워크스페이스만 재개할 수 있습니다");
        }
        workspace.resume();
        log.info("워크스페이스 {} 를 재개했다", id);
        return WorkspaceResponse.from(workspace);
    }

    /**
     * 해지. <b>스키마를 지우지 않는다.</b>
     *
     * <p>{@code DROP SCHEMA ... CASCADE} 한 줄이면 되지만 되돌릴 수 없다. 상태만 바꿔 두고
     * 유예기간이 지난 뒤 배치가 덤프를 남기고 실제로 지운다. 그 배치는 아직 없다 — 지금은
     * 해지된 스키마가 그대로 남아 있으며, 이것이 의도된 상태다.
     * (docs/db/schema-draft-v2.md — "삭제도 자동화하되 즉시 지우지 않는다")
     */
    @Transactional
    public WorkspaceResponse terminate(Long id) {
        Workspace workspace = require(id);
        workspace.terminate();
        log.info(
                "워크스페이스 {} 를 해지했다. 스키마 {} 는 유예기간 뒤 배치가 지운다",
                id,
                workspace.getSchemaName());
        return WorkspaceResponse.from(workspace);
    }

    @Transactional
    public WorkspaceResponse markLinkSent(Long id) {
        Workspace workspace = require(id);
        workspace.markLinkSent(Instant.now());
        return WorkspaceResponse.from(workspace);
    }

    // ── 공통 ───────────────────────────────────────────────────────────────

    private Workspace require(Long id) {
        return workspaceRepository
                .findById(id)
                .orElseThrow(() -> new WorkspaceNotFoundException(id));
    }

    private static void applyPlan(Workspace workspace, String plan) {
        if (plan != null && !plan.isBlank()) {
            workspace.changePlan(plan.strip());
        }
    }

    private static void applyContacts(
            Workspace workspace, WorkspaceCreateRequest.ContactsRequest contacts) {
        if (contacts == null) {
            workspace.updateContacts(null, null, null, null, null, Set.of());
            return;
        }
        workspace.updateContacts(
                contacts.linkName(),
                contacts.linkEmail(),
                contacts.contactName(),
                contacts.contactEmail(),
                contacts.contactPhone(),
                contacts.ccEmails());
    }

    private static List<WorkspaceSite> toSites(List<WorkspaceSiteRequest> requests) {
        return requests == null
                ? List.of()
                : requests.stream().map(WorkspaceSiteRequest::toEntity).toList();
    }

    /**
     * 프로비저닝에 필요한 최소 정보.
     *
     * @param label 스키마 코멘트에 남길 문구. {@code \dn+} 에서 회사를 알아보게 한다
     */
    public record Registration(Long id, String schemaName, String label) {}
}
