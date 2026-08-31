package com.axcore.workspace.workspace.provisioning;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

/**
 * 테넌트 스키마를 만들고 마이그레이션을 적용한다.
 *
 * <p><b>프로비저닝과 순회 배포가 같은 스크립트를 쓴다.</b> 신규 회사는 "빈 스키마에
 * {@code db/migration/tenant} 를 처음부터 전량 적용" 한 것이고, 기존 회사는 "밀린 것만 적용" 한
 * 것이다. 두 경로가 갈리지 않으므로 <i>새로 만든 스키마만 구조가 다른</i> 사고가 나지 않는다.
 * (docs/db/schema-draft-v2.md — "신규 회사 프로비저닝")
 *
 * <p>부팅 때 도는 Flyway 와는 별개다. {@code spring.flyway.locations} 는
 * {@code db/migration/shared} 만 가리키므로 이 경로는 부팅 경로에 없다. 스키마가 늘수록 부팅이
 * 선형으로 느려지고, 인스턴스 여러 대가 동시에 부팅하면 같은 스키마를 동시에 건드리기 때문이다.
 *
 * <p><b>실패하면 반쪽 스키마가 남지 않는다.</b> PostgreSQL 은 DDL 이 트랜잭션 안에서 롤백된다.
 * {@code group(true)} 로 전량을 한 트랜잭션에 묶어 두었으므로, 테이블을 만들다 중간에 실패하면
 * 앞의 것들도 함께 사라진다.
 *
 * <p><b>요청 처리용 커넥션 풀을 쓰지 않는다.</b> Flyway 는 대상 스키마를 잡으려고 자기가 빌린
 * 커넥션의 {@code search_path} 를 바꾼다. 그 커넥션이 HikariCP 로 반납돼 다음 요청에 재사용되면
 * 남의 회사 스키마를 보게 된다. Flyway 가 닫을 때 되돌리기는 하지만 테넌트 격리를 라이브러리
 * 내부 동작에 기대지 않는다 — 애초에 요청을 처리하지 않는 풀을 쓴다
 * ({@link ProvisioningDataSource}).
 */
@Component
public class TenantProvisioner {

    private static final Logger log = LoggerFactory.getLogger(TenantProvisioner.class);

    /** {@code shared} 용과 분리된 경로. 부팅 Flyway 는 이쪽을 보지 않는다. */
    private static final String TENANT_LOCATION = "classpath:db/migration/tenant";

    private final DataSource dataSource;
    private final JdbcTemplate jdbcTemplate;

    /**
     * @param provisioningDataSource DDL 전용 풀. 요청 처리용과 분리돼 있다
     * @param jdbcTemplate 기본 DataSource. 여기서 부르는 것은 {@code shared} 의 함수 둘뿐이고
     *     세션 상태를 건드리지 않아 요청용 풀을 써도 된다
     */
    public TenantProvisioner(
            ProvisioningDataSource provisioningDataSource, JdbcTemplate jdbcTemplate) {
        this.dataSource = provisioningDataSource.dataSource();
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * 스키마를 만들고 테넌트 마이그레이션을 전량 적용한다.
     *
     * <p>{@code CREATE SCHEMA} 를 {@code IF NOT EXISTS} 로 두는 이유는 재시도 때문이다.
     * 마이그레이션 도중 실패한 회사를 다시 프로비저닝할 때, 스키마만 남아 있고 테이블이 없는
     * 상태에서 여기서 막히면 손으로 지워야 한다. 마이그레이션 쪽은 Flyway 가 이력을 보고
     * 이어서 적용하므로 두 번 돌아도 안전하다.
     *
     * @param schemaName {@link SchemaName#of(long)} 로 만든 값
     * @param label 스키마 코멘트에 남길 회사 식별 문구
     * @return 적용이 끝난 뒤의 스키마 버전. 적용된 것이 없으면 null
     */
    public String provision(String schemaName, String label) {
        String schema = SchemaName.requireValid(schemaName);

        // 조립하지 않는다. CREATE SCHEMA 가 식별자를 바인딩으로 받지 못해 문자열로 이어야
        // 하는데, 그 일을 DB 함수로 넘겼다 — format 의 %I 가 식별자 인용을 서버에서 처리한다.
        // 덕분에 애플리케이션 코드에 SQL 을 잇는 자리가 남지 않는다. (V10)
        jdbcTemplate.queryForObject(
                "SELECT shared.create_tenant_schema(?)", Object.class, schema);
        log.info("테넌트 스키마 {} 를 만들었다", schema);

        comment(schema, label);
        return migrate(schema);
    }

    /**
     * 이미 있는 스키마에 밀린 마이그레이션만 적용한다. 순회 배포가 쓴다.
     *
     * <p>각 테넌트 스키마는 <b>자기 {@code flyway_schema_history} 를 갖는다.</b> 그래서 일부
     * 스키마만 실패해도 나머지는 영향받지 않고, 실패한 것만 다시 돌리면 된다.
     *
     * @return 적용이 끝난 뒤의 스키마 버전. 적용된 것이 없으면 null
     */
    public String migrate(String schemaName) {
        String schema = SchemaName.requireValid(schemaName);

        MigrateResult result =
                Flyway.configure()
                        .dataSource(dataSource)
                        // 이 스키마에만 적용한다. defaultSchema 를 함께 주지 않으면
                        // flyway_schema_history 가 엉뚱한 곳에 생겨 이력이 섞인다.
                        .schemas(schema)
                        .defaultSchema(schema)
                        .locations(TENANT_LOCATION)
                        // 전량을 한 트랜잭션으로 묶는다. Flyway 기본값은 파일마다 트랜잭션을
                        // 나누는 것이라, 중간에 실패하면 앞의 파일들이 적용된 채로 남는다.
                        .group(true)
                        // 빈 스키마에 처음 적용하는 경우다. 기본값이 false 면 "비어 있지 않은
                        // 스키마" 판정에 걸릴 수 있다.
                        .baselineOnMigrate(false)
                        .load()
                        .migrate();

        if (result.migrationsExecuted == 0) {
            log.debug("스키마 {} 는 이미 최신이다 (v{})", schema, result.targetSchemaVersion);
        } else {
            log.info(
                    "스키마 {} 에 마이그레이션 {}건을 적용했다 (v{})",
                    schema,
                    result.migrationsExecuted,
                    result.targetSchemaVersion);
        }
        return result.targetSchemaVersion;
    }

    /**
     * 스키마에 회사 식별 코멘트를 단다.
     *
     * <p><b>실패해도 프로비저닝을 막지 않는다.</b> {@code \dn+} 에서 회사를 바로 알아보기 위한
     * 운영 편의용 부가 정보이고, 이것 때문에 회사 개설이 실패하면 손해가 더 크다.
     *
     * <p>조립은 DB 함수가 한다. {@code COMMENT ON} 은 바인딩을 받지 않아 회사명을 문자열로
     * 붙일 수밖에 없는데, {@code format} 의 {@code %L} 이 이스케이프를 서버 쪽에서 처리한다.
     */
    private void comment(String schema, String label) {
        try {
            jdbcTemplate.queryForObject(
                    "SELECT shared.workspace_comment(?, ?)", Object.class, schema, label);
        } catch (RuntimeException e) {
            log.warn("스키마 {} 코멘트를 달지 못했다. 프로비저닝은 계속한다", schema, e);
        }
    }
}
