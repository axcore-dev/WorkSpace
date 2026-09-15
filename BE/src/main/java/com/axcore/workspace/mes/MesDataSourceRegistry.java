package com.axcore.workspace.mes;

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
 * 회사별 MES 풀 — 테넌트 스키마의 {@code external_systems} 행(kind MES, host 있음)으로 {@link MesDataSource} 를 만들어 들고 있다.
 *
 * <p><b>트랜잭션 안, 테넌트 search_path 가 묶인 뒤에 부른다.</b> 행을 읽는 SQL 이 스키마 이름을 붙이지 않고 그 회사의
 * 표를 보게 돼 있다({@code TenantAccess.open} · {@code TenantSearchPath.bind} 뒤).
 *
 * <p>풀은 처음 부를 때 열고, 행의 지문(id + updated_at)이 바뀌면 옛 풀을 닫고 다시 연다. 운영 콘솔이 행을 고치거나 지우면
 * 다음 조회부터 반영되므로 콘솔 쪽이 이 레지스트리를 알 필요가 없다. 서버는 한 대다(2vCPU 한 대) — 여러 대가 되면 각자
 * 풀을 갖고 각자 지문을 보니 그대로 동작한다.
 *
 * <p>회사당 MES 는 하나다. 접속 정보가 있는 MES 행이 둘 이상이면 정렬(sort_order, id) 첫 행이고, 운영 콘솔이 둘째를 막는다.
 */
@Component
public class MesDataSourceRegistry {

    private static final Logger log = LoggerFactory.getLogger(MesDataSourceRegistry.class);

    static final String SQL =
            """
            select id, host, port, db_name, db_user, db_password_enc, sslmode, updated_at
              from external_systems
             where kind = 'MES' and host is not null
             order by sort_order, id
             limit 1
            """;

    private final JdbcTemplate jdbc;
    private final TokenCipher cipher;
    private final Map<String, MesDataSource> pools = new ConcurrentHashMap<>();

    public MesDataSourceRegistry(JdbcTemplate jdbc, TokenCipher cipher) {
        this.jdbc = jdbc;
        this.cipher = cipher;
    }

    /** 이 회사의 MES 풀. 접속 정보가 있는 MES 행이 없으면 empty — 그 회사는 MES 연동이 없는 것이다. */
    public Optional<MesDataSource> forTenant(String schemaName) {
        List<Row> rows = jdbc.query(SQL, (rs, i) -> new Row(
                new MesDataSource.Connection(
                        rs.getLong("id"), rs.getString("host"), rs.getInt("port"), rs.getString("db_name"),
                        rs.getString("db_user"), rs.getString("sslmode"),
                        fingerprint(rs.getLong("id"), rs.getTimestamp("updated_at"))),
                rs.getString("db_password_enc")));
        if (rows.isEmpty()) {
            MesDataSource stale = pools.remove(schemaName);
            if (stale != null) {
                stale.close();
            }
            return Optional.empty();
        }
        Row row = rows.getFirst();
        return Optional.of(pools.compute(schemaName, (k, old) -> {
            if (old != null && old.sameAs(row.connection())) {
                return old;
            }
            if (old != null) {
                old.close();
            }
            log.info("MES 풀을 연다 — 테넌트 {} · {}:{}/{} (user {})", schemaName,
                    row.connection().host(), row.connection().port(), row.connection().database(), row.connection().user());
            return MesDataSource.open(row.connection(), row.passwordEnc() == null ? "" : cipher.decrypt(row.passwordEnc()));
        }));
    }

    static String fingerprint(long id, Timestamp updatedAt) {
        return id + ":" + (updatedAt == null ? 0L : updatedAt.getTime());
    }

    @PreDestroy
    void closeAll() {
        pools.values().forEach(MesDataSource::close);
        pools.clear();
    }

    private record Row(MesDataSource.Connection connection, String passwordEnc) {}
}
