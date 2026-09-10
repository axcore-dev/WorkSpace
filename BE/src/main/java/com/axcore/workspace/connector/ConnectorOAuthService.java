package com.axcore.workspace.connector;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.settings.ConnectorCatalog;
import com.axcore.workspace.workspace.settings.SettingsValidationException;
import com.axcore.workspace.workspace.settings.TenantAccess;
import com.axcore.workspace.workspace.settings.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

/**
 * 외부 서비스 연결 · 해제 — OAuth 의 우리 쪽 절반.
 *
 * <p>네 단계다. (1) {@link #authorizeUrl}: 제공자 동의 화면 주소를 만들어 준다. state 는 우리가 서명한다.
 * (2) {@link #complete}: 돌아온 code 를 토큰으로 바꿔 암호화해 저장하고 앱 깃발을 세운다.
 * (3) {@link #setEnabled}: 켜기/끄기 — 깃발만 바꾼다. 꺼도 등록은 남아 목록에 비활성으로 보이고, 다시 켤 때 재인증이 없다.
 * (4) {@link #disconnect}: 해제 — 등록 행을 지운다. 같은 제공자를 쓰는 앱이 하나도 남지 않으면 제공자 쪽 토큰까지 회수한다.
 *
 * <p><b>연결은 사용자 단위다</b>(tenant V13). 토큰도 깃발도 요청한 사람의 것만 만지므로 별도 권한이 없다 — 회사 구성원
 * 누구나 자기 계정을 연결하고 끊는다. AI 도구가 그 사람 대신 제공자를 부를 때도 그 사람의 토큰만 쓴다.
 *
 * <p>지금 제공자 구현은 구글 하나다. 슬랙·노션은 같은 단계에 제공자 클래스만 더한다.
 */
@Service
public class ConnectorOAuthService {

    private static final Logger log = LoggerFactory.getLogger(ConnectorOAuthService.class);

    private final TenantAccess access;
    private final ConnectorStateCodec states;
    private final GoogleConnector google;
    private final ConnectorAccountStore accounts;
    private final TokenCipher cipher;
    private final JdbcTemplate jdbc;

    public ConnectorOAuthService(
            TenantAccess access,
            ConnectorStateCodec states,
            GoogleConnector google,
            ConnectorAccountStore accounts,
            TokenCipher cipher,
            JdbcTemplate jdbc) {
        this.access = access;
        this.states = states;
        this.google = google;
        this.accounts = accounts;
        this.cipher = cipher;
        this.jdbc = jdbc;
    }

    /** 제공자 동의 화면 주소. 화면은 이 주소로 브라우저를 보낸다. */
    @Transactional(readOnly = true)
    public String authorizeUrl(JwtPrincipal principal, String slug, Instant now) {
        TenantContext ctx = access.open(principal);
        ConnectorCatalog.App app = app(slug);
        if (!cipher.available()) {
            throw new ConnectorUnavailableException("연동 토큰 키(CONNECTOR_TOKEN_KEY)가 설정되지 않았습니다");
        }
        requireGoogle(app);

        // 이미 승인받은 스코프에 이 앱의 스코프를 더해 한 번에 동의받는다. 그래야 새 토큰이 옛 앱도 계속 덮는다
        Set<String> scopes = new LinkedHashSet<>(app.scopes());
        accounts.find(ctx.userId(), app.provider()).ifPresent(a -> scopes.addAll(a.scopes()));

        String state = states.issue(ctx.workspaceId(), ctx.userId(), slug, now);
        return google.authorizeUrl(scopes, state);
    }

    /**
     * 콜백. state 가 <b>지금 이 요청의 회사·사용자</b>와 맞아야 한다 — 남이 시작한 흐름의 code 를 내 계정에
     * 심거나, 내가 시작한 흐름을 남의 계정에 심는 것을 둘 다 막는다.
     */
    @Transactional
    public void complete(JwtPrincipal principal, String slug, String code, String state, Instant now) {
        TenantContext ctx = access.open(principal);
        ConnectorCatalog.App app = app(slug);
        requireGoogle(app);

        ConnectorStateCodec.Claims claims =
                states.verify(state, now)
                        .filter(c -> c.slug().equals(slug))
                        .filter(c -> c.workspaceId().equals(ctx.workspaceId()) && c.userId().equals(ctx.userId()))
                        .orElseThrow(() -> new SettingsValidationException("연결 요청을 확인할 수 없습니다. 연동 화면에서 다시 시작해 주세요"));

        GoogleConnector.Tokens tokens = google.exchange(code);
        if (!ConnectorCatalog.covers(tokens.scopes(), app)) {
            // 사용자가 동의 화면에서 체크를 풀었다. 토큰은 받았지만 이 앱은 쓸 수 없다
            google.revoke(tokens.accessToken());
            throw new SettingsValidationException("필요한 권한에 동의하지 않았습니다. 다시 연결하면서 권한을 허용해 주세요");
        }
        String email = google.email(tokens.accessToken());

        accounts.upsert(
                ctx.userId(),
                app.provider(),
                cipher.encrypt(tokens.accessToken()),
                tokens.refreshToken() == null ? null : cipher.encrypt(tokens.refreshToken()),
                tokens.expiresAt(),
                tokens.scopes(),
                email);
        setFlag(ctx.userId(), slug, true);
        log.info("워크스페이스 {} 의 사용자 {} 가 {} 를 연결했다 (제공자 {}, 앱 {})",
                ctx.workspaceId(), ctx.userId(), slug, app.provider(), claims.slug());
    }

    /**
     * 켜기/끄기. 등록(행)은 그대로 두고 깃발만 바꾼다 — 화면의 토글이다.
     *
     * <p>켤 때는 제공자 계정이 이 앱의 스코프를 덮어야 한다. 아니면 409 — 화면은 그 응답을 보고 재인증(OAuth)으로 넘어간다.
     */
    @Transactional
    public void setEnabled(JwtPrincipal principal, String slug, boolean enabled) {
        TenantContext ctx = access.open(principal);
        ConnectorCatalog.App app = app(slug);
        if (enabled) {
            ConnectorAccountStore.Account account =
                    accounts.find(ctx.userId(), app.provider())
                            .filter(a -> !a.needsReconnect() && ConnectorCatalog.covers(a.scopes(), app))
                            .orElseThrow(() -> new ConnectorNotConnectedException(slug + " 을(를) 켜려면 먼저 연결해야 합니다"));
            log.info("사용자 {} 가 {} 를 켰다 (계정 {})", ctx.userId(), slug, account.externalAccount());
        } else {
            log.info("사용자 {} 가 {} 를 껐다. 등록은 남긴다", ctx.userId(), slug);
        }
        setFlag(ctx.userId(), slug, enabled);
    }

    /** 해제 — 등록 행을 지운다. 같은 제공자의 다른 앱이 하나도 등록돼 있지 않으면 토큰도 회수하고 계정 행을 지운다. */
    @Transactional
    public void disconnect(JwtPrincipal principal, String slug) {
        TenantContext ctx = access.open(principal);
        UUID userId = ctx.userId();
        ConnectorCatalog.App app = app(slug);
        jdbc.update("delete from connected_services where user_id = ? and slug = ?", userId, slug);

        boolean othersRegistered =
                ConnectorCatalog.appsOf(app.provider()).stream()
                        .filter(a -> !a.slug().equals(slug))
                        .anyMatch(a -> registered(userId, a.slug()));
        if (othersRegistered) {
            log.info("사용자 {} 가 {} 를 해제했다. 같은 계정을 쓰는 앱이 남아 토큰은 둔다", userId, slug);
            return;
        }
        accounts.find(userId, app.provider())
                .ifPresent(
                        a -> {
                            if ("google".equals(a.provider())) {
                                // refresh 를 회수하면 access 도 함께 죽는다. 둘 중 있는 것으로
                                String token = a.refreshTokenEnc() != null ? a.refreshTokenEnc() : a.accessTokenEnc();
                                try {
                                    google.revoke(cipher.decrypt(token));
                                } catch (ConnectorNotConnectedException e) {
                                    log.warn("저장된 토큰을 풀 수 없어 제공자 회수를 건너뛴다. 행은 지운다");
                                }
                            }
                            accounts.delete(userId, a.provider());
                        });
        log.info("사용자 {} 가 {} 를 해제했다. 마지막 앱이라 {} 계정도 지웠다", userId, slug, app.provider());
    }

    // ------------------------------------------------------------------ 내부

    private static ConnectorCatalog.App app(String slug) {
        return ConnectorCatalog.app(slug).orElseThrow(() -> new SettingsValidationException("알 수 없는 서비스입니다: " + slug));
    }

    private static void requireGoogle(ConnectorCatalog.App app) {
        if (!"google".equals(app.provider())) {
            throw new ConnectorUnavailableException(app.slug() + " 연결은 아직 준비 중입니다");
        }
    }

    private void setFlag(UUID userId, String slug, boolean on) {
        jdbc.update(
                """
                insert into connected_services (user_id, slug, connected, updated_at)
                values (?, ?, ?, now())
                on conflict (user_id, slug)
                do update set connected = excluded.connected, updated_at = now()
                """,
                userId,
                slug,
                on);
    }

    /** 등록됐는가 — 켜졌든 꺼졌든 행이 있으면 등록이다 */
    private boolean registered(UUID userId, String slug) {
        Integer n =
                jdbc.queryForObject(
                        "select count(*) from connected_services where user_id = ? and slug = ?", Integer.class, userId, slug);
        return n != null && n > 0;
    }
}
