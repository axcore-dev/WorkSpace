package com.axcore.workspace.mes;

import com.axcore.workspace.connector.ConnectorUnavailableException;
import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.settings.ModuleTabAccess;
import com.axcore.workspace.workspace.settings.SettingsNotFoundException;
import com.axcore.workspace.workspace.settings.SettingsValidationException;
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
 * MES 읽기 — 고객사 MES DB 에서 개념 하나를 읽어 행 목록으로 준다. AI 의 {@code workspace_data} 도구가 부른다.
 *
 * <p>권한은 우리 DB 에서 본다({@code ModuleTabAccess.openRead}, 트랜잭션 필요). 값은 MES DB 에서 읽는다. 두 DB 라
 * 트랜잭션은 우리 쪽만 걸리고 MES 쪽은 자동 커밋 읽기다 — 읽기만 하므로 상관없다.
 *
 * <p>시각은 MES 가 현지 시각(무 tz)으로 저장한 것이라 그대로 문자열로 준다. Jackson 에 {@code Timestamp} 를 맡기면
 * UTC 로 바꿔 9시간 어긋난 값이 나간다.
 */
@Service
public class MesReadService {

    private static final Logger log = LoggerFactory.getLogger(MesReadService.class);
    private static final int QUERY_TIMEOUT_SEC = 10;

    private final ModuleTabAccess access;
    private final MesDataSourceRegistry registry;

    public MesReadService(ModuleTabAccess access, MesDataSourceRegistry registry) {
        this.access = access;
        this.registry = registry;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> read(JwtPrincipal principal, String conceptId, Map<String, String> equals) {
        MesConcepts.Concept concept = MesConcepts.find(conceptId)
                .orElseThrow(() -> new SettingsNotFoundException(
                        "'%s' 는 MES 에서 조회할 수 있는 자료가 아니에요. 가능한 값: %s".formatted(conceptId, String.join(", ", MesConcepts.ids()))));
        TenantContext ctx = access.openRead(principal, concept.module());

        MesDataSource mes = registry.forTenant(ctx.schemaName()).orElseThrow(
                () -> new ConnectorUnavailableException("이 회사에 등록된 MES 연동이 없어요. 운영팀이 운영 콘솔에서 등록해요"));
        MesConcepts.Query q;
        try {
            q = MesConcepts.build(concept, equals);
        } catch (IllegalArgumentException e) {
            throw new SettingsValidationException(e.getMessage());
        }

        JdbcTemplate jdbc = new JdbcTemplate(mes.dataSource());
        jdbc.setQueryTimeout(QUERY_TIMEOUT_SEC);
        jdbc.setMaxRows(MesConcepts.MAX_ROWS);
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(q.sql(), q.params().toArray());
            rows.forEach(MesReadService::localizeTimes);
            return rows;
        } catch (DataAccessException e) {
            // 고객 DB 가 죽었거나 느리다. 원인은 로그로, 화면에는 "지금은 안 된다" 로
            log.warn("MES 조회 실패 — concept {}", conceptId, e);
            throw new ConnectorUnavailableException("MES 에서 자료를 읽지 못했어요. 잠시 후 다시 시도해 주세요");
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
