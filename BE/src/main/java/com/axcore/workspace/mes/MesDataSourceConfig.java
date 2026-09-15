package com.axcore.workspace.mes;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 고객사 MES DB 풀 설정. 값은 전부 환경 변수({@code MES_DB_*})에서 온다 — {@code application.properties} 참고.
 *
 * <p>읽기 전용이다. 드라이버({@code readOnly=true})와 풀({@code setReadOnly}) 양쪽에 걸어 두고, DB 쪽 롤도
 * SELECT 만 가진 계정을 쓴다({@code INFRA/seed/data/mes-supabase.sql} 의 {@code mes_reader}). 한 겹만 두면
 * 언젠가 뚫린다.
 */
@Configuration
public class MesDataSourceConfig {

    private static final Logger log = LoggerFactory.getLogger(MesDataSourceConfig.class);

    /** AI 한 턴에 조회 한두 번이다. 고객 DB 에 커넥션을 많이 잡고 있을 이유가 없다. */
    private static final int MAX_POOL_SIZE = 2;
    /** 고객 DB 가 느리거나 막혀 있으면 빨리 포기한다 — AI 도구 타임아웃(15초)보다 짧아야 한다. */
    private static final long CONNECTION_TIMEOUT_MS = 5_000L;
    private static final long IDLE_TIMEOUT_MS = 60_000L;

    @Bean(destroyMethod = "close")
    MesDataSource mesDataSource(
            @Value("${app.mes.db.host:}") String host,
            @Value("${app.mes.db.port:5432}") int port,
            @Value("${app.mes.db.name:postgres}") String database,
            @Value("${app.mes.db.user:}") String user,
            @Value("${app.mes.db.password:}") String password,
            @Value("${app.mes.db.sslmode:require}") String sslmode) {

        if (host.isBlank() || user.isBlank()) {
            log.info("MES DB 접속 정보가 없다 — MES 조회를 끈 채로 뜬다 (MES_DB_HOST · MES_DB_USER)");
            return new MesDataSource(null);
        }

        HikariConfig config = new HikariConfig();
        config.setPoolName("axcore-mes");
        config.setJdbcUrl("jdbc:postgresql://%s:%d/%s?sslmode=%s&readOnly=true&ApplicationName=axcore-mes"
                .formatted(host, port, database, sslmode));
        config.setUsername(user);
        config.setPassword(password);
        config.setReadOnly(true);
        config.setMaximumPoolSize(MAX_POOL_SIZE);
        config.setMinimumIdle(0);
        config.setConnectionTimeout(CONNECTION_TIMEOUT_MS);
        config.setIdleTimeout(IDLE_TIMEOUT_MS);
        // 부팅 때 고객 DB 에 붙어 보지 않는다. 그쪽이 죽어 있다고 우리 서버가 못 뜨면 안 된다
        config.setInitializationFailTimeout(-1);

        log.info("MES DB 풀을 준비했다 — {}:{}/{} (user {})", host, port, database, user);
        return new MesDataSource(new HikariDataSource(config));
    }
}
