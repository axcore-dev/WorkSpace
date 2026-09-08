package com.axcore.workspace.workspace.settings;

import com.axcore.workspace.notification.MailProperties;
import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.security.SecureTokens;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.workspace.admin.exception.WorkspaceStateException;
import com.axcore.workspace.workspace.entity.UserWorkspaceMembership;
import com.axcore.workspace.workspace.entity.Workspace;
import com.axcore.workspace.workspace.provisioning.TenantSearchPath;
import com.axcore.workspace.workspace.repository.UserWorkspaceMembershipRepository;
import com.axcore.workspace.workspace.repository.WorkspaceRepository;
import com.axcore.workspace.workspace.service.TenantMemberWriter;
import com.axcore.workspace.workspace.service.WorkspaceAccessDeniedException;
import com.axcore.workspace.workspace.settings.dto.InviteLinkPreviewResponse;
import com.axcore.workspace.workspace.settings.dto.InviteLinkRequest;
import com.axcore.workspace.workspace.settings.dto.InviteLinkResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 초대 링크 — 받은 사람 누구나 쓸 수 있다. 메일 초대와 달리 상대를 특정하지 않으므로 직급·부서를 미리 박아 두고,
 * <b>한도와 만료가 유일한 안전장치</b>다. 「무제한」 「만료 없음」 은 없다.
 *
 * <p>표는 {@code shared.workspace_invite_links}(V18). JPA 엔티티를 두지 않고 JDBC 로 쓴다 — 컬럼 열 개에 문장 다섯 개다.
 *
 * <p>수락은 {@code UPDATE … WHERE use_count < max_uses RETURNING} 한 문장으로 자리를 선점한다. 마지막 한 자리에 두 명이
 * 동시에 들어오면 둘 다 들어와서는 안 된다. 이미 소속인 사람은 자리를 소진하지 않는다.
 */
@Service
public class InviteLinkService {

    private static final Logger log = LoggerFactory.getLogger(InviteLinkService.class);

    private final TenantAccess access;
    private final TenantSearchPath searchPath;
    private final JdbcTemplate jdbc;
    private final PeopleGuard guard;
    private final WorkspaceRepository workspaces;
    private final UserWorkspaceMembershipRepository memberships;
    private final TenantMemberWriter tenantMembers;
    private final MailProperties mail;

    public InviteLinkService(
            TenantAccess access,
            TenantSearchPath searchPath,
            JdbcTemplate jdbc,
            PeopleGuard guard,
            WorkspaceRepository workspaces,
            UserWorkspaceMembershipRepository memberships,
            TenantMemberWriter tenantMembers,
            MailProperties mail) {
        this.access = access;
        this.searchPath = searchPath;
        this.jdbc = jdbc;
        this.guard = guard;
        this.workspaces = workspaces;
        this.memberships = memberships;
        this.tenantMembers = tenantMembers;
        this.mail = mail;
    }

    // ---------------------------------------------------------------- 관리자

    @Transactional(readOnly = true)
    public List<InviteLinkResponse> list(JwtPrincipal principal) {
        TenantContext ctx = access.open(principal);
        ctx.requireOwner();
        Map<Long, String> roles = guard.roleNames();
        Map<Long, String> depts = guard.departmentNames();
        return rows("workspace_id = ?", ctx.workspaceId()).stream().map(r -> toResponse(r, null, roles, depts)).toList();
    }

    /** 만든다. 토큰 원문은 이 응답에만 있다 — 서버는 해시만 저장한다. */
    @Transactional
    public InviteLinkResponse create(JwtPrincipal principal, InviteLinkRequest request) {
        TenantContext ctx = access.open(principal);
        ctx.requireOwner();
        long roleId = guard.requireAssignableRole(request.roleId());
        Long departmentId = guard.requireAssignableDepartment(request.departmentId());

        String rawToken = SecureTokens.generate();
        UUID id = UUID.randomUUID();
        Instant expiresAt = Instant.now().plus(request.expiresInDays(), ChronoUnit.DAYS);
        jdbc.update(
                """
                insert into shared.workspace_invite_links
                    (id, workspace_id, token_hash, role_id, department_id, max_uses, use_count, expires_at, created_by, created_at)
                values (?, ?, ?, ?, ?, ?, 0, ?, ?, now())
                """,
                id,
                ctx.workspaceId(),
                SecureTokens.hash(rawToken),
                roleId,
                departmentId,
                request.maxUses(),
                OffsetDateTime.ofInstant(expiresAt, java.time.ZoneOffset.UTC),
                ctx.userId());
        log.info(
                "워크스페이스 {} 에서 사용자 {} 가 초대 링크 {} 를 만들었다 (직급 {} · {}명 · {}일)",
                ctx.workspaceId(),
                ctx.userId(),
                id,
                roleId,
                request.maxUses(),
                request.expiresInDays());
        Row row = new Row(id, ctx.workspaceId(), roleId, departmentId, request.maxUses(), 0, expiresAt, null);
        return toResponse(row, mail.workspaceInviteLinkLink(rawToken), guard.roleNames(), guard.departmentNames());
    }

    @Transactional
    public void revoke(JwtPrincipal principal, UUID id) {
        TenantContext ctx = access.open(principal);
        ctx.requireOwner();
        int n =
                jdbc.update(
                        "update shared.workspace_invite_links set revoked_at = now() where id = ? and workspace_id = ? and revoked_at is null",
                        id,
                        ctx.workspaceId());
        if (n == 0) {
            throw new SettingsNotFoundException("초대 링크를 찾을 수 없습니다");
        }
        log.info("워크스페이스 {} 의 초대 링크 {} 를 사용자 {} 가 지웠다", ctx.workspaceId(), id, ctx.userId());
    }

    // ---------------------------------------------------------------- 링크를 연 사람

    /** 어느 회사의 어떤 자리로 들어가는 링크인지. 로그인 전에도 부른다. */
    @Transactional(readOnly = true)
    public InviteLinkPreviewResponse preview(String rawToken) {
        Row row = requireUsable(rawToken);
        Workspace workspace = workspaces.findById(row.workspaceId).orElseThrow(InviteLinkService::invalidToken);
        if (workspace.getSchemaName() == null) {
            throw invalidToken();
        }
        searchPath.bind(workspace.getSchemaName());
        return new InviteLinkPreviewResponse(
                workspace.getId(),
                workspace.getName(),
                guard.roleNames().getOrDefault(row.roleId, "구성원"),
                row.departmentId == null ? null : guard.departmentNames().get(row.departmentId),
                row.expiresAt);
    }

    /**
     * 링크로 들어온다. 이메일이 확인된 계정이어야 하고, 회사가 운영 중이어야 한다.
     * 이미 소속이면 자리를 쓰지 않고 기존 소속을 돌려준다.
     */
    @Transactional
    public UserWorkspaceMembership accept(User user, String rawToken) {
        Row row = requireUsable(rawToken);
        if (!user.isEmailVerified()) {
            throw new WorkspaceAccessDeniedException("이메일 확인이 필요합니다");
        }
        Workspace workspace = workspaces.findById(row.workspaceId).orElseThrow(InviteLinkService::invalidToken);
        if (!workspace.isEnterable() || workspace.getSchemaName() == null) {
            throw new WorkspaceStateException("지금 이용할 수 없는 워크스페이스입니다");
        }
        UserWorkspaceMembership existing =
                memberships.findByUserIdAndWorkspaceIdWithWorkspace(user.getId(), workspace.getId()).orElse(null);
        if (existing != null) {
            return existing;
        }

        // 자리 선점 — 한도가 남아 있을 때만 한 칸 늘어난다. 0행이면 그 사이 다른 사람이 마지막 자리를 썼다
        List<UUID> claimed =
                jdbc.queryForList(
                        """
                        update shared.workspace_invite_links
                           set use_count = use_count + 1
                         where id = ? and revoked_at is null and expires_at > now() and use_count < max_uses
                        returning id
                        """,
                        UUID.class,
                        row.id);
        if (claimed.isEmpty()) {
            throw invalidToken();
        }

        tenantMembers.joinWithRole(workspace.getSchemaName(), user.getId(), row.roleId, row.departmentId);
        log.info("사용자 {} 가 초대 링크 {} 로 워크스페이스 {} 에 합류했다", user.getId(), row.id, workspace.getId());
        return memberships.save(UserWorkspaceMembership.join(user, workspace));
    }

    // ---------------------------------------------------------------- 내부

    private record Row(
            UUID id,
            Long workspaceId,
            Long roleId,
            Long departmentId,
            int maxUses,
            int useCount,
            Instant expiresAt,
            Instant revokedAt) {

        boolean active(Instant now) {
            return revokedAt == null && expiresAt.isAfter(now) && useCount < maxUses;
        }
    }

    private List<Row> rows(String where, Object arg) {
        return jdbc.query(
                "select id, workspace_id, role_id, department_id, max_uses, use_count, expires_at, revoked_at"
                        + " from shared.workspace_invite_links where " + where + " order by created_at desc",
                (rs, i) ->
                        new Row(
                                rs.getObject(1, UUID.class),
                                rs.getLong(2),
                                rs.getLong(3),
                                rs.getObject(4, Long.class),
                                rs.getInt(5),
                                rs.getInt(6),
                                rs.getObject(7, OffsetDateTime.class).toInstant(),
                                rs.getObject(8, OffsetDateTime.class) == null ? null : rs.getObject(8, OffsetDateTime.class).toInstant()),
                arg);
    }

    private Row requireUsable(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw invalidToken();
        }
        Row row = rows("token_hash = ?", SecureTokens.hash(rawToken)).stream().findFirst().orElseThrow(InviteLinkService::invalidToken);
        if (!row.active(Instant.now())) {
            throw invalidToken();
        }
        return row;
    }

    private static InviteLinkResponse toResponse(Row r, String url, Map<Long, String> roles, Map<Long, String> depts) {
        return new InviteLinkResponse(
                r.id,
                url,
                r.roleId,
                roles.get(r.roleId),
                r.departmentId,
                r.departmentId == null ? null : depts.get(r.departmentId),
                r.maxUses,
                r.useCount,
                r.expiresAt,
                r.revokedAt,
                r.active(Instant.now()));
    }

    /** 없는 토큰 · 만료 · 회수 · 한도 소진을 한 가지 응답으로 합친다. 어느 쪽인지 알려 줄 이유가 없다. */
    private static BadCredentialsException invalidToken() {
        return new BadCredentialsException("링크가 만료되었거나 더 쓸 수 없습니다. 초대한 분에게 새 링크를 요청해 주세요");
    }
}
