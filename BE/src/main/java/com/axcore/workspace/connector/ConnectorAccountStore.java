package com.axcore.workspace.connector;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * {@code connector_accounts} 읽기·쓰기. 토큰은 여기 들어올 때 이미 암호문이고 나갈 때도 암호문이다 —
 * 풀고 잠그는 것은 {@link TokenCipher} 를 든 서비스의 몫이다. 이 클래스는 평문을 본 적이 없어야 한다.
 *
 * <p><b>사용자 단위다</b>(tenant V13). 모든 조회·변경이 {@code userId} 를 받고 그 사람의 행만 본다 — 남의 토큰을
 * 읽는 경로가 코드에 없어야 한다.
 *
 * <p><b>테넌트 스키마가 열린 트랜잭션 안에서만 부를 수 있다.</b> {@code EnabledFeatureStore} 와 같은 규칙이다.
 */
@Component
public class ConnectorAccountStore {

    /** 한 사람의 한 제공자 계정. 토큰 두 칸은 암호문이다. */
    public record Account(
            UUID userId,
            String provider,
            String accessTokenEnc,
            String refreshTokenEnc,
            Instant tokenExpiresAt,
            Set<String> scopes,
            String externalAccount,
            boolean needsReconnect,
            Instant connectedAt) {}

    private static final String COLUMNS =
            "user_id, provider, access_token_enc, refresh_token_enc, token_expires_at, scopes, external_account, needs_reconnect, connected_at";

    private final JdbcTemplate jdbc;

    public ConnectorAccountStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Account> find(UUID userId, String provider) {
        return jdbc.query(
                        "select " + COLUMNS + " from connector_accounts where user_id = ? and provider = ?",
                        (rs, i) -> map(rs),
                        userId,
                        provider)
                .stream()
                .findFirst();
    }

    public List<Account> findAll(UUID userId) {
        return jdbc.query(
                "select " + COLUMNS + " from connector_accounts where user_id = ? order by provider",
                (rs, i) -> map(rs),
                userId);
    }

    /**
     * 연결 또는 재연결. 같은 사람·같은 제공자면 덮어쓴다 — 스코프를 더해 다시 동의받는 경우가 그렇다.
     * refresh 토큰이 새 응답에 없으면(구글은 첫 동의 뒤로는 안 준다) 옛 값을 지킨다.
     */
    public void upsert(
            UUID userId,
            String provider,
            String accessTokenEnc,
            String refreshTokenEnc,
            Instant expiresAt,
            Set<String> scopes,
            String externalAccount) {
        jdbc.update(
                """
                insert into connector_accounts
                    (user_id, provider, access_token_enc, refresh_token_enc, token_expires_at, scopes, external_account,
                     needs_reconnect, connected_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?, false, now(), now())
                on conflict (user_id, provider) do update set
                    access_token_enc  = excluded.access_token_enc,
                    refresh_token_enc = coalesce(excluded.refresh_token_enc, connector_accounts.refresh_token_enc),
                    token_expires_at  = excluded.token_expires_at,
                    scopes            = excluded.scopes,
                    external_account  = excluded.external_account,
                    needs_reconnect   = false,
                    connected_at      = now(),
                    updated_at        = now()
                """,
                userId,
                provider,
                accessTokenEnc,
                refreshTokenEnc,
                expiresAt == null ? null : Timestamp.from(expiresAt),
                String.join(" ", scopes),
                externalAccount);
    }

    /** 갱신으로 access 토큰만 바뀌었다. */
    public void updateAccessToken(UUID userId, String provider, String accessTokenEnc, Instant expiresAt) {
        jdbc.update(
                "update connector_accounts set access_token_enc = ?, token_expires_at = ?, updated_at = now() where user_id = ? and provider = ?",
                accessTokenEnc,
                expiresAt == null ? null : Timestamp.from(expiresAt),
                userId,
                provider);
    }

    /** 갱신이 거절됐다. 토큰은 남겨 두되 쓰지 않는다 — 화면이 「다시 연결 필요」를 보인다. */
    public void markNeedsReconnect(UUID userId, String provider) {
        jdbc.update(
                "update connector_accounts set needs_reconnect = true, updated_at = now() where user_id = ? and provider = ?",
                userId,
                provider);
    }

    public void delete(UUID userId, String provider) {
        jdbc.update("delete from connector_accounts where user_id = ? and provider = ?", userId, provider);
    }

    private static Account map(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new Account(
                rs.getObject("user_id", UUID.class),
                rs.getString("provider"),
                rs.getString("access_token_enc"),
                rs.getString("refresh_token_enc"),
                instant(rs.getTimestamp("token_expires_at")),
                scopes(rs.getString("scopes")),
                rs.getString("external_account"),
                rs.getBoolean("needs_reconnect"),
                instant(rs.getTimestamp("connected_at")));
    }

    private static Instant instant(Timestamp ts) {
        return ts == null ? null : ts.toInstant();
    }

    private static Set<String> scopes(String joined) {
        if (joined == null || joined.isBlank()) {
            return Set.of();
        }
        return new LinkedHashSet<>(Arrays.asList(joined.trim().split("\\s+")));
    }
}
