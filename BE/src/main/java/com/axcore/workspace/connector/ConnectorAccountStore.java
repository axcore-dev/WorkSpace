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
 * <p><b>테넌트 스키마가 열린 트랜잭션 안에서만 부를 수 있다.</b> {@code EnabledFeatureStore} 와 같은 규칙이다.
 */
@Component
public class ConnectorAccountStore {

    /** 한 제공자 계정. 토큰 두 칸은 암호문이다. */
    public record Account(
            String provider,
            String accessTokenEnc,
            String refreshTokenEnc,
            Instant tokenExpiresAt,
            Set<String> scopes,
            String externalAccount,
            boolean needsReconnect,
            Instant connectedAt) {}

    private final JdbcTemplate jdbc;

    public ConnectorAccountStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Account> find(String provider) {
        List<Account> rows =
                jdbc.query(
                        """
                        select provider, access_token_enc, refresh_token_enc, token_expires_at, scopes,
                               external_account, needs_reconnect, connected_at
                          from connector_accounts where provider = ?
                        """,
                        (rs, i) ->
                                new Account(
                                        rs.getString("provider"),
                                        rs.getString("access_token_enc"),
                                        rs.getString("refresh_token_enc"),
                                        instant(rs.getTimestamp("token_expires_at")),
                                        scopes(rs.getString("scopes")),
                                        rs.getString("external_account"),
                                        rs.getBoolean("needs_reconnect"),
                                        instant(rs.getTimestamp("connected_at"))),
                        provider);
        return rows.stream().findFirst();
    }

    public List<Account> findAll() {
        return jdbc.query(
                """
                select provider, access_token_enc, refresh_token_enc, token_expires_at, scopes,
                       external_account, needs_reconnect, connected_at
                  from connector_accounts order by provider
                """,
                (rs, i) ->
                        new Account(
                                rs.getString("provider"),
                                rs.getString("access_token_enc"),
                                rs.getString("refresh_token_enc"),
                                instant(rs.getTimestamp("token_expires_at")),
                                scopes(rs.getString("scopes")),
                                rs.getString("external_account"),
                                rs.getBoolean("needs_reconnect"),
                                instant(rs.getTimestamp("connected_at"))));
    }

    /**
     * 연결 또는 재연결. 같은 제공자면 덮어쓴다 — 스코프를 더해 다시 동의받는 경우가 그렇다.
     * refresh 토큰이 새 응답에 없으면(구글은 첫 동의 뒤로는 안 준다) 옛 값을 지킨다.
     */
    public void upsert(
            String provider,
            String accessTokenEnc,
            String refreshTokenEnc,
            Instant expiresAt,
            Set<String> scopes,
            String externalAccount,
            UUID connectedBy) {
        jdbc.update(
                """
                insert into connector_accounts
                    (provider, access_token_enc, refresh_token_enc, token_expires_at, scopes, external_account,
                     needs_reconnect, connected_by, connected_at, updated_at)
                values (?, ?, ?, ?, ?, ?, false, ?, now(), now())
                on conflict (provider) do update set
                    access_token_enc  = excluded.access_token_enc,
                    refresh_token_enc = coalesce(excluded.refresh_token_enc, connector_accounts.refresh_token_enc),
                    token_expires_at  = excluded.token_expires_at,
                    scopes            = excluded.scopes,
                    external_account  = excluded.external_account,
                    needs_reconnect   = false,
                    connected_by      = excluded.connected_by,
                    connected_at      = now(),
                    updated_at        = now()
                """,
                provider,
                accessTokenEnc,
                refreshTokenEnc,
                expiresAt == null ? null : Timestamp.from(expiresAt),
                String.join(" ", scopes),
                externalAccount,
                connectedBy);
    }

    /** 갱신으로 access 토큰만 바뀌었다. */
    public void updateAccessToken(String provider, String accessTokenEnc, Instant expiresAt) {
        jdbc.update(
                "update connector_accounts set access_token_enc = ?, token_expires_at = ?, updated_at = now() where provider = ?",
                accessTokenEnc,
                expiresAt == null ? null : Timestamp.from(expiresAt),
                provider);
    }

    /** 갱신이 거절됐다. 토큰은 남겨 두되 쓰지 않는다 — 화면이 「다시 연결 필요」를 보인다. */
    public void markNeedsReconnect(String provider) {
        jdbc.update(
                "update connector_accounts set needs_reconnect = true, updated_at = now() where provider = ?",
                provider);
    }

    public void delete(String provider) {
        jdbc.update("delete from connector_accounts where provider = ?", provider);
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
