package com.axcore.workspace.external;

import com.axcore.workspace.connector.TokenCipher;
import jakarta.annotation.PreDestroy;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * 회사 · 시스템별 풀 — 테넌트 스키마의 {@code external_systems} 행(host 있음)으로 {@link ExternalDataSource} 를 만들어 들고 있다.
 *
 * <p><b>트랜잭션 안, 테넌트 search_path 가 묶인 뒤에 부른다.</b> 행을 읽는 SQL 이 스키마 이름을 붙이지 않고 그 회사의
 * 표를 보게 돼 있다({@code TenantAccess.open} · {@code TenantSearchPath.bind} 뒤).
 *
 * <p>풀은 처음 부를 때 열고, 행의 지문(id + updated_at)이 바뀌면 옛 풀을 닫고 다시 연다. 운영 콘솔이 행을 고치거나 지우면
 * 다음 조회부터 반영되므로 콘솔 쪽이 이 레지스트리를 알 필요가 없다. 서버는 한 대다(2vCPU 한 대) — 여러 대가 되면 각자
 * 풀을 갖고 각자 지문을 보니 그대로 동작한다.
 */
@Component
public class ExternalDataSourceRegistry {

    private static final Logger log = LoggerFactory.getLogger(ExternalDataSourceRegistry.class);

    static final String SQL =
            """
            select id, host, port, db_name, db_user, db_password_enc, sslmode, updated_at
              from external_systems
             where id = ? and host is not null
            """;

    private final JdbcTemplate jdbc;
    private final TokenCipher cipher;
    /** 키는 "스키마:시스템 id" — 회사가 달라도 시스템 id 가 겹칠 수 있다(테넌트마다 bigserial) */
    private final Map<String, ExternalDataSource> pools = new ConcurrentHashMap<>();

    public ExternalDataSourceRegistry(JdbcTemplate jdbc, TokenCipher cipher) {
        this.jdbc = jdbc;
        this.cipher = cipher;
    }

    /** 이 회사의 이 시스템 풀. 행이 없거나 접속 정보가 없으면 empty. */
    public Optional<ExternalDataSource> forSystem(String schemaName, long systemId) {
        String key = schemaName + ":" + systemId;
        List<Row> rows = jdbc.query(SQL, (rs, i) -> new Row(
                new ExternalDataSource.Connection(
                        rs.getLong("id"), rs.getString("host"), rs.getInt("port"), rs.getString("db_name"),
                        rs.getString("db_user"), rs.getString("sslmode"),
                        fingerprint(rs.getLong("id"), rs.getTimestamp("updated_at"))),
                rs.getString("db_password_enc")), systemId);
        if (rows.isEmpty()) {
            ExternalDataSource stale = pools.remove(key);
            if (stale != null) {
                stale.close();
            }
            return Optional.empty();
        }
        Row row = rows.getFirst();
        return Optional.of(pools.compute(key, (k, old) -> {
            if (old != null && old.sameAs(row.connection())) {
                return old;
            }
            if (old != null) {
                old.close();
            }
            log.info("외부 시스템 풀을 연다 — {} · {}:{}/{} (user {})", key,
                    row.connection().host(), row.connection().port(), row.connection().database(), row.connection().user());
            return ExternalDataSource.open(row.connection(), row.passwordEnc() == null ? "" : cipher.decrypt(row.passwordEnc()));
        }));
    }

    static String fingerprint(long id, Timestamp updatedAt) {
        return id + ":" + (updatedAt == null ? 0L : updatedAt.getTime());
    }

    @PreDestroy
    void closeAll() {
        pools.values().forEach(ExternalDataSource::close);
        pools.clear();
    }

    private record Row(ExternalDataSource.Connection connection, String passwordEnc) {}
}
