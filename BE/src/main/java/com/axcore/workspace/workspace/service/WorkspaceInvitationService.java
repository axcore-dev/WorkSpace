package com.axcore.workspace.workspace.service;

import com.axcore.workspace.notification.MailProperties;
import com.axcore.workspace.workspace.admin.entity.AdminAuditAction;
import com.axcore.workspace.workspace.admin.service.AdminAuditRecorder;
import com.axcore.workspace.security.SecureTokens;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.entity.UserIdentity;
import com.axcore.workspace.user.repository.UserIdentityRepository;
import com.axcore.workspace.user.repository.UserRepository;
import com.axcore.workspace.workspace.admin.dto.InvitationIssuedResponse;
import com.axcore.workspace.workspace.admin.dto.InvitationResponse;
import com.axcore.workspace.workspace.admin.exception.InvitationNotFoundException;
import com.axcore.workspace.workspace.admin.exception.WorkspaceNotFoundException;
import com.axcore.workspace.workspace.admin.exception.WorkspaceStateException;
import com.axcore.workspace.workspace.dto.InvitationPreviewResponse;
import com.axcore.workspace.workspace.entity.UserWorkspaceMembership;
import com.axcore.workspace.workspace.entity.Workspace;
import com.axcore.workspace.workspace.entity.WorkspaceInvitation;
import com.axcore.workspace.workspace.repository.UserWorkspaceMembershipRepository;
import com.axcore.workspace.workspace.repository.WorkspaceInvitationRepository;
import com.axcore.workspace.workspace.repository.WorkspaceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 계약 회사 직원을 워크스페이스에 넣는 경로.
 *
 * <p>흐름은 세 걸음이다.
 *
 * <pre>
 *   [운영자] issueLink() → 링크 발급. 운영팀이 복사해 담당자에게 직접 보낸다
 *   [고객]   preview()   → 링크를 연 시점. link_opened_at 기록. 로그인 전에도 부를 수 있다
 *   [고객]   accept()    → 멤버십 생성. 이 시점에 회사 목록에 회사가 나타난다
 * </pre>
 *
 * <p><b>시스템은 메일을 보내지 않는다.</b> 링크 전달은 운영팀의 몫이다. 그래서 발급과 발송이
 * 분리돼 있고, 실제로 보낸 사실은 {@code POST /{id}/link-sent} 로 따로 기록한다.
 *
 * <p>초대는 주소에 매달린다. 링크를 가진 것만으로는 들어갈 수 없고, 그 주소로 가입한 계정만
 * 수락할 수 있다. 링크가 엉뚱한 곳으로 전달돼도 그 주소의 주인이 아니면 쓸 수 없다는 뜻이다.
 */
@Service
public class WorkspaceInvitationService {

    private static final Logger log = LoggerFactory.getLogger(WorkspaceInvitationService.class);

    private final WorkspaceInvitationRepository invitationRepository;
    private final WorkspaceRepository workspaceRepository;
    private final UserWorkspaceMembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final UserIdentityRepository identityRepository;
    private final MailProperties mailProperties;
    private final TenantMemberWriter tenantMembers;
    private final AdminAuditRecorder audit;

    public WorkspaceInvitationService(
            WorkspaceInvitationRepository invitationRepository,
            WorkspaceRepository workspaceRepository,
            UserWorkspaceMembershipRepository membershipRepository,
            UserRepository userRepository,
            UserIdentityRepository identityRepository,
            MailProperties mailProperties,
            TenantMemberWriter tenantMembers,
            AdminAuditRecorder audit) {
        this.invitationRepository = invitationRepository;
        this.workspaceRepository = workspaceRepository;
        this.membershipRepository = membershipRepository;
        this.userRepository = userRepository;
        this.identityRepository = identityRepository;
        this.mailProperties = mailProperties;
        this.tenantMembers = tenantMembers;
        this.audit = audit;
    }

    // ---------------------------------------------------------------- 운영자

    /**
     * 접속 링크를 발급한다. <b>메일은 보내지 않는다.</b>
     *
     * <p>운영팀이 응답의 링크를 복사해 담당자에게 직접 전달한다. 시스템이 보내지 않으므로
     * {@code link_sent_at} 도 여기서 건드리지 않는다 — 실제로 보낸 사람만 그것을 알고,
     * 기록은 {@code POST /{id}/link-sent} 로 따로 남긴다.
     *
     * <p>같은 주소로 다시 발급하면 이전 링크는 회수된다. 그래서 "링크 복사" 를 누를 때마다
     * 새 링크가 나가고, 이전에 흘린 링크는 그 순간 죽는다.
     *
     * @param rawEmail 비우면 워크스페이스에 등록된 담당자 주소를 쓴다
     */
    @Transactional
    public InvitationIssuedResponse issueLink(
            Long workspaceId, String rawEmail, UUID invitedBy, Instant now) {
        Workspace workspace = requireWorkspace(workspaceId);

        // 개설 중이거나 중지·해지된 회사에 사람을 불러들일 이유가 없다. 링크를 받아도 수락
        // 단계에서 막히므로, 발급하는 쪽에서 먼저 끊는 편이 낫다.
        if (!workspace.isEnterable()) {
            throw new WorkspaceStateException(
                    "운영 중인 워크스페이스만 초대할 수 있습니다: " + workspace.getStatus().dbValue());
        }

        String email = resolveEmail(workspace, rawEmail);
        User inviter = invitedBy == null ? null : userRepository.findById(invitedBy).orElse(null);

        int revoked = invitationRepository.revokeOutstanding(workspaceId, email, now);
        if (revoked > 0) {
            log.info("워크스페이스 {} 의 {} 앞 기존 링크 {}건을 회수하고 새로 발급한다", workspaceId, email, revoked);
        }

        String rawToken = SecureTokens.generate();
        WorkspaceInvitation invitation =
                invitationRepository.save(
                        WorkspaceInvitation.issue(workspace, email, rawToken, inviter, now));

        log.info("워크스페이스 {} 접속 링크를 발급했다. 초대 {}", workspaceId, invitation.getId());
        audit.record(invitedBy, AdminAuditAction.ISSUE_LINK, workspaceId, email + " 앞 링크 발급");

        return new InvitationIssuedResponse(
                mailProperties.workspaceInviteLink(rawToken),
                InvitationResponse.from(invitation, now));
    }

    @Transactional(readOnly = true)
    public List<InvitationResponse> list(Long workspaceId, Instant now) {
        requireWorkspace(workspaceId);
        return invitationRepository.findAllByWorkspaceId(workspaceId).stream()
                .map(invitation -> InvitationResponse.from(invitation, now))
                .toList();
    }

    /** 잘못 보낸 링크를 무효화한다. 이미 수락된 초대는 되돌리지 않는다 — 멤버십은 따로 끊어야 한다. */
    @Transactional
    public InvitationResponse revoke(Long workspaceId, UUID invitationId, Instant now) {
        WorkspaceInvitation invitation =
                invitationRepository
                        .findByIdAndWorkspaceId(invitationId, workspaceId)
                        .orElseThrow(() -> new InvitationNotFoundException(invitationId));
        if (invitation.getAcceptedAt() != null) {
            throw new WorkspaceStateException("이미 수락된 초대는 회수할 수 없습니다");
        }
        invitation.revoke(now);
        log.info("워크스페이스 {} 의 초대 {} 를 회수했다", workspaceId, invitationId);
        return InvitationResponse.from(invitation, now);
    }

    // ---------------------------------------------------------------- 고객

    /**
     * 링크를 열었다. 어느 회사의 초대인지 보여 주고 열람 시각을 남긴다.
     *
     * <p>인증이 필요 없다. 링크를 받은 사람은 아직 가입하지 않았을 수 있고, 무엇에 대한
     * 초대인지 모르는 채로 가입을 요구할 수는 없다.
     */
    @Transactional
    public InvitationPreviewResponse preview(String rawToken, Instant now) {
        WorkspaceInvitation invitation = requireUsable(rawToken, now);

        invitation.markOpened(now);
        // 운영자 목록의 "링크 열람" 열이 이 값을 본다. 회사 단위로는 최초 1회만 기록된다.
        invitation.getWorkspace().markLinkOpened(now);

        // 그 주소의 계정이 어떻게 로그인하는지 화면에 알려 준다. 없으면 가입 탭, 비밀번호가 있으면
        // 비밀번호 칸, 소셜만 있으면 그 제공자 버튼 — 이걸 모르면 소셜 계정 사용자가 비밀번호
        // 칸 앞에서 막힌다.
        User account =
                userRepository.findByEmail(User.normalizeEmail(invitation.getEmail())).orElse(null);
        List<UserIdentity> identities =
                account == null ? List.of() : identityRepository.findByUserId(account.getId());

        return InvitationPreviewResponse.from(invitation, account, identities);
    }

    /**
     * 초대를 수락해 멤버십을 만든다.
     *
     * <p>여기가 {@code user_workspace_memberships} 에 행이 생기는 유일한 지점이다.
     */
    @Transactional
    public UserWorkspaceMembership accept(User user, String rawToken, Instant now) {
        WorkspaceInvitation invitation = requireUsable(rawToken, now);

        // 링크를 가진 것과 그 주소의 주인인 것은 다르다. 이 검사가 초대의 유일한 신뢰 근거다.
        if (!invitation.matches(user)) {
            log.warn(
                    "초대 {} 를 다른 계정 {} 가 수락하려 했다",
                    invitation.getId(),
                    user.getId());
            throw new WorkspaceAccessDeniedException("초대받은 이메일 주소의 계정으로 로그인해 주세요");
        }

        // 확인되지 않은 주소로는 들어갈 수 없다. 뒤의 회사 선택 단계에서 어차피 막히는데,
        // 그때 막으면 "수락은 됐는데 못 들어간다" 는 상태가 남는다.
        if (!user.isEmailVerified()) {
            throw new WorkspaceAccessDeniedException("이메일 확인이 필요합니다");
        }

        Workspace workspace = invitation.getWorkspace();
        if (!workspace.isEnterable()) {
            throw new WorkspaceStateException("지금 이용할 수 없는 워크스페이스입니다");
        }

        invitation.accept(user, now);
        invitation.markOpened(now);
        workspace.markLinkOpened(now);

        // 이미 소속돼 있으면 초대만 소진하고 기존 소속을 돌려준다. 링크를 두 번 눌러 400 을
        // 받는 것보다, 같은 결과로 끝나는 편이 낫다.
        // 회사 안에서의 신분은 테넌트 스키마에 있다. 라우팅 인덱스만 만들면 로그인은
        // 되는데 회사 안에서는 아무것도 아닌 사람이 된다.
        tenantMembers.join(workspace.getSchemaName(), user.getId());

        return membershipRepository
                .findByUserIdAndWorkspaceIdWithWorkspace(user.getId(), workspace.getId())
                .orElseGet(
                        () -> {
                            log.info(
                                    "사용자 {} 가 워크스페이스 {} 에 합류했다. 초대 {}",
                                    user.getId(),
                                    workspace.getId(),
                                    invitation.getId());
                            return membershipRepository.save(
                                    UserWorkspaceMembership.join(user, workspace));
                        });
    }

    // ---------------------------------------------------------------- 공통

    private WorkspaceInvitation requireUsable(String rawToken, Instant now) {
        if (rawToken == null || rawToken.isBlank()) {
            throw invalidToken();
        }
        WorkspaceInvitation invitation =
                invitationRepository
                        .findByTokenHashWithWorkspace(SecureTokens.hash(rawToken))
                        .orElseThrow(WorkspaceInvitationService::invalidToken);
        if (!invitation.isUsable(now)) {
            throw invalidToken();
        }
        return invitation;
    }

    private Workspace requireWorkspace(Long workspaceId) {
        return workspaceRepository
                .findById(workspaceId)
                .orElseThrow(() -> new WorkspaceNotFoundException(workspaceId));
    }

    /**
     * 보낼 주소를 정한다. 요청값 → 접속 링크 담당자 → 연락 담당자 순이다.
     *
     * <p>연락 담당자까지 보는 이유: 운영 콘솔이 「접속 링크 받는 사람」과 「연락 담당」을 한
     * 사람으로 합치는 방향으로 가고 있어서, {@code linkContactEmail} 이 비어 오는 경우가
     * 생긴다. 둘 중 채워진 쪽을 쓰면 어느 쪽으로 정리되든 초대가 끊기지 않는다.
     */
    private static String resolveEmail(Workspace workspace, String rawEmail) {
        String candidate = firstFilled(rawEmail, workspace.getLinkContactEmail(), workspace.getContactEmail());
        if (candidate == null) {
            throw new WorkspaceStateException(
                    "보낼 주소가 없습니다. 요청에 이메일을 담거나 워크스페이스에 담당자 이메일을 등록해 주세요");
        }
        return WorkspaceInvitation.normalizeEmail(candidate);
    }

    private static String firstFilled(String... candidates) {
        for (String candidate : candidates) {
            if (candidate != null && !candidate.isBlank()) {
                return candidate;
            }
        }
        return null;
    }

    /** 없는 토큰 · 만료 · 이미 수락 · 회수를 한 가지 응답으로 합친다. 어느 쪽인지 알려 줄 이유가 없다. */
    private static BadCredentialsException invalidToken() {
        return new BadCredentialsException("링크가 만료되었거나 이미 사용되었습니다. 담당자에게 다시 요청해 주세요");
    }
}
