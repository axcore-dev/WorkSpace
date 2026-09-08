package com.axcore.workspace.workspace.settings;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.service.AuthService;
import com.axcore.workspace.workspace.entity.UserWorkspaceMembership;
import com.axcore.workspace.workspace.entity.Workspace;
import com.axcore.workspace.workspace.provisioning.TenantSearchPath;
import com.axcore.workspace.workspace.repository.UserWorkspaceMembershipRepository;
import com.axcore.workspace.workspace.repository.WorkspaceRepository;
import com.axcore.workspace.workspace.service.WorkspaceAccessDeniedException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * 설정 API 의 입구. access 토큰의 {@code wsid} 에서 시작해 <b>소속을 다시 확인하고</b>, 그 회사의 스키마를
 * 이 트랜잭션에 열고, 이 사람의 직급을 읽어 {@link TenantContext} 로 돌려준다.
 *
 * <p>토큰의 {@code wsid} 를 그대로 믿고 스키마를 열지 않는다. 소속은 회수될 수 있고 토큰은 access TTL 만큼
 * 살아 있다. {@code WorkspaceService#select} 와 introspect 가 같은 이유로 같은 규칙을 쓴다 — 그 규칙을
 * {@link #resolveWorkspace} 한 곳에 두고 introspect 도 여기를 부른다.
 *
 * <p><b>트랜잭션 안에서 불러야 한다.</b> {@link TenantSearchPath#bind} 가 그렇다. 부르는 서비스 메서드가
 * {@code @Transactional} 이어야 하고, 이 메서드가 돌아온 뒤의 모든 JDBC 조회는 그 회사 스키마를 본다.
 * 그래서 {@code shared} 쪽 JPA 조회는 전부 이 메서드 안에서 먼저 끝낸다.
 */
@Component
public class TenantAccess {

    private final AuthService authService;
    private final UserWorkspaceMembershipRepository membershipRepository;
    private final WorkspaceRepository workspaceRepository;
    private final TenantSearchPath searchPath;
    private final JdbcTemplate jdbc;

    public TenantAccess(
            AuthService authService,
            UserWorkspaceMembershipRepository membershipRepository,
            WorkspaceRepository workspaceRepository,
            TenantSearchPath searchPath,
            JdbcTemplate jdbc) {
        this.authService = authService;
        this.membershipRepository = membershipRepository;
        this.workspaceRepository = workspaceRepository;
        this.searchPath = searchPath;
        this.jdbc = jdbc;
    }

    /**
     * 요청의 회사를 열고 이 사람의 자격을 읽는다.
     *
     * @throws WorkspaceNotSelectedException 회사를 고르지 않았거나 스키마가 아직 없을 때 (409)
     * @throws WorkspaceAccessDeniedException 소속이 없거나 회수됐거나 회사가 정지됐을 때 (403)
     */
    public TenantContext open(JwtPrincipal principal) {
        User user = authService.requireUser(principal.userId());
        if (principal.workspaceId() == null) {
            throw WorkspaceNotSelectedException.required();
        }
        Workspace workspace = resolveWorkspace(user, principal.workspaceId());
        if (workspace.getSchemaName() == null) {
            throw WorkspaceNotSelectedException.notReady();
        }

        // 여기부터 이 트랜잭션은 그 회사를 본다. shared 조회는 위에서 끝났다.
        searchPath.bind(workspace.getSchemaName());

        if (user.isInternalAdmin()) {
            // 서버 운영자는 구성원이 아니다. 지원·장애 대응을 위해 관리자와 같은 것을 볼 수 있지만,
            // 소유자는 아니다 — 회사의 직급 체계를 바깥 사람이 바꾸면 안 된다.
            return new TenantContext(
                    user.getId(),
                    workspace.getId(),
                    workspace.getName(),
                    workspace.getSchemaName(),
                    null,
                    null,
                    "internal_admin",
                    "서버 운영자",
                    true,
                    false,
                    true,
                    null,
                    null,
                    null,
                    true);
        }

        List<TenantContext> rows =
                jdbc.query(
                        """
                        select m.id, r.code, r.name, coalesce(r.is_admin, false), coalesce(r.can_invite, false),
                               d.id, d.name, m.title, r.id
                          from members m
                          left join roles r on r.id = m.role_id
                          left join departments d on d.id = m.department_id
                         where m.user_id = ? and m.status = 'active'
                        """,
                        (rs, i) -> {
                            String code = rs.getString(2);
                            return new TenantContext(
                                    user.getId(),
                                    workspace.getId(),
                                    workspace.getName(),
                                    workspace.getSchemaName(),
                                    rs.getLong(1),
                                    rs.getObject(9, Long.class),
                                    code,
                                    rs.getString(3),
                                    rs.getBoolean(4),
                                    "owner".equals(code),
                                    rs.getBoolean(5),
                                    rs.getObject(6, Long.class),
                                    rs.getString(7),
                                    rs.getString(8),
                                    false);
                        },
                        user.getId());

        if (rows.isEmpty()) {
            // shared 의 라우팅 인덱스에는 있는데 회사 스키마에 구성원 행이 없다. 초대 수락이 반쪽만 끝난
            // 상태다. 로그인은 되지만 회사 안에서는 아무것도 아닌 사람이라 설정에도 닿을 수 없다.
            throw new WorkspaceAccessDeniedException("이 회사의 구성원 정보가 없습니다. 관리자에게 문의해 주세요");
        }
        return rows.get(0);
    }

    /**
     * 이 사람이 지금 이 회사에 들어갈 수 있는지 확인하고 회사를 돌려준다.
     *
     * <p>서버 운영자는 소속 없이 들어가되 상태로도 막지 않는다(중지된 회사일수록 들여다볼 이유가 생긴다).
     * 일반 사용자는 소속과 회사가 모두 살아 있어야 한다. 소속이 죽었는지 회사가 죽었는지는 구분해 알려 준다 —
     * 자기 소속 정보라 감출 것이 없고, 누구에게 문의해야 하는지가 달라진다.
     */
    public Workspace resolveWorkspace(User user, Long workspaceId) {
        if (user.isInternalAdmin()) {
            return workspaceRepository
                    .findById(workspaceId)
                    .orElseThrow(() -> new WorkspaceAccessDeniedException("접근할 수 없는 회사입니다"));
        }
        UserWorkspaceMembership membership =
                membershipRepository
                        .findByUserIdAndWorkspaceIdWithWorkspace(user.getId(), workspaceId)
                        .orElseThrow(() -> new WorkspaceAccessDeniedException("접근할 수 없는 회사입니다"));
        if (!membership.isEnterable()) {
            throw new WorkspaceAccessDeniedException(
                    membership.getStatus().isEnterable()
                            ? "지금 이용할 수 없는 회사입니다"
                            : "이 회사에 대한 접근 권한이 없습니다");
        }
        return membership.getWorkspace();
    }
}
