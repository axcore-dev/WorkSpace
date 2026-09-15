package com.axcore.workspace.workspace.admin.service;

import com.axcore.workspace.external.ExternalConcept;
import com.axcore.workspace.external.ExternalConceptStore;
import com.axcore.workspace.external.ExternalConceptTemplates;
import com.axcore.workspace.external.ExternalDataSource;
import com.axcore.workspace.external.ExternalDataSourceRegistry;
import com.axcore.workspace.external.ExternalQuery;
import com.axcore.workspace.external.OntologyDrafter;
import com.axcore.workspace.external.SchemaIntrospector;
import com.axcore.workspace.workspace.admin.dto.ExternalConceptAdminResponse;
import com.axcore.workspace.workspace.admin.dto.ExternalConceptRequest;
import com.axcore.workspace.workspace.admin.entity.AdminAuditAction;
import com.axcore.workspace.workspace.admin.exception.WorkspaceStateException;
import com.axcore.workspace.workspace.provisioning.TenantSearchPath;
import com.axcore.workspace.workspace.settings.FeatureCatalog;
import com.axcore.workspace.workspace.settings.SettingsNotFoundException;
import com.axcore.workspace.workspace.settings.SettingsValidationException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 운영 콘솔 › 워크스페이스 › 연동 — 시스템의 개념(온톨로지) 등록 · 수정 · 삭제 · 템플릿 · 미리보기.
 *
 * <p>{@link AdminExternalSystemService} 와 같은 방식으로 회사 스키마를 열고({@link TenantSearchPath}) 행을 만진다. SQL 은
 * 내부 관리자가 쓰는 것이라 신뢰하되 {@link ExternalQuery#problem} 이 모양을 보고, 「미리보기」가 그 시스템의 읽기 전용 풀로
 * 5행만 돌려 컬럼을 보여 준다 — attrs 의 키를 SELECT 컬럼과 맞추는 데 쓴다.
 */
@Service
public class AdminExternalConceptService {

    private static final int PREVIEW_ROWS = 5;
    private static final int PREVIEW_TIMEOUT_SEC = 10;

    private final WorkspaceRegistrar registrar;
    private final TenantSearchPath searchPath;
    private final JdbcTemplate jdbc;
    private final ExternalConceptStore store;
    private final ExternalDataSourceRegistry registry;
    private final SchemaIntrospector introspector;
    private final AdminAuditRecorder audit;

    public AdminExternalConceptService(
            WorkspaceRegistrar registrar, TenantSearchPath searchPath, JdbcTemplate jdbc, ExternalConceptStore store,
            ExternalDataSourceRegistry registry, SchemaIntrospector introspector, AdminAuditRecorder audit) {
        this.registrar = registrar;
        this.searchPath = searchPath;
        this.jdbc = jdbc;
        this.store = store;
        this.registry = registry;
        this.introspector = introspector;
        this.audit = audit;
    }

    /** 이 회사의 개념 전부 — 온톨로지 화면이 한 번에 받는다 */
    @Transactional(readOnly = true)
    public List<ExternalConceptAdminResponse> list(Long workspaceId) {
        open(workspaceId);
        return store.all().stream().map(ExternalConceptAdminResponse::of).toList();
    }

    @Transactional
    public ExternalConceptAdminResponse create(UUID actor, Long workspaceId, long systemId, ExternalConceptRequest req) {
        open(workspaceId);
        requireSystem(systemId);
        ExternalConcept c = req.toConcept(0, systemId);
        validate(c, null);
        long id = store.insert(c);
        audit.record(actor, AdminAuditAction.UPDATE, workspaceId, "개념 등록: " + c.conceptId());
        return ExternalConceptAdminResponse.of(store.byId(id).orElseThrow());
    }

    @Transactional
    public ExternalConceptAdminResponse update(UUID actor, Long workspaceId, long id, ExternalConceptRequest req) {
        open(workspaceId);
        ExternalConcept before = store.byId(id).orElseThrow(() -> new SettingsNotFoundException("개념을 찾지 못했어요"));
        ExternalConcept c = req.toConcept(id, before.systemId());
        validate(c, id);
        store.update(id, c);
        audit.record(actor, AdminAuditAction.UPDATE, workspaceId, "개념 수정: " + before.conceptId());
        return ExternalConceptAdminResponse.of(store.byId(id).orElseThrow());
    }

    @Transactional
    public void delete(UUID actor, Long workspaceId, long id) {
        open(workspaceId);
        ExternalConcept before = store.byId(id).orElseThrow(() -> new SettingsNotFoundException("개념을 찾지 못했어요"));
        store.delete(id);
        audit.record(actor, AdminAuditAction.UPDATE, workspaceId, "개념 삭제: " + before.conceptId());
    }

    /** 템플릿의 개념을 이 시스템에 넣는다. 이미 있는 concept_id 는 건너뛴다 — 여러 번 눌러도 된다 */
    @Transactional
    public List<ExternalConceptAdminResponse> applyTemplate(UUID actor, Long workspaceId, long systemId, String templateKey) {
        open(workspaceId);
        requireSystem(systemId);
        ExternalConceptTemplates.Template t = ExternalConceptTemplates.find(templateKey)
                .orElseThrow(() -> new SettingsNotFoundException("템플릿을 찾지 못했어요: " + templateKey));
        int added = 0;
        for (ExternalConcept c : t.concepts()) {
            if (store.conceptIdTaken(c.conceptId(), null)) {
                continue;
            }
            store.insert(new ExternalConcept(0, systemId, null, null, c.conceptId(), c.name(), c.synonyms(), c.tab(), c.description(),
                    c.attrs(), c.relations(), c.formula(), c.sql(), c.filterColumns(), c.orderBy(), c.sortOrder()));
            added++;
        }
        audit.record(actor, AdminAuditAction.UPDATE, workspaceId, "개념 템플릿 적용: %s (%d개)".formatted(t.name(), added));
        return store.ofSystem(systemId).stream().map(ExternalConceptAdminResponse::of).toList();
    }

    /**
     * SQL 을 그 시스템의 읽기 전용 풀로 5행만 돌려 본다. 저장 전 본문으로도, 저장된 개념으로도 부를 수 있다.
     *
     * @return 컬럼 이름 순서 그대로의 행들. 컬럼 목록은 첫 행의 키 순서다(행이 없으면 빈 목록)
     */
    @Transactional(readOnly = true)
    public Preview preview(Long workspaceId, long systemId, String sql) {
        String schema = open(workspaceId);
        requireSystem(systemId);
        // 정렬 · 허용 컬럼은 아직 없다 — SQL 본문만 본다(정렬 자리에 임시값을 넣으면 정렬 규칙에 걸려 미리보기가 안 됐다)
        ExternalQuery.sqlProblem(sql).ifPresent(m -> { throw new SettingsValidationException(m); });
        ExternalDataSource ds = registry.forSystem(schema, systemId)
                .orElseThrow(() -> new SettingsValidationException("이 시스템에 접속 정보가 없어요. 먼저 접속 정보를 등록해 주세요"));
        JdbcTemplate ext = new JdbcTemplate(ds.dataSource());
        ext.setQueryTimeout(PREVIEW_TIMEOUT_SEC);
        ext.setMaxRows(PREVIEW_ROWS);
        try {
            List<Map<String, Object>> rows = ext.queryForList("select * from (" + sql.strip() + ") t limit " + PREVIEW_ROWS);
            rows.forEach(r -> r.replaceAll((k, v) -> v == null ? null : v.toString()));
            List<String> columns = rows.isEmpty() ? List.of() : List.copyOf(rows.getFirst().keySet());
            return new Preview(columns, rows, null);
        } catch (DataAccessException e) {
            Throwable root = e.getMostSpecificCause();
            return new Preview(List.of(), List.of(), root.getMessage() == null ? "실행하지 못했어요" : root.getMessage().strip());
        }
    }

    /** @param error 실행 실패면 DB 가 준 이유. 성공이면 null */
    public record Preview(List<String> columns, List<Map<String, Object>> rows, String error) {}

    /**
     * 외부 DB 의 구조 — 스키마 목록과 고른 스키마의 표. 「DB 에서 초안 만들기」 모달이 먼저 부른다.
     *
     * @param schema 비면 첫 스키마(있으면 {@code public} 보다 다른 것을 앞세운다 — Supabase 는 public 이 비어 있기 일쑤)
     */
    @Transactional(readOnly = true)
    public Introspection introspect(Long workspaceId, long systemId, String schema) {
        String tenant = open(workspaceId);
        requireSystem(systemId);
        ExternalDataSource ds = registry.forSystem(tenant, systemId)
                .orElseThrow(() -> new SettingsValidationException("이 시스템에 접속 정보가 없어요. 먼저 접속 정보를 등록해 주세요"));
        try {
            List<String> schemas = introspector.schemas(ds);
            if (schemas.isEmpty()) {
                return new Introspection(List.of(), null, List.of(), null);
            }
            String chosen = schema != null && schemas.contains(schema) ? schema
                    : schemas.stream().filter(s -> !s.equals("public")).findFirst().orElse(schemas.getFirst());
            return new Introspection(schemas, chosen, introspector.tables(ds, chosen), null);
        } catch (DataAccessException e) {
            Throwable root = e.getMostSpecificCause();
            return new Introspection(List.of(), null, List.of(), root.getMessage() == null ? "구조를 읽지 못했어요" : root.getMessage().strip());
        }
    }

    /** @param error 접속 · 조회 실패면 DB 가 준 이유. 성공이면 null */
    public record Introspection(List<String> schemas, String schema, List<SchemaIntrospector.Table> tables, String error) {}

    /**
     * 고른 표를 규칙으로 개념 초안으로 만들어 넣는다({@link OntologyDrafter}). 이미 있는 concept_id 는 건너뛴다.
     * 관계의 상대는 같은 스키마의 표 전부에서 찾으므로, 고르지 않은 표를 가리키는 관계는 (그 개념이 없어) 캔버스에 선이 안 생긴다 —
     * 나중에 그 표를 넣으면 선이 이어진다.
     *
     * @return 넣은 개념 수
     */
    @Transactional
    public int draft(UUID actor, Long workspaceId, long systemId, String schema, List<String> tables, String prefix, String tab) {
        String tenant = open(workspaceId);
        requireSystem(systemId);
        boolean knownTab = FeatureCatalog.modules().stream().anyMatch(m -> m.tabs().contains(tab));
        if (!knownTab) {
            throw new SettingsValidationException("'%s' 는 기능 탭이 아니에요".formatted(tab));
        }
        String p = prefix == null ? "" : prefix.strip().toLowerCase(java.util.Locale.ROOT);
        if (!p.isEmpty() && !p.matches("[a-z][a-z0-9_]*")) {
            throw new SettingsValidationException("접두어는 영문 소문자 · 숫자 · 밑줄만 돼요");
        }
        ExternalDataSource ds = registry.forSystem(tenant, systemId)
                .orElseThrow(() -> new SettingsValidationException("이 시스템에 접속 정보가 없어요"));
        List<SchemaIntrospector.Table> all;
        try {
            all = introspector.tables(ds, schema);
        } catch (DataAccessException e) {
            throw new SettingsValidationException("구조를 읽지 못했어요: " + e.getMostSpecificCause().getMessage());
        }
        List<SchemaIntrospector.Table> selected = all.stream().filter(t -> tables.contains(t.name())).toList();
        if (selected.isEmpty()) {
            throw new SettingsValidationException("고른 표가 없어요");
        }
        int added = 0;
        for (ExternalConcept c : OntologyDrafter.draft(selected, all, p, tab, systemId)) {
            if (store.conceptIdTaken(c.conceptId(), null)) {
                continue;
            }
            ExternalQuery.problem(c.sql(), c.filterColumns(), c.orderBy()).ifPresent(m -> { throw new SettingsValidationException(c.conceptId() + ": " + m); });
            store.insert(c);
            added++;
        }
        audit.record(actor, AdminAuditAction.UPDATE, workspaceId, "개념 초안 %d개 (%s.%s)".formatted(added, schema, String.join(",", tables)));
        return added;
    }

    public List<ExternalConceptTemplates.Template> templates() {
        return ExternalConceptTemplates.all();
    }

    // ── 안쪽 ────────────────────────────────────────────────────────────────

    private String open(Long workspaceId) {
        String schema = registrar.schemaNameOf(workspaceId);
        if (schema == null || schema.isBlank()) {
            throw new WorkspaceStateException("아직 개설되지 않은 회사예요. 개설이 끝난 뒤에 등록할 수 있어요");
        }
        searchPath.bind(schema);
        return schema;
    }

    private void requireSystem(long systemId) {
        Integer n = jdbc.queryForObject("select count(*) from external_systems where id = ?", Integer.class, systemId);
        if (n == null || n == 0) {
            throw new SettingsNotFoundException("외부 시스템을 찾지 못했어요");
        }
    }

    private void validate(ExternalConcept c, Long exceptId) {
        ExternalQuery.problem(c.sql(), c.filterColumns(), c.orderBy()).ifPresent(m -> { throw new SettingsValidationException(m); });
        boolean knownTab = FeatureCatalog.modules().stream().anyMatch(m -> m.tabs().contains(c.tab()));
        if (!knownTab) {
            throw new SettingsValidationException("'%s' 는 기능 탭이 아니에요".formatted(c.tab()));
        }
        for (String col : c.filterColumns()) {
            if (!c.attrs().containsKey(col)) {
                throw new SettingsValidationException("허용 컬럼 '%s' 이 속성(attrs)에 없어요".formatted(col));
            }
        }
        if (store.conceptIdTaken(c.conceptId(), exceptId)) {
            throw new SettingsValidationException("'%s' 는 이미 있는 개념 id 예요".formatted(c.conceptId()));
        }
    }
}
