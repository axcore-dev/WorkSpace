package com.axcore.workspace.workspace.settings;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.settings.dto.ConnectorUpdateRequest;
import com.axcore.workspace.workspace.settings.dto.ConnectorsResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 설정 › 워크스페이스 › 연동 — 외부 시스템(읽기) · 외부 서비스(연결·해제).
 *
 * <p>다른 설정 서비스와 같은 규칙이다: {@link TenantAccess#open} 으로 시작하고, 그 뒤 JDBC 는 열린 회사 스키마를
 * 본다. {@code @Transactional} 이 아니면 {@code search_path} 가 유지되지 않는다.
 *
 * <p>연결·해제는 <b>연동 관리 권한</b>({@code roles.can_manage_integrations})이 있어야 한다. 소유자와 서버
 * 운영자는 항상 가진다({@link RolePermissions#all}). 목록은 회사 구성원 누구나 본다 — AI 대화 입력창이 같은
 * 사실을 쓰기 때문에 권한을 걸면 대화 화면이 빈다.
 */
@Service
public class ConnectorService {

    private static final Logger log = LoggerFactory.getLogger(ConnectorService.class);

    private final TenantAccess access;
    private final RolePermissionReader permissions;
    private final JdbcTemplate jdbc;

    public ConnectorService(TenantAccess access, RolePermissionReader permissions, JdbcTemplate jdbc) {
        this.access = access;
        this.permissions = permissions;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public ConnectorsResponse list(JwtPrincipal principal) {
        TenantContext ctx = access.open(principal);
        return snapshot(permissions.forContext(ctx).canManageIntegrations());
    }

    /** 외부 서비스 하나를 연결하거나 해제하고, 바뀐 전체를 돌려준다. */
    @Transactional
    public ConnectorsResponse update(JwtPrincipal principal, String slug, ConnectorUpdateRequest request) {
        TenantContext ctx = access.open(principal);
        if (!permissions.forContext(ctx).canManageIntegrations()) {
            throw new SettingsForbiddenException("연동을 바꿀 수 있는 권한이 없습니다");
        }
        if (!ConnectorCatalog.has(slug)) {
            throw new SettingsValidationException("알 수 없는 서비스입니다: " + slug);
        }

        jdbc.update(
                """
                insert into connected_services (slug, connected, updated_by, updated_at)
                values (?, ?, ?, now())
                on conflict (slug)
                do update set connected = excluded.connected, updated_by = excluded.updated_by, updated_at = now()
                """,
                slug,
                request.connected(),
                ctx.userId());
        log.info(
                "워크스페이스 {} 의 외부 서비스 {} 를 사용자 {} 가 {}",
                ctx.workspaceId(),
                slug,
                ctx.userId(),
                request.connected() ? "연결했다" : "해제했다");

        return snapshot(true);
    }

    private ConnectorsResponse snapshot(boolean editable) {
        return new ConnectorsResponse(systems(), connectedServices(), editable);
    }

    private List<ConnectorsResponse.ExternalSystemResponse> systems() {
        return jdbc.query(
                "select id, name, vendor, kind, status from external_systems order by sort_order, id",
                (rs, i) ->
                        new ConnectorsResponse.ExternalSystemResponse(
                                rs.getLong("id"),
                                rs.getString("name"),
                                rs.getString("vendor"),
                                rs.getString("kind"),
                                rs.getString("status")));
    }

    /** 연결된 slug 를 카탈로그 순서로. 카탈로그에 없는 값은 버린다 — 목록에서 빠진 서비스가 유령으로 남지 않게. */
    private List<String> connectedServices() {
        Set<String> on =
                new LinkedHashSet<>(
                        jdbc.queryForList(
                                "select slug from connected_services where connected", String.class));
        List<String> ordered = new ArrayList<>();
        for (String slug : ConnectorCatalog.slugs()) {
            if (on.contains(slug)) {
                ordered.add(slug);
            }
        }
        return ordered;
    }
}
