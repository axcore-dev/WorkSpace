package com.axcore.workspace.workspace.settings;

import com.axcore.workspace.connector.ConnectorAccountStore;
import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.settings.dto.ConnectorsResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 설정 › 워크스페이스 › 연동 — 읽기. 외부 시스템 목록과 지금 쓸 수 있는 외부 서비스, 연결된 제공자 계정.
 *
 * <p>연결·해제는 {@code ConnectorOAuthService} 다. 여기는 화면 한 장을 채우는 조회만 남겼다.
 *
 * <p>앱이 "연결됨" 인 것은 세 가지가 맞을 때다 — 깃발({@code connected_services})이 서 있고, 제공자 계정
 * ({@code connector_accounts})이 있고 재연결 표시가 없고, 그 계정의 스코프가 앱을 덮는다. 도구가 토큰을
 * 꺼낼 때({@code ConnectorTokenProvider})와 같은 판정이다 — 화면과 도구가 다른 답을 하면 안 된다.
 *
 * <p><b>연결은 사용자 단위다</b>(tenant V13). 이 응답은 요청한 사람이 연결한 것만 담는다 — AI 대화 입력창의 앱 칩과
 * 연동 화면이 같은 값을 보고, 그 사람의 도구가 쓰는 토큰({@code ConnectorTokenProvider})과 같은 사람 기준이다.
 * 자기 것만 만지므로 별도 권한이 없다 — {@code editable} 은 늘 참이다.
 */
@Service
public class ConnectorService {

    private final TenantAccess access;
    private final ConnectorAccountStore accounts;
    private final JdbcTemplate jdbc;

    public ConnectorService(TenantAccess access, ConnectorAccountStore accounts, JdbcTemplate jdbc) {
        this.access = access;
        this.accounts = accounts;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public ConnectorsResponse list(JwtPrincipal principal) {
        return snapshot(access.open(principal));
    }

    /** 연결·해제 뒤 바뀐 전체를 돌려줄 때도 쓴다. 이미 열린 트랜잭션 안에서 부른다. */
    @Transactional(readOnly = true)
    public ConnectorsResponse snapshotFor(JwtPrincipal principal) {
        return list(principal);
    }

    private ConnectorsResponse snapshot(TenantContext ctx) {
        Map<String, ConnectorAccountStore.Account> byProvider =
                accounts.findAll(ctx.userId()).stream()
                        .collect(Collectors.toMap(ConnectorAccountStore.Account::provider, Function.identity()));
        List<ConnectorsResponse.RegisteredResponse> registered = registered(ctx, byProvider);
        List<String> services = registered.stream().filter(ConnectorsResponse.RegisteredResponse::enabled)
                .map(ConnectorsResponse.RegisteredResponse::slug).toList();
        return new ConnectorsResponse(systems(), services, registered, accountsOf(byProvider), true);
    }

    private List<ConnectorsResponse.ExternalSystemResponse> systems() {
        return jdbc.query(
                "select id, name, vendor, kind, status from external_systems order by sort_order, id",
                (rs, i) ->
                        new ConnectorsResponse.ExternalSystemResponse(
                                rs.getLong("id"), rs.getString("name"), rs.getString("vendor"), rs.getString("kind"), rs.getString("status")));
    }

    /**
     * 등록된 앱 — {@code connected_services} 에 행이 있고(켜졌든 꺼졌든) 제공자 계정이 그 앱의 스코프를 덮는 것. 카탈로그 순서.
     * 행이 있는데 계정이 없거나 스코프가 모자라면 등록으로 치지 않는다 — 화면에 켤 수 없는 토글이 남지 않게.
     */
    private List<ConnectorsResponse.RegisteredResponse> registered(
            TenantContext ctx, Map<String, ConnectorAccountStore.Account> byProvider) {
        Map<String, Boolean> rows = new java.util.HashMap<>();
        jdbc.query(
                "select slug, connected from connected_services where user_id = ?",
                rs -> { rows.put(rs.getString(1), rs.getBoolean(2)); },
                ctx.userId());
        List<ConnectorsResponse.RegisteredResponse> out = new ArrayList<>();
        for (String slug : ConnectorCatalog.slugs()) {
            Boolean enabled = rows.get(slug);
            if (enabled == null) {
                continue;
            }
            ConnectorCatalog.App app = ConnectorCatalog.app(slug).orElseThrow();
            ConnectorAccountStore.Account account = byProvider.get(app.provider());
            if (account != null && !account.needsReconnect() && ConnectorCatalog.covers(account.scopes(), app)) {
                out.add(new ConnectorsResponse.RegisteredResponse(slug, enabled));
            }
        }
        return out;
    }

    private static List<ConnectorsResponse.AccountResponse> accountsOf(Map<String, ConnectorAccountStore.Account> byProvider) {
        return byProvider.values().stream()
                .sorted((a, b) -> a.provider().compareTo(b.provider()))
                .map(a -> new ConnectorsResponse.AccountResponse(a.provider(), a.externalAccount(), a.needsReconnect(), a.connectedAt()))
                .toList();
    }
}
