package com.axcore.workspace.workspace.provisioning;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 테넌트 DDL 전용 풀 설정.
 *
 * <p>접속 정보는 기본 DataSource 와 같다. 나누는 것은 <b>커넥션</b>이지 데이터베이스가 아니다.
 */
@Configuration
public class ProvisioningDataSourceConfig {

    /**
     * 프로비저닝은 드물고, 순회 배포는 잡 하나로 유지하는 것이 맞다. 그래서 작게 잡는다.
     *
     * <p>2 인 이유: 하나는 지금 도는 마이그레이션, 하나는 그 사이 들어온 개설 요청이다. 더 늘려
     * 봐야 Flyway 가 {@code pg_advisory_lock} 으로 직렬화하므로 대기만 늘어난다.
     */
    private static final int MAX_POOL_SIZE = 2;

    /**
     * DDL 은 오래 걸릴 수 있다. 기본 30초로는 테이블이 많은 마이그레이션이 중간에 끊긴다.
     */
    private static final long CONNECTION_TIMEOUT_MS = 60_000L;

    /** 쓰지 않을 때 커넥션을 붙잡고 있을 이유가 없다. */
    private static final long IDLE_TIMEOUT_MS = 60_000L;

    @Bean(destroyMethod = "close")
    ProvisioningDataSource provisioningDataSource(
            @Value("${spring.datasource.url}") String url,
            @Value("${spring.datasource.username}") String username,
            @Value("${spring.datasource.password}") String password) {

        HikariConfig config = new HikariConfig();
        config.setPoolName("axcore-provisioning");
        config.setJdbcUrl(url);
        config.setUsername(username);
        config.setPassword(password);
        config.setMaximumPoolSize(MAX_POOL_SIZE);
        config.setMinimumIdle(0);
        config.setConnectionTimeout(CONNECTION_TIMEOUT_MS);
        config.setIdleTimeout(IDLE_TIMEOUT_MS);
        // Flyway 가 자기 트랜잭션을 직접 연다. 자동 커밋으로 두면 group(true) 로 묶은 의미가
        // 없어지지는 않지만(Flyway 가 끄고 켠다), 의도를 명시해 둔다.
        config.setAutoCommit(false);

        return new ProvisioningDataSource(new HikariDataSource(config));
    }
}
