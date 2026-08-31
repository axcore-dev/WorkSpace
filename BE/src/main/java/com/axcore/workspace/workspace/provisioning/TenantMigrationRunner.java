package com.axcore.workspace.workspace.provisioning;

import com.axcore.workspace.workspace.admin.WorkspaceRegistrar;
import com.axcore.workspace.workspace.entity.Workspace;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * 기존 회사들에 밀린 테넌트 마이그레이션을 적용한다. 배포할 때 한 번 돌린다.
 *
 * <p><b>부팅 시점에 돌지 않는다.</b> 스키마가 늘수록 부팅이 선형으로 느려지고, 인스턴스 여러
 * 대가 동시에 부팅하면 같은 스키마를 동시에 건드린다. Flyway 가 {@code pg_advisory_lock} 으로
 * 동시 실행 자체는 막아 주지만, 락 대기로 배포가 길어질 뿐이라 잡을 하나로 유지하는 게 맞다.
 * (docs/db/schema-draft-v2.md — "배포 시 전 스키마 순회")
 *
 * <p>그래서 호출 지점이 운영자 API 하나다({@code POST /api/admin/workspaces/migrate}).
 * 나중에 배포 파이프라인에서 부르는 CLI 커맨드로 옮겨도 이 클래스는 그대로 쓴다.
 *
 * <p><b>한 스키마가 실패해도 멈추지 않는다.</b> 각 테넌트 스키마는 자기
 * {@code flyway_schema_history} 를 가지므로 서로 영향이 없다. 실패한 것만 모아 돌려주고,
 * 고친 뒤 다시 돌리면 이미 끝난 스키마는 건너뛴다.
 */
@Component
public class TenantMigrationRunner {

    private static final Logger log = LoggerFactory.getLogger(TenantMigrationRunner.class);

    private final WorkspaceRegistrar registrar;
    private final TenantProvisioner provisioner;

    public TenantMigrationRunner(WorkspaceRegistrar registrar, TenantProvisioner provisioner) {
        this.registrar = registrar;
        this.provisioner = provisioner;
    }

    /**
     * 대상 스키마를 모두 순회한다.
     *
     * <p>대상은 {@code active} 와 {@code suspended} 다. {@code provisioning} 은 스키마가 아직
     * 없거나 만들다 실패한 것이라 여기서 되살리면 안 되고, {@code terminated} 는 지울 예정이라
     * 새 구조를 밀어 넣을 이유가 없다.
     */
    public Result migrateAll() {
        List<Workspace> targets = registrar.findAllMigratable();
        log.info("테넌트 마이그레이션 순회 시작. 대상 {}개", targets.size());

        List<String> migrated = new ArrayList<>();
        List<Failure> failures = new ArrayList<>();

        for (Workspace workspace : targets) {
            String schema = workspace.getSchemaName();
            try {
                String version = provisioner.migrate(schema);
                registrar.recordSchemaVersion(workspace.getId(), version);
                migrated.add(schema);
            } catch (RuntimeException e) {
                // 멈추지 않는다. 한 회사의 실패가 나머지 회사의 배포를 막을 이유가 없다.
                log.error("스키마 {} 마이그레이션 실패. 나머지는 계속한다", schema, e);
                failures.add(new Failure(workspace.getId(), schema, e.getMessage()));
            }
        }

        log.info("테넌트 마이그레이션 순회 종료. 성공 {}개, 실패 {}개", migrated.size(), failures.size());
        return new Result(targets.size(), migrated, failures);
    }

    /**
     * @param total 순회 대상 수
     * @param migrated 성공한 스키마 이름들. 이미 최신이라 적용할 것이 없던 것도 포함한다
     * @param failures 실패한 것들. 고친 뒤 다시 돌리면 된다
     */
    public record Result(int total, List<String> migrated, List<Failure> failures) {

        public boolean hasFailures() {
            return !failures.isEmpty();
        }
    }

    public record Failure(Long workspaceId, String schemaName, String message) {}
}
