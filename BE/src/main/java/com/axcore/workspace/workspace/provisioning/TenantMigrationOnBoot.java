package com.axcore.workspace.workspace.provisioning;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * 부팅이 끝난 뒤 기존 회사 스키마에 밀린 테넌트 마이그레이션을 한 번 적용한다.
 *
 * <p>{@link TenantMigrationRunner} 는 원래 운영자 API 로만 불렀다(부팅 시점 실행을 피한 이유는 그 클래스 주석 참고).
 * 그런데 배포마다 사람이 API 를 한 번 눌러야 하고, 잊으면 새 테이블이 없는 채로 앱이 떠서 첫 요청이 500 으로 터진다.
 * 서버가 한 대인 지금은 동시 부팅 문제가 없고, 스키마 수도 적어 부팅 뒤에 뒤에서 돌려도 무리가 없다.
 *
 * <p><b>부팅을 막지 않는다.</b> {@code ApplicationReadyEvent} 뒤 별도 스레드에서 돌리므로 헬스체크는 먼저 통과하고,
 * 마이그레이션이 끝나기 전 잠깐은 새 테이블이 없을 수 있다. 실패한 회사는 로그에 남고, 운영자 API
 * ({@code POST /api/admin/workspaces/migrate})로 다시 적용하면 된다 — 성공한 스키마는 Flyway 가 건너뛴다.
 *
 * <p>{@code app.tenant.migrate-on-boot=true}({@code TENANT_MIGRATE_ON_BOOT}) 일 때만 켜진다. 인스턴스를 여러 대로
 * 늘리면 끄고 파이프라인에서 한 번 부르는 쪽으로 옮긴다 — Flyway 잠금이 동시 실행을 막아 주지만 락 대기로 배포가 늘어진다.
 */
@Component
@ConditionalOnProperty(name = "app.tenant.migrate-on-boot", havingValue = "true")
public class TenantMigrationOnBoot {

    private static final Logger log = LoggerFactory.getLogger(TenantMigrationOnBoot.class);

    private final TenantMigrationRunner runner;

    public TenantMigrationOnBoot(TenantMigrationRunner runner) {
        this.runner = runner;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        // 가상 스레드 — 요청 처리 스레드를 빌리지 않고, 끝나면 사라진다 (spring.threads.virtual.enabled=true)
        Thread.ofVirtual().name("tenant-migrate-on-boot").start(this::run);
    }

    private void run() {
        log.info("부팅 후 테넌트 마이그레이션을 시작한다 (app.tenant.migrate-on-boot=true)");
        try {
            TenantMigrationRunner.Result result = runner.migrateAll();
            if (result.hasFailures()) {
                log.error(
                        "테넌트 마이그레이션 일부 실패 — 성공 {}개, 실패 {}개. 실패 목록: {}. "
                                + "고친 뒤 POST /api/admin/workspaces/migrate 로 다시 적용한다",
                        result.migrated().size(),
                        result.failures().size(),
                        result.failures());
            } else {
                log.info("테넌트 마이그레이션 완료 — 대상 {}개 전부 최신", result.total());
            }
        } catch (RuntimeException e) {
            // 여기서 죽어도 앱은 계속 뜬다. 대상 목록 조회 실패 같은 전체 실패만 여기로 온다
            log.error("테넌트 마이그레이션을 시작하지 못했다. POST /api/admin/workspaces/migrate 로 수동 적용한다", e);
        }
    }
}
