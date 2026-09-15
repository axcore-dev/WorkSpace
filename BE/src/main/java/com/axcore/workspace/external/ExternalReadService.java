package com.axcore.workspace.external;

import com.axcore.workspace.connector.ConnectorUnavailableException;
import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.settings.FeatureCatalog;
import com.axcore.workspace.workspace.settings.ModuleTabAccess;
import com.axcore.workspace.workspace.settings.SettingsForbiddenException;
import com.axcore.workspace.workspace.settings.SettingsNotFoundException;
import com.axcore.workspace.workspace.settings.SettingsValidationException;
import com.axcore.workspace.workspace.settings.TenantAccess;
import com.axcore.workspace.workspace.settings.TenantContext;
import java.sql.Date;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 외부 시스템 읽기 — 이 회사의 개념 행으로 질의를 짓고 그 시스템의 풀로 읽는다. AI 의 {@code workspace_data} 도구가 부른다.
 *
 * <p>권한은 우리 DB 에서 본다({@code ModuleTabAccess.open}, 개념 행의 탭). 값은 외부 DB 에서 읽는다. 두 DB 라 트랜잭션은
 * 우리 쪽만 걸리고 외부 쪽은 자동 커밋 읽기다 — 읽기만 하므로 상관없다.
 *
 * <p>시각은 MES 가 현지 시각(무 tz)으로 저장한 것이라 그대로 문자열로 준다. Jackson 에 {@code Timestamp} 를 맡기면
 * UTC 로 바꿔 9시간 어긋난 값이 나간다.
 */
@Service
public class ExternalReadService {

    private static final Logger log = LoggerFactory.getLogger(ExternalReadService.class);
    private static final int QUERY_TIMEOUT_SEC = 10;

    private final TenantAccess tenants;
    private final ModuleTabAccess access;
    private final ExternalConceptStore concepts;
    private final ExternalDataSourceRegistry registry;

    public ExternalReadService(TenantAccess tenants, ModuleTabAccess access, ExternalConceptStore concepts, ExternalDataSourceRegistry registry) {
        this.tenants = tenants;
        this.access = access;
        this.concepts = concepts;
        this.registry = registry;
    }

    /** 이 회사의 개념 전부(SQL 제외는 컨트롤러가 한다). FE 가 사람의 탭으로 거른다 — 여기서는 권한을 보지 않는다 */
    @Transactional(readOnly = true)
    public List<ExternalConcept> ontology(JwtPrincipal principal) {
        tenants.open(principal);
        return concepts.all();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> read(JwtPrincipal principal, long systemId, String conceptId, Map<String, String> equals) {
        TenantContext ctx = tenants.open(principal);
        ExternalConcept concept = concepts.byConceptId(conceptId)
                .filter(c -> c.systemId() == systemId)
                .orElseThrow(() -> new SettingsNotFoundException("'%s' 는 이 시스템에서 조회할 수 있는 자료가 아니에요".formatted(conceptId)));
        // 개념의 탭이 속한 모듈 규칙 — 이 사람이 그 탭을 가졌고 회사가 켰는가. 내장 개념과 같은 두 겹이다
        String module = FeatureCatalog.modules().stream().filter(m -> m.tabs().contains(concept.tab())).map(FeatureCatalog.Module::slug).findFirst()
                .orElseThrow(() -> new SettingsForbiddenException("이 기능을 볼 권한이 없습니다"));
        access.open(principal, module, concept.tab());

        ExternalDataSource ds = registry.forSystem(ctx.schemaName(), systemId).orElseThrow(
                () -> new ConnectorUnavailableException("이 시스템의 접속 정보가 없어요. 운영팀이 운영 콘솔에서 등록해요"));
        ExternalQuery.Query q;
        try {
            q = ExternalQuery.build(concept, equals);
        } catch (IllegalArgumentException e) {
            throw new SettingsValidationException(e.getMessage());
        }

        JdbcTemplate jdbc = new JdbcTemplate(ds.dataSource());
        jdbc.setQueryTimeout(QUERY_TIMEOUT_SEC);
        jdbc.setMaxRows(ExternalQuery.MAX_ROWS);
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(q.sql(), q.params().toArray());
            rows.forEach(ExternalReadService::localizeTimes);
            return rows;
        } catch (DataAccessException e) {
            // 고객 DB 가 죽었거나 느리다. 원인은 로그로, 화면에는 "지금은 안 된다" 로
            log.warn("외부 시스템 조회 실패 — system {} concept {}", systemId, conceptId, e);
            throw new ConnectorUnavailableException("외부 시스템에서 자료를 읽지 못했어요. 잠시 후 다시 시도해 주세요");
        }
    }

    private static void localizeTimes(Map<String, Object> row) {
        row.replaceAll((k, v) -> switch (v) {
            case Timestamp t -> t.toLocalDateTime().toString();
            case Date d -> d.toLocalDate().toString();
            case null, default -> v;
        });
    }
}
