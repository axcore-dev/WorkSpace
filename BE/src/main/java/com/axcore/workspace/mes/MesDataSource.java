package com.axcore.workspace.mes;

import com.zaxxer.hikari.HikariDataSource;
import java.sql.Connection;
import java.sql.SQLException;
import javax.sql.DataSource;

/**
 * 고객사 MES DB 읽기 전용 커넥션 풀. 요청 처리 풀(우리 DB)과 완전히 다른 데이터베이스다.
 *
 * <p><b>{@code DataSource} 를 그대로 빈으로 두지 않는다.</b> {@code DataSourceAutoConfiguration} 은
 * {@code @ConditionalOnMissingBean(DataSource.class)} 라 {@code DataSource} 빈을 하나라도 직접 만들면 기본
 * DataSource 자동 설정이 통째로 꺼진다. {@link com.axcore.workspace.workspace.provisioning.ProvisioningDataSource}
 * 와 같은 이유로 한 겹 감싼다.
 *
 * <p>접속 정보가 없으면({@code MES_DB_HOST} 비어 있음) 풀 없이 뜬다 — 서버는 정상 부팅하고 MES 조회만 503 이다.
 * 고객사마다 MES 가 있는 것이 아니고, 로컬 개발에서는 대개 없다.
 */
public final class MesDataSource implements AutoCloseable {

    private static final int PING_TIMEOUT_SEC = 2;
    private final HikariDataSource delegate;

    public MesDataSource(HikariDataSource delegate) {
        this.delegate = delegate;
    }

    public boolean available() {
        return delegate != null;
    }

    public DataSource dataSource() {
        return delegate;
    }

    /**
     * 지금 MES DB 에 붙는가 — 연동 화면의 상태 배지(ok · down)가 본다. 설정이 없으면 false.
     * 풀 타임아웃(5초) 안에 커넥션을 못 받거나 {@code isValid} 가 거짓이면 down 이다.
     */
    public boolean ping() {
        if (delegate == null) {
            return false;
        }
        try (Connection c = delegate.getConnection()) {
            return c.isValid(PING_TIMEOUT_SEC);
        } catch (SQLException e) {
            return false;
        }
    }

    @Override
    public void close() {
        if (delegate != null) {
            delegate.close();
        }
    }
}
