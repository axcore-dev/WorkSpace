package com.axcore.workspace.workspace.settings;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.settings.dto.RoleCreateRequest;
import com.axcore.workspace.workspace.settings.dto.RoleResponse;
import com.axcore.workspace.workspace.settings.dto.RoleUpdateRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * 직급 — 권한 관리 화면의 가운데·오른쪽 열. 이름 · 부서 · 회사 권한 · 데이터 범위 · 기능 탭.
 *
 * <h2>누가 무엇을 고칠 수 있는가 (결정 B, 2026-09-08)</h2>
 *
 * <ul>
 *   <li><b>소유자(owner)</b> — 고정. 아무도 고치거나 지우지 못한다. 권한은 언제나 전부다</li>
 *   <li><b>구성원(member)</b> — 고정. 이름·부서는 바꿀 수 없고 지울 수도 없다. 권한(탭 · 범위 · 위임)은 <b>소유자만</b> 고친다</li>
 *   <li><b>그 밖의 직급</b> — 소유자는 마음대로. 관리자({@code is_admin})는 <b>자기 권한 안에서만</b>: 고치기 전 상태와
 *       고친 뒤 상태가 둘 다 자기 권한의 부분집합이어야 하고, 자기 직급은 건드릴 수 없다</li>
 * </ul>
 *
 * <p>"자기 권한 안" 을 전후 모두 보는 이유: 뒤만 보면 관리자가 자기보다 큰 직급의 권한을 <i>줄이는</i> 것이 통한다.
 * 그건 다른 방향의 월권이다.
 *
 * <p>기능 탭은 카탈로그에 있으면 저장한다. 회사가 끈 기능의 탭도 "가진" 것으로 남고, 실제 접근은 회사가 켠 것과의 교집합이다
 * ({@code ModuleAccessReader}). 화면은 끈 기능의 토글을 잠가 바꾸지 못하게만 한다.
 *
 * <p>이름 중복은 DB 의 {@code ux_roles_name} 이 막고 {@code GlobalExceptionHandler} 가 409 로 옮긴다 — 여기서 미리 세지 않는다.
 */
@Service
public class RoleService {

    private static final Logger log = LoggerFactory.getLogger(RoleService.class);

    private final TenantAccess access;
    private final JdbcTemplate jdbc;
    private final RolePermissionReader permissions;
    private final DepartmentService departments;

    public RoleService(
            TenantAccess access,
            JdbcTemplate jdbc,
            RolePermissionReader permissions,
            DepartmentService departments) {
        this.access = access;
        this.jdbc = jdbc;
        this.permissions = permissions;
        this.departments = departments;
    }

    @Transactional(readOnly = true)
    public List<RoleResponse> list(JwtPrincipal principal) {
        TenantContext ctx = access.open(principal);
        RolePermissions mine = permissions.forContext(ctx);
        return rows(null).stream().map(r -> toResponse(r, ctx, mine)).toList();
    }

    /** 권한 없이 만든다. 관리자도 만들 수 있다 — 빈 권한은 누구의 부분집합이다. */
    @Transactional
    public RoleResponse create(JwtPrincipal principal, RoleCreateRequest request) {
        TenantContext ctx = access.open(principal);
        ctx.requireRoleEditor();
        departments.requireExists(request.departmentId());

        Long id =
                jdbc.queryForObject(
                        """
                        insert into roles (code, name, department_id, is_admin, can_invite, can_manage_integrations,
                                           data_scope, show_amounts, is_system, created_at, updated_at)
                        values (?, ?, ?, false, false, false, 'own', false, false, now(), now())
                        returning id
                        """,
                        Long.class,
                        // 시스템이 뜻을 아는 code 는 owner · admin · member 뿐이다. 회사가 만든 직급은 이름으로 구분하므로 유일하기만 하면 된다
                        "r_" + UUID.randomUUID().toString().replace("-", ""),
                        request.name().trim(),
                        request.departmentId());
        log.info("워크스페이스 {} 에 직급 {} 을 사용자 {} 가 만들었다", ctx.workspaceId(), id, ctx.userId());
        return get(ctx, id);
    }

    @Transactional
    public RoleResponse update(JwtPrincipal principal, long id, RoleUpdateRequest request) {
        TenantContext ctx = access.open(principal);
        ctx.requireRoleEditor();
        Row target = requireRow(id);
        RolePermissions mine = permissions.forContext(ctx);
        RolePermissions before = permissions.forRole(id).orElseThrow();

        if ("owner".equals(target.code)) {
            throw new SettingsForbiddenException("소유자 직급은 고칠 수 없습니다");
        }
        if (target.system && !ctx.owner()) {
            throw new SettingsForbiddenException("고정 직급의 권한은 소유자만 고칠 수 있습니다");
        }
        if (!ctx.owner()) {
            if (ctx.roleId() != null && ctx.roleId() == id) {
                throw new SettingsForbiddenException("자기 직급은 고칠 수 없습니다");
            }
            if (!mine.covers(before)) {
                throw new SettingsForbiddenException("내 권한보다 넓은 직급은 고칠 수 없습니다");
            }
        }

        // 고정 직급(member)은 이름·부서·admin 을 그대로 둔다. 부서 없음(「전사」)은 허용 — 기본 관리자 직급이 그렇다
        String name = target.system ? target.name : request.name().trim();
        Long departmentId = target.system ? target.departmentId : request.departmentId();
        boolean admin = !target.system && request.admin();
        if (!target.system && departmentId != null) {
            departments.requireExists(departmentId);
        }
        Set<String> tabs = validatedTabs(request.tabs());
        RolePermissions after =
                new RolePermissions(
                        tabs, admin, request.canInvite(), request.canManageIntegrations(), request.dataScope(), request.showAmounts());
        if (!ctx.owner() && !mine.covers(after)) {
            throw new SettingsForbiddenException("내 권한 밖의 권한은 줄 수 없습니다");
        }

        jdbc.update(
                """
                update roles
                   set name = ?, department_id = ?, is_admin = ?, can_invite = ?, can_manage_integrations = ?,
                       data_scope = ?, show_amounts = ?, updated_at = now()
                 where id = ?
                """,
                name,
                departmentId,
                admin,
                request.canInvite(),
                request.canManageIntegrations(),
                request.dataScope(),
                request.showAmounts(),
                id);
        replaceTabs(id, tabs);

        log.info(
                "워크스페이스 {} 직급 {} 을 사용자 {} 가 저장했다 (탭 {}개, admin={}, scope={})",
                ctx.workspaceId(),
                id,
                ctx.userId(),
                tabs.size(),
                admin,
                request.dataScope());
        return get(ctx, id);
    }

    /**
     * 직급을 지운다.
     *
     * @param moveMembersTo 구성원이 있으면 옮길 직급. 없으면 구성원이 한 명이라도 있으면 409
     */
    @Transactional
    public void delete(JwtPrincipal principal, long id, Long moveMembersTo) {
        TenantContext ctx = access.open(principal);
        ctx.requireRoleEditor();
        Row target = requireRow(id);

        if (target.system) {
            throw new SettingsForbiddenException("고정 직급은 지울 수 없습니다");
        }
        if (ctx.roleId() != null && ctx.roleId() == id) {
            throw new SettingsForbiddenException("자기 직급은 지울 수 없습니다");
        }
        RolePermissions mine = permissions.forContext(ctx);
        if (!ctx.owner() && !mine.covers(permissions.forRole(id).orElseThrow())) {
            throw new SettingsForbiddenException("내 권한보다 넓은 직급은 지울 수 없습니다");
        }

        if (target.memberCount > 0) {
            if (moveMembersTo == null) {
                throw new SettingsConflictException(
                        "ROLE_HAS_MEMBERS", "이 직급을 가진 구성원이 " + target.memberCount + "명 있어요. 옮길 직급을 골라 주세요");
            }
            if (moveMembersTo == id) {
                throw new SettingsValidationException("지우는 직급으로는 옮길 수 없습니다");
            }
            Row dest = requireRow(moveMembersTo);
            if ("owner".equals(dest.code)) {
                throw new SettingsForbiddenException("소유자 직급으로는 옮길 수 없습니다");
            }
            // 옮기는 것도 권한을 주는 일이다 — 관리자는 자기 권한 안의 직급으로만
            if (!ctx.owner() && !mine.covers(permissions.forRole(moveMembersTo).orElseThrow())) {
                throw new SettingsForbiddenException("내 권한보다 넓은 직급으로는 옮길 수 없습니다");
            }
            jdbc.update("update members set role_id = ?, updated_at = now() where role_id = ?", moveMembersTo, id);
        }
        // role_module_grants 는 FK ON DELETE CASCADE
        jdbc.update("delete from roles where id = ?", id);
        log.info(
                "워크스페이스 {} 직급 {} 을 사용자 {} 가 지웠다 (구성원 {}명 → {})",
                ctx.workspaceId(),
                id,
                ctx.userId(),
                target.memberCount,
                moveMembersTo);
    }

    // ---------------------------------------------------------------- 내부

    private RoleResponse get(TenantContext ctx, long id) {
        return toResponse(requireRow(id), ctx, permissions.forContext(ctx));
    }

    /** 카탈로그에 있는 탭만 통과한다. */
    private static Set<String> validatedTabs(List<String> requested) {
        Set<String> known = RolePermissions.all().tabs();
        Set<String> tabs = new LinkedHashSet<>();
        for (String tab : requested) {
            if (!known.contains(tab)) {
                throw new SettingsValidationException("알 수 없는 탭입니다: " + tab);
            }
            tabs.add(tab);
        }
        return tabs;
    }

    private void replaceTabs(long roleId, Set<String> tabs) {
        jdbc.update("delete from role_module_grants where role_id = ?", roleId);
        for (FeatureCatalog.Module module : FeatureCatalog.modules()) {
            for (String tab : module.tabs()) {
                if (tabs.contains(tab)) {
                    jdbc.update(
                            "insert into role_module_grants (role_id, module_slug, subfunction_id, created_at) values (?, ?, ?, now())",
                            roleId,
                            module.slug(),
                            tab);
                }
            }
        }
    }

    private RoleResponse toResponse(Row r, TenantContext ctx, RolePermissions mine) {
        RolePermissions perms = permissions.forRole(r.id).orElseThrow();
        boolean editable;
        if ("owner".equals(r.code)) {
            editable = false;
        } else if (r.system) {
            editable = ctx.owner();
        } else if (ctx.owner()) {
            editable = true;
        } else {
            editable = ctx.admin() && (ctx.roleId() == null || ctx.roleId() != r.id) && mine.covers(perms);
        }
        return new RoleResponse(
                r.id,
                r.code,
                r.name,
                r.system,
                r.departmentId,
                r.departmentName,
                perms.admin(),
                perms.canInvite(),
                perms.canManageIntegrations(),
                perms.dataScope(),
                perms.showAmounts(),
                List.copyOf(perms.tabs()),
                r.memberCount,
                editable);
    }

    private record Row(
            long id, String code, String name, boolean system, Long departmentId, String departmentName, int memberCount) {}

    /** @param id null 이면 전부 */
    private List<Row> rows(Long id) {
        return jdbc.query(
                """
                select r.id, r.code, r.name, r.is_system, r.department_id, d.name,
                       (select count(*) from members m where m.role_id = r.id and m.status = 'active')
                  from roles r
                  left join departments d on d.id = r.department_id
                 where (?::bigint is null or r.id = ?::bigint)
                 order by r.id
                """,
                (rs, i) ->
                        new Row(
                                rs.getLong(1),
                                rs.getString(2),
                                rs.getString(3),
                                rs.getBoolean(4),
                                rs.getObject(5, Long.class),
                                rs.getString(6),
                                rs.getInt(7)),
                id,
                id);
    }

    private Row requireRow(long id) {
        return rows(id).stream().findFirst().orElseThrow(() -> new SettingsNotFoundException("직급을 찾을 수 없습니다"));
    }
}
