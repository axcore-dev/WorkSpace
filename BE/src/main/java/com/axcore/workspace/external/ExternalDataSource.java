package com.axcore.workspace.external;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Optional;
import java.util.Properties;
import javax.sql.DataSource;

/**
 * 외부 시스템(고객사 MES · ERP DB) 읽기 전용 커넥션 풀 하나 — {@code external_systems} 행 하나에 풀 하나.
 * {@link ExternalDataSourceRegistry} 가 회사 · 시스템별로 들고 있다.
 *
 * <p><b>{@code DataSource} 를 그대로 빈으로 두지 않는다.</b> {@code DataSourceAutoConfiguration} 은
 * {@code @ConditionalOnMissingBean(DataSource.class)} 라 {@code DataSource} 빈을 하나라도 직접 만들면 기본
 * DataSource 자동 설정이 통째로 꺼진다. {@link com.axcore.workspace.workspace.provisioning.ProvisioningDataSource}
 * 와 같은 이유로 한 겹 감싼다.
 *
 * <p>읽기 전용이다. 드라이버({@code readOnly=true})와 풀({@code setReadOnly}) 양쪽에 걸어 두고, DB 쪽 롤도
 * SELECT 만 가진 계정을 쓴다({@code INFRA/seed/data/mes-supabase.sql} 의 {@code mes_reader}). 한 겹만 두면
 * 언젠가 뚫린다.
 */
public final class ExternalDataSource implements AutoCloseable {

    /** AI 한 턴에 조회 한두 번이다. 고객 DB 에 커넥션을 많이 잡고 있을 이유가 없다. */
    private static final int MAX_POOL_SIZE = 2;
    /** 고객 DB 가 느리거나 막혀 있으면 빨리 포기한다 — AI 도구 타임아웃(15초)보다 짧아야 한다. */
    private static final long CONNECTION_TIMEOUT_MS = 5_000L;
    private static final long IDLE_TIMEOUT_MS = 60_000L;
    private static final int PING_TIMEOUT_SEC = 2;

    /**
     * 접속 정보 — {@code external_systems} 행 하나. {@code fingerprint} 는 행 id 와 {@code updated_at} 이라 운영 콘솔이
     * 행을 고치면 값이 바뀌고, 레지스트리가 옛 풀을 닫고 새로 연다.
     */
    public record Connection(long id, String host, int port, String database, String user, String sslmode, String fingerprint) {
        String jdbcUrl() {
            return "jdbc:postgresql://%s:%d/%s?sslmode=%s&readOnly=true&ApplicationName=axcore-external".formatted(host, port, database, sslmode);
        }
    }

    private final HikariDataSource delegate;
    private final String fingerprint;

    private ExternalDataSource(HikariDataSource delegate, String fingerprint) {
        this.delegate = delegate;
        this.fingerprint = fingerprint;
    }

    static ExternalDataSource open(Connection c, String password) {
        HikariConfig config = new HikariConfig();
        config.setPoolName("axcore-external-" + c.id());
        config.setJdbcUrl(c.jdbcUrl());
        config.setUsername(c.user());
        config.setPassword(password);
        config.setReadOnly(true);
        config.setMaximumPoolSize(MAX_POOL_SIZE);
        config.setMinimumIdle(0);
        config.setConnectionTimeout(CONNECTION_TIMEOUT_MS);
        config.setIdleTimeout(IDLE_TIMEOUT_MS);
        // 여는 시점에 고객 DB 에 붙어 보지 않는다. 그쪽이 죽어 있다고 우리 요청이 여기서 터지면 안 된다
        config.setInitializationFailTimeout(-1);
        return new ExternalDataSource(new HikariDataSource(config), c.fingerprint());
    }

    /**
     * 풀 없이 한 번 붙어 본다 — 운영 콘솔의 「연결 테스트」. 실패 이유를 문장으로 돌려준다(드라이버 메시지 그대로).
     * 비밀번호가 틀렸는지 · 호스트가 막혔는지를 운영자가 바로 봐야 해서 풀의 조용한 실패와 다르게 둔다.
     */
    public static Optional<String> probe(Connection c, String password) {
        Properties props = new Properties();
        props.setProperty("user", c.user());
        props.setProperty("password", password);
        props.setProperty("connectTimeout", String.valueOf(CONNECTION_TIMEOUT_MS / 1000));
        props.setProperty("loginTimeout", String.valueOf(CONNECTION_TIMEOUT_MS / 1000));
        try (java.sql.Connection conn = DriverManager.getConnection(c.jdbcUrl(), props)) {
            return conn.isValid(PING_TIMEOUT_SEC) ? Optional.empty() : Optional.of("연결은 됐지만 응답이 없어요");
        } catch (SQLException e) {
            return Optional.of(e.getMessage() == null ? "연결하지 못했어요" : e.getMessage().strip());
        }
    }

    boolean sameAs(Connection c) {
        return fingerprint.equals(c.fingerprint());
    }

    public DataSource dataSource() {
        return delegate;
    }

    /**
     * 지금 그 DB 에 붙는가 — 연동 화면의 상태 배지(ok · down)가 본다.
     * 풀 타임아웃(5초) 안에 커넥션을 못 받거나 {@code isValid} 가 거짓이면 down 이다.
     */
    public boolean ping() {
        try (java.sql.Connection c = delegate.getConnection()) {
            return c.isValid(PING_TIMEOUT_SEC);
        } catch (SQLException e) {
            return false;
        }
    }

    @Override
    public void close() {
        delegate.close();
    }
}
