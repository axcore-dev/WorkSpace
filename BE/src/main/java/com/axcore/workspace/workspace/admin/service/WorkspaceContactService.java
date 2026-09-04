package com.axcore.workspace.workspace.admin.service;

import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.repository.UserRepository;
import com.axcore.workspace.workspace.admin.dto.ContactStatusResponse;
import com.axcore.workspace.workspace.admin.dto.InvitationIssuedResponse;
import com.axcore.workspace.workspace.admin.dto.WorkspaceResponse;
import com.axcore.workspace.workspace.admin.dto.WorkspaceUpdateRequest;
import com.axcore.workspace.workspace.admin.dto.WorkspaceUpdateResponse;
import com.axcore.workspace.workspace.admin.dto.WorkspaceUpdateResponse.ContactChange;
import com.axcore.workspace.workspace.admin.entity.AdminAuditAction;
import com.axcore.workspace.workspace.admin.exception.WorkspaceNotFoundException;
import com.axcore.workspace.workspace.entity.Workspace;
import com.axcore.workspace.workspace.entity.WorkspaceInvitation;
import com.axcore.workspace.workspace.repository.UserWorkspaceMembershipRepository;
import com.axcore.workspace.workspace.repository.WorkspaceInvitationRepository;
import com.axcore.workspace.workspace.repository.WorkspaceRepository;
import com.axcore.workspace.workspace.service.TenantMemberWriter;
import com.axcore.workspace.workspace.service.WorkspaceInvitationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * 담당자 변경의 후속 처리. 담당자 = 테넌트 소유자(owner)라는 규칙을 실제로 집행하는 곳이다.
 *
 * <p>운영자가 상세 화면에서 담당자를 바꾸고 저장하면, 정보 저장과 함께 <b>같은 트랜잭션에서</b>
 * 다음 중 하나가 일어난다.
 *
 * <ul>
 *   <li>새 담당자가 이미 구성원 → 그 사람을 소유자로, 다른 소유자는 관리자로 ({@code PROMOTED})
 *   <li>구성원이 아님 → 그 주소로 초대 링크 발급. 수락 시점에 {@code WorkspaceInvitationService#accept}
 *       가 소유자로 올린다 ({@code INVITED}). 가입 여부는 가리지 않는다 — 초대 수락 화면이 가입·로그인을
 *       알아서 안내한다
 *   <li>회사가 운영 중이 아님 → 초대를 낼 수 없어 담당자 정보만 저장 ({@code DEFERRED})
 * </ul>
 *
 * <p>이전 담당자 앞으로 남아 있던 미사용 초대는 회수한다. 아직 들어오지 않았다면 그 사람은 더 이상
 * 담당자가 아니고, 그 링크로 들어오면 소유자가 아니라 관리자가 될 뿐이지만 굳이 살려 둘 이유가 없다.
 *
 * <p>{@link WorkspaceRegistrar#update} 와 {@link WorkspaceInvitationService#issueLink} 는 둘 다
 * {@code @Transactional(REQUIRED)} 이라 여기 트랜잭션에 합류한다. 소유자 이전(JDBC, 테넌트 스키마)도
 * 같은 커넥션·같은 트랜잭션이다 — 정보는 저장됐는데 권한은 안 넘어간 상태가 남지 않는다.
 */
@Service
public class WorkspaceContactService {

    private static final Logger log = LoggerFactory.getLogger(WorkspaceContactService.class);

    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceRegistrar registrar;
    private final WorkspaceInvitationService invitations;
    private final WorkspaceInvitationRepository invitationRepository;
    private final UserRepository userRepository;
    private final UserWorkspaceMembershipRepository membershipRepository;
    private final TenantMemberWriter tenantMembers;
    private final AdminAuditRecorder audit;

    public WorkspaceContactService(
            WorkspaceRepository workspaceRepository,
            WorkspaceRegistrar registrar,
            WorkspaceInvitationService invitations,
            WorkspaceInvitationRepository invitationRepository,
            UserRepository userRepository,
            UserWorkspaceMembershipRepository membershipRepository,
            TenantMemberWriter tenantMembers,
            AdminAuditRecorder audit) {
        this.workspaceRepository = workspaceRepository;
        this.registrar = registrar;
        this.invitations = invitations;
        this.invitationRepository = invitationRepository;
        this.userRepository = userRepository;
        this.membershipRepository = membershipRepository;
        this.tenantMembers = tenantMembers;
        this.audit = audit;
    }

    /**
     * 상세 수정 + 담당자 변경 후속 처리. 한 트랜잭션이다.
     *
     * @param actor 운영자
     */
    @Transactional
    public WorkspaceUpdateResponse update(
            UUID actor, Long id, WorkspaceUpdateRequest request, Instant now) {
        Workspace workspace = require(id);
        String before = workspace.contactEmailNormalized();

        WorkspaceResponse updated = registrar.update(id, request);
        audit.record(actor, AdminAuditAction.UPDATE, id, "회사 정보 수정");

        // registrar.update 가 같은 영속성 컨텍스트의 같은 엔티티를 고쳤으므로 여기서 다시 읽으면 새 값이다.
        String after = workspace.contactEmailNormalized();
        if (after == null || Objects.equals(before, after)) {
            return new WorkspaceUpdateResponse(updated, ContactChange.none());
        }

        log.info("워크스페이스 {} 담당자 변경 {} → {}", id, before, after);

        if (before != null) {
            int revoked = invitationRepository.revokeOutstanding(id, before, now);
            if (revoked > 0) {
                log.info("이전 담당자 {} 앞 미사용 초대 {}건을 회수했다", before, revoked);
            }
        }

        Optional<User> account = userRepository.findByEmail(after);
        boolean member =
                account.isPresent()
                        && membershipRepository
                                .findByUserIdAndWorkspaceIdWithWorkspace(account.get().getId(), id)
                                .isPresent();

        if (member) {
            int demoted = tenantMembers.transferOwner(workspace.getSchemaName(), account.get().getId());
            audit.record(
                    actor,
                    AdminAuditAction.TRANSFER_OWNER,
                    id,
                    "담당자 변경 %s → %s (기존 구성원, 소유자 즉시 이전, 이전 소유자 %d명 관리자로)"
                            .formatted(before == null ? "-" : before, after, demoted));
            return new WorkspaceUpdateResponse(updated, ContactChange.promoted(after, demoted));
        }

        if (!workspace.isEnterable()) {
            // 운영 중이 아닌 회사에는 초대를 낼 수 없다(issueLink 가 막는다). 정보는 저장됐고,
            // 활성화된 뒤 상세 화면의 발급 버튼으로 보낸다.
            log.info("워크스페이스 {} 가 운영 중이 아니라 담당자 {} 초대를 보류한다", id, after);
            return new WorkspaceUpdateResponse(updated, ContactChange.deferred(after));
        }

        // 발급은 그 자체로 ISSUE_LINK 감사 기록을 남긴다. 수락 시점의 소유자 이전은
        // WorkspaceInvitationService#accept 가 담당자 이메일을 보고 처리한다.
        InvitationIssuedResponse issued = invitations.issueLink(id, after, actor, now);
        return new WorkspaceUpdateResponse(updated, ContactChange.invited(after, issued));
    }

    /**
     * 담당자가 회사에 어디까지 들어와 있는가. 상세 조회가 응답에 붙인다.
     *
     * <p>구성원 여부는 {@code shared} 라우팅 인덱스로 본다. 소유자인지는 테넌트 스키마를 열어야 알 수
     * 있는데, 그건 담당자가 구성원일 때만 필요하다.
     */
    @Transactional(readOnly = true)
    public ContactStatusResponse statusOf(Long id, Instant now) {
        Workspace workspace = require(id);
        String email = workspace.contactEmailNormalized();
        if (email == null) {
            return ContactStatusResponse.empty();
        }

        Optional<User> account = userRepository.findByEmail(email);
        if (account.isPresent()
                && membershipRepository
                        .findByUserIdAndWorkspaceIdWithWorkspace(account.get().getId(), id)
                        .isPresent()) {
            boolean owner = tenantMembers.isOwner(workspace.getSchemaName(), account.get().getId());
            return ContactStatusResponse.member(email, owner);
        }

        Optional<WorkspaceInvitation> pending = invitationRepository.findOutstanding(id, email, now);
        if (pending.isPresent()) {
            return ContactStatusResponse.invited(
                    email, pending.get().getCreatedAt(), pending.get().getExpiresAt());
        }
        return ContactStatusResponse.none(email);
    }

    private Workspace require(Long id) {
        return workspaceRepository.findById(id).orElseThrow(() -> new WorkspaceNotFoundException(id));
    }
}
