package com.axcore.workspace.workspace.settings;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * 직급의 권한 묶음({@link RolePermissions})을 읽는다.
 *
 * <p><b>테넌트 스키마가 열린 트랜잭션 안에서만 부를 수 있다.</b> {@link TenantAccess#open} 뒤에 쓴다.
 *
 * <p>소유자와 서버 운영자는 표를 보지 않고 {@link RolePermissions#all()} 이다. 소유자에게 grants 행을 심지 않는 이유는
 * 카탈로그에 탭이 늘 때마다 모든 회사의 소유자 행을 따라 고쳐야 하기 때문이다 — "전부" 는 계산이지 데이터가 아니다.
 */
@Component
public class RolePermissionReader {

    /** 직급이 없거나 알 수 없는 구성원. 아무것도 없다. */
    private static final RolePermissions NONE = new RolePermissions(Set.of(), false, false, false, "own", false);

    private final JdbcTemplate jdbc;

    public RolePermissionReader(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 지금 요청한 사람의 권한. 자기 권한 안인지 판정하는 기준이다. */
    public RolePermissions forContext(TenantContext ctx) {
        if (ctx.owner() || ctx.internalAdmin()) {
            return RolePermissions.all();
        }
        return ctx.roleId() == null ? NONE : forRole(ctx.roleId()).orElse(NONE);
    }

    /** 직급 하나의 권한. 없는 직급이면 비어 있다. */
    public Optional<RolePermissions> forRole(long roleId) {
        record Flags(String code, boolean admin, boolean canInvite, boolean integrations, String scope, boolean amounts) {}
        List<Flags> rows =
                jdbc.query(
                        """
                        select r.code, r.is_admin, r.can_invite, r.can_manage_integrations, r.data_scope, r.show_amounts
                          from roles r
                         where r.id = ?
                        """,
                        (rs, i) ->
                                new Flags(
                                        rs.getString(1),
                                        rs.getBoolean(2),
                                        rs.getBoolean(3),
                                        rs.getBoolean(4),
                                        rs.getString(5),
                                        rs.getBoolean(6)),
                        roleId);
        if (rows.isEmpty()) {
            return Optional.empty();
        }
        Flags f = rows.get(0);
        if ("owner".equals(f.code())) {
            return Optional.of(RolePermissions.all());
        }
        return Optional.of(
                new RolePermissions(
                        tabsOf(roleId), f.admin(), f.canInvite(), f.integrations(), f.scope(), f.amounts()));
    }

    /** 직급의 기능 탭. 카탈로그에 없는 값은 버린다. */
    public Set<String> tabsOf(long roleId) {
        Set<String> known = RolePermissions.all().tabs();
        Set<String> tabs = new LinkedHashSet<>();
        jdbc.query(
                "select subfunction_id from role_module_grants where role_id = ? order by module_slug, subfunction_id",
                rs -> {
                    String tab = rs.getString(1);
                    if (known.contains(tab)) {
                        tabs.add(tab);
                    }
                },
                roleId);
        return tabs;
    }
}
