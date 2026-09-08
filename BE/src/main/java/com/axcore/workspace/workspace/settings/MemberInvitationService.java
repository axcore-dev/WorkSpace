package com.axcore.workspace.workspace.settings;

import com.axcore.workspace.notification.MailMessage;
import com.axcore.workspace.notification.MailProperties;
import com.axcore.workspace.notification.MailSender;
import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.security.SecureTokens;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.repository.UserRepository;
import com.axcore.workspace.workspace.entity.Workspace;
import com.axcore.workspace.workspace.entity.WorkspaceInvitation;
import com.axcore.workspace.workspace.repository.WorkspaceInvitationRepository;
import com.axcore.workspace.workspace.repository.WorkspaceRepository;
import com.axcore.workspace.workspace.settings.dto.MemberInviteRequest;
import com.axcore.workspace.workspace.settings.dto.MemberInviteResult;
import com.axcore.workspace.workspace.settings.dto.MemberInviteResult.Line;
import com.axcore.workspace.workspace.settings.dto.PendingInvitationResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * 이메일 초대 — 초대 관리 › 초대 중인 구성원 탭.
 *
 * <p>운영자의 접속 링크({@code WorkspaceInvitationService})와 같은 표({@code shared.workspace_invitations})를 쓰되
 * {@code kind = member} 로 구분한다. 수락은 기존 {@code /api/auth/invitations/accept} 가 그대로 처리하고, 그때 초대에 실린
 * 직급·부서로 들어간다({@code TenantMemberWriter#joinWithRole}).
 *
 * <p>주소 하나가 잘못됐다고 전체를 막지 않는다. 형식이 틀린 주소 · 이미 구성원 · 이미 초대 중은 건너뛰고 결과에 이유를 적는다.
 * 사외 주소는 막지 않는다 — 협력사·감사인을 부를 일이 실제로 있다(화면 {@code data/invite.ts} 의 원칙).
 *
 * <p><b>메일은 시스템이 보낸다</b>(결정 C, 2026-09-08). 운영자 초대는 운영팀이 링크를 전달했지만, 관리자가 직원 30명을 부를 때
 * 링크를 손으로 나눌 수는 없다. {@code MAIL_MODE=log} 면 콘솔에 찍기만 한다. 토큰 원문은 그 메일에만 존재한다.
 */
@Service
public class MemberInvitationService {

    private static final Logger log = LoggerFactory.getLogger(MemberInvitationService.class);
    /** 주소 모양만 본다 — 실제로 받는 주소인지는 메일을 보내 봐야 안다. 화면과 같은 판정. */
    private static final Pattern SHAPE = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private final TenantAccess access;
    private final WorkspaceInvitationRepository invitations;
    private final WorkspaceRepository workspaces;
    private final UserRepository users;
    private final JdbcTemplate jdbc;
    private final PeopleGuard guard;
    private final MailSender mailSender;
    private final MailProperties mail;

    public MemberInvitationService(
            TenantAccess access,
            WorkspaceInvitationRepository invitations,
            WorkspaceRepository workspaces,
            UserRepository users,
            JdbcTemplate jdbc,
            PeopleGuard guard,
            MailSender mailSender,
            MailProperties mail) {
        this.access = access;
        this.invitations = invitations;
        this.workspaces = workspaces;
        this.users = users;
        this.jdbc = jdbc;
        this.guard = guard;
        this.mailSender = mailSender;
        this.mail = mail;
    }

    /** 아직 살아 있는(수락·회수·만료되지 않은) 직원 초대. */
    @Transactional(readOnly = true)
    public List<PendingInvitationResponse> list(JwtPrincipal principal) {
        TenantContext ctx = access.open(principal);
        ctx.requireOwner();
        Instant now = Instant.now();
        Map<Long, String> roles = guard.roleNames();
        Map<Long, String> depts = guard.departmentNames();
        return invitations.findAllByWorkspaceId(ctx.workspaceId()).stream()
                .filter(i -> i.isMemberInvite() && i.statusAt(now) == WorkspaceInvitation.Status.PENDING)
                .map(i -> toResponse(i, roles, depts))
                .toList();
    }

    @Transactional
    public MemberInviteResult invite(JwtPrincipal principal, MemberInviteRequest request) {
        TenantContext ctx = access.open(principal);
        ctx.requireOwner();
        long roleId = guard.requireAssignableRole(request.roleId());
        Long departmentId = guard.requireAssignableDepartment(request.departmentId());
        String roleName = guard.roleNames().getOrDefault(roleId, "구성원");

        Workspace workspace = workspaces.findById(ctx.workspaceId()).orElseThrow();
        User inviter = users.findById(ctx.userId()).orElseThrow();
        Set<String> members = new HashSet<>(jdbc.queryForList(
                "select u.email from members m join shared.users u on u.id = m.user_id where m.status <> 'left'",
                String.class));

        Instant now = Instant.now();
        List<Line> lines = new ArrayList<>();
        for (String raw : request.emails()) {
            String email = WorkspaceInvitation.normalizeEmail(raw);
            if (!SHAPE.matcher(email).matches()) {
                lines.add(new Line(email, "skipped", "주소 형식이 아니에요"));
            } else if (members.contains(email)) {
                lines.add(new Line(email, "skipped", "이미 구성원이에요"));
            } else if (invitations.findOutstanding(workspace.getId(), email, now).isPresent()) {
                lines.add(new Line(email, "skipped", "초대 중이에요"));
            } else {
                issue(workspace, email, inviter, roleId, departmentId, roleName, now);
                lines.add(new Line(email, "sent", null));
            }
        }
        log.info("워크스페이스 {} 에서 사용자 {} 가 직원 초대 {}건을 처리했다 (직급 {})", ctx.workspaceId(), ctx.userId(), lines.size(), roleId);
        return new MemberInviteResult(lines);
    }

    /** 같은 주소·직급·부서로 새 링크를 보낸다. 이전 링크는 그 순간 죽는다. */
    @Transactional
    public PendingInvitationResponse resend(JwtPrincipal principal, UUID invitationId) {
        TenantContext ctx = access.open(principal);
        ctx.requireOwner();
        WorkspaceInvitation old = requireMemberInvite(ctx, invitationId);
        if (old.getAcceptedAt() != null) {
            throw new SettingsConflictException("ALREADY_ACCEPTED", "이미 수락한 초대입니다");
        }
        Instant now = Instant.now();
        Workspace workspace = workspaces.findById(ctx.workspaceId()).orElseThrow();
        User inviter = users.findById(ctx.userId()).orElseThrow();
        invitations.revokeOutstanding(workspace.getId(), old.getEmail(), now);
        Map<Long, String> roles = guard.roleNames();
        WorkspaceInvitation fresh =
                issue(
                        workspace,
                        old.getEmail(),
                        inviter,
                        old.getRoleId(),
                        old.getDepartmentId(),
                        roles.getOrDefault(old.getRoleId(), "구성원"),
                        now);
        return toResponse(fresh, roles, guard.departmentNames());
    }

    @Transactional
    public void revoke(JwtPrincipal principal, UUID invitationId) {
        TenantContext ctx = access.open(principal);
        ctx.requireOwner();
        WorkspaceInvitation invitation = requireMemberInvite(ctx, invitationId);
        if (invitation.getAcceptedAt() != null) {
            throw new SettingsConflictException("ALREADY_ACCEPTED", "이미 수락한 초대는 회수할 수 없습니다");
        }
        invitation.revoke(Instant.now());
        log.info("워크스페이스 {} 의 직원 초대 {} 를 사용자 {} 가 취소했다", ctx.workspaceId(), invitationId, ctx.userId());
    }

    // ---------------------------------------------------------------- 내부

    private WorkspaceInvitation issue(
            Workspace workspace, String email, User inviter, Long roleId, Long departmentId, String roleName, Instant now) {
        String rawToken = SecureTokens.generate();
        WorkspaceInvitation invitation =
                invitations.save(
                        WorkspaceInvitation.issueForMember(workspace, email, rawToken, inviter, roleId, departmentId, now));
        mailSender.send(
                new MailMessage(
                        email,
                        "[AXpoint] %s 워크스페이스 초대".formatted(workspace.getName()),
                        """
                        %s 님이 %s 워크스페이스에 초대했습니다.
                        직급: %s

                        아래 링크를 열어 초대를 수락하세요.

                        %s

                        이 링크는 %d일 뒤에 만료되고, 이 주소(%s)로 만든 계정만 수락할 수 있습니다.
                        모르는 초대라면 이 메일을 무시하셔도 됩니다.
                        """
                                .formatted(
                                        inviter.getName(),
                                        workspace.getName(),
                                        roleName,
                                        mail.workspaceInviteLink(rawToken),
                                        WorkspaceInvitation.TTL.toDays(),
                                        email)));
        return invitation;
    }

    private WorkspaceInvitation requireMemberInvite(TenantContext ctx, UUID invitationId) {
        return invitations
                .findByIdAndWorkspaceId(invitationId, ctx.workspaceId())
                .filter(WorkspaceInvitation::isMemberInvite)
                .orElseThrow(() -> new SettingsNotFoundException("초대를 찾을 수 없습니다"));
    }

    private static PendingInvitationResponse toResponse(
            WorkspaceInvitation i, Map<Long, String> roles, Map<Long, String> depts) {
        return new PendingInvitationResponse(
                i.getId(),
                i.getEmail(),
                i.getRoleId(),
                i.getRoleId() == null ? null : roles.get(i.getRoleId()),
                i.getDepartmentId(),
                i.getDepartmentId() == null ? null : depts.get(i.getDepartmentId()),
                i.getCreatedAt(),
                i.getExpiresAt());
    }
}
