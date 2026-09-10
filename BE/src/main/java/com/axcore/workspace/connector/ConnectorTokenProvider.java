package com.axcore.workspace.connector;

import com.axcore.workspace.workspace.settings.ConnectorCatalog;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * 도구가 제공자를 부를 때 쓸 access 토큰을 꺼내 준다. 만료가 가까우면 먼저 갱신한다.
 *
 * <p><b>누구의 토큰인지가 먼저다.</b> 연결은 사용자 단위라(tenant V13) 요청한 사람의 계정만 본다 — 같은 회사의
 * 다른 사람이 연결해 뒀어도 이 사람이 연결하지 않았으면 「연결돼 있지 않다」다.
 *
 * <p>여기서 확인하는 것이 앱의 "연결됨" 판정 전부다 — 깃발이 서 있고, 제공자 계정이 있고, 재연결 표시가 없고,
 * 스코프가 앱을 덮는다. 하나라도 어긋나면 {@link ConnectorNotConnectedException} 이고 화면은 「연결」로 안내한다.
 *
 * <p><b>테넌트 스키마가 열린 트랜잭션 안에서 부른다.</b> 갱신한 토큰을 같은 트랜잭션에서 저장한다.
 */
@Component
public class ConnectorTokenProvider {

    private static final Logger log = LoggerFactory.getLogger(ConnectorTokenProvider.class);
    /** 만료까지 이만큼도 안 남았으면 갱신한다. 도구 한 번이 몇 초는 걸린다 */
    private static final Duration SKEW = Duration.ofMinutes(2);

    private final ConnectorAccountStore accounts;
    private final TokenCipher cipher;
    private final GoogleConnector google;
    private final JdbcTemplate jdbc;

    public ConnectorTokenProvider(
            ConnectorAccountStore accounts, TokenCipher cipher, GoogleConnector google, JdbcTemplate jdbc) {
        this.accounts = accounts;
        this.cipher = cipher;
        this.google = google;
        this.jdbc = jdbc;
    }

    /** 이 사람이 이 앱으로 제공자를 부를 수 있는 평문 access 토큰. 호출 직후 버려야 한다 — 어디에도 저장하지 않는다. */
    public String accessTokenFor(UUID userId, String slug, Instant now) {
        ConnectorCatalog.App app =
                ConnectorCatalog.app(slug).orElseThrow(() -> new ConnectorNotConnectedException("알 수 없는 앱입니다: " + slug));
        if (!flagOn(userId, slug)) {
            throw new ConnectorNotConnectedException(slug + " 이(가) 연결돼 있지 않습니다");
        }
        ConnectorAccountStore.Account account =
                accounts.find(userId, app.provider())
                        .orElseThrow(() -> new ConnectorNotConnectedException(slug + " 이(가) 연결돼 있지 않습니다"));
        if (account.needsReconnect()) {
            throw new ConnectorNotConnectedException(slug + " 연결이 만료됐습니다. 다시 연결해 주세요");
        }
        if (!ConnectorCatalog.covers(account.scopes(), app)) {
            throw new ConnectorNotConnectedException(slug + " 에 필요한 권한이 없습니다. 다시 연결해 주세요");
        }

        boolean expiring = account.tokenExpiresAt() != null && account.tokenExpiresAt().minus(SKEW).isBefore(now);
        if (!expiring) {
            return cipher.decrypt(account.accessTokenEnc());
        }
        return refresh(account, slug);
    }

    private String refresh(ConnectorAccountStore.Account account, String slug) {
        if (!"google".equals(account.provider()) || account.refreshTokenEnc() == null) {
            // 슬랙·노션 토큰은 만료가 없어 여기 오지 않는다. 구글인데 refresh 가 없으면 다시 동의받는 길뿐이다
            accounts.markNeedsReconnect(account.userId(), account.provider());
            throw new ConnectorNotConnectedException(slug + " 연결이 만료됐습니다. 다시 연결해 주세요");
        }
        try {
            GoogleConnector.Tokens fresh = google.refresh(cipher.decrypt(account.refreshTokenEnc()));
            accounts.updateAccessToken(
                    account.userId(), account.provider(), cipher.encrypt(fresh.accessToken()), fresh.expiresAt());
            log.info("사용자 {} 의 {} 토큰을 갱신했다", account.userId(), account.provider());
            return fresh.accessToken();
        } catch (ConnectorProviderException e) {
            // 사용자가 구글에서 권한을 회수했거나 비밀번호를 바꿨다. 다음 시도마다 구글을 두드리지 않게 표시한다
            accounts.markNeedsReconnect(account.userId(), account.provider());
            throw new ConnectorNotConnectedException(slug + " 연결이 만료됐습니다. 다시 연결해 주세요");
        }
    }

    private boolean flagOn(UUID userId, String slug) {
        Boolean on =
                jdbc.query(
                        "select connected from connected_services where user_id = ? and slug = ?",
                        rs -> rs.next() ? rs.getBoolean(1) : Boolean.FALSE,
                        userId,
                        slug);
        return Boolean.TRUE.equals(on);
    }
}
