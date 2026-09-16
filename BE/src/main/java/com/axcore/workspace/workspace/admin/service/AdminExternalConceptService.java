package com.axcore.workspace.workspace.admin.service;

import com.axcore.workspace.external.ExternalConcept;
import com.axcore.workspace.external.ExternalConceptStore;
import com.axcore.workspace.external.ExternalConceptTemplates;
import com.axcore.workspace.external.ExternalDataSource;
import com.axcore.workspace.external.ExternalDataSourceRegistry;
import com.axcore.workspace.external.ExternalQuery;
import com.axcore.workspace.external.OntologyDrafter;
import com.axcore.workspace.external.OntologyRules;
import com.axcore.workspace.external.SchemaIntrospector;
import com.axcore.workspace.external.TableProfile;
import com.axcore.workspace.external.TableProfiler;
import com.axcore.workspace.workspace.admin.dto.ExternalConceptAdminResponse;
import com.axcore.workspace.workspace.admin.dto.ExternalConceptRequest;
import com.axcore.workspace.workspace.admin.entity.AdminAuditAction;
import com.axcore.workspace.workspace.admin.exception.WorkspaceStateException;
import com.axcore.workspace.workspace.provisioning.TenantSearchPath;
import com.axcore.workspace.workspace.settings.FeatureCatalog;
import com.axcore.workspace.workspace.settings.SettingsNotFoundException;
import com.axcore.workspace.workspace.settings.SettingsValidationException;
import java.time.LocalDate;
import java.util.ArrayList;
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
    private final TableProfiler profiler;
    private final AdminAuditRecorder audit;

    public AdminExternalConceptService(
            WorkspaceRegistrar registrar, TenantSearchPath searchPath, JdbcTemplate jdbc, ExternalConceptStore store,
            ExternalDataSourceRegistry registry, SchemaIntrospector introspector, TableProfiler profiler, AdminAuditRecorder audit) {
        this.registrar = registrar;
        this.searchPath = searchPath;
        this.jdbc = jdbc;
        this.store = store;
        this.registry = registry;
        this.introspector = introspector;
        this.profiler = profiler;
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

    // ── AI 로 다듬기 ─────────────────────────────────────────────────────────

    /** 관계 후보를 찾을 때 PK 값을 읽을 표의 상한 — 표마다 쿼리 하나라 묶어 둔다 */
    private static final int RELATION_TARGETS_MAX = 12;

    /**
     * 「AI 로 다듬기」 의 재료 한 벌 — 개념 · 표 구조 · 값 프로파일 · 통계 규칙 제안 · 형제 개념. AI 서버가 이걸 받아 모델에 묻는다.
     * 고객 데이터 값은 {@link TableProfile} 의 규칙대로만 실린다. 관계 추정에 쓴 PK 값 집합은 여기서 끝나고 응답에 없다.
     *
     * @param system     말투 · 업종 용어를 맞추려고 주는 시스템 종류 · 이름 · 회사 이름
     * @param table      개념이 읽는 표의 구조(컬럼 · 키 · 주석)
     * @param siblings   같은 시스템의 다른 개념 (id · 이름) — 동의어가 겹치지 않게. 같은 표를 읽는 쌍둥이는 뺀다
     * @param duplicates 같은 시스템에서 <b>같은 표를 읽는</b> 다른 개념 — 템플릿과 DB 초안이 한 표를 두 id 로 넣은 것.
     *                   관계 후보 · 관계 상대에서 빼고, 검토 화면이 경고를 보인다. 둘 중 하나는 지워야 AI 답이 흔들리지 않는다
     * @param conceptIds 회사의 외부 개념 id 전부 — 집계 id 충돌 검사용. 관계 상대는 AI 서버가 여기서 duplicates 를 빼고 내장 개념을 더한다
     */
    public record RefineInput(
            SystemInfo system, ExternalConceptAdminResponse concept, SchemaIntrospector.Table table, TableProfile profile,
            OntologyRules.Suggestion rules, List<Sibling> siblings, List<Sibling> duplicates, List<String> conceptIds, int conceptCount) {}

    public record SystemInfo(String kind, String name, String company) {}

    public record Sibling(String id, String name) {}

    @Transactional(readOnly = true)
    public RefineInput refineInput(Long workspaceId, long id) {
        String tenant = open(workspaceId);
        ExternalConcept c = store.byId(id).orElseThrow(() -> new SettingsNotFoundException("개념을 찾지 못했어요"));
        OntologyRules.FromTable from = OntologyRules.fromTable(c.sql())
                .orElseThrow(() -> new SettingsValidationException("이 개념의 SQL 에서 표를 찾지 못했어요 — 「스키마.표」 를 읽는 SELECT 에만 AI 다듬기를 쓸 수 있어요"));
        String schema = from.schema();
        String tableName = from.table();
        ExternalDataSource ds = registry.forSystem(tenant, c.systemId())
                .orElseThrow(() -> new SettingsValidationException("이 시스템에 접속 정보가 없어요"));

        List<SchemaIntrospector.Table> all;
        TableProfiler.Profiled profiled;
        try {
            all = introspector.tables(ds, schema);
        } catch (DataAccessException e) {
            throw new SettingsValidationException("구조를 읽지 못했어요: " + e.getMostSpecificCause().getMessage());
        }
        SchemaIntrospector.Table table = all.stream().filter(t -> t.name().equals(tableName)).findFirst()
                .orElseThrow(() -> new SettingsValidationException("표 %s.%s 를 지금 DB 에서 찾지 못했어요".formatted(schema, tableName)));
        try {
            profiled = profiler.profile(ds, table);
        } catch (DataAccessException e) {
            throw new SettingsValidationException("표본을 읽지 못했어요: " + e.getMostSpecificCause().getMessage());
        }

        // 같은 시스템의 다른 개념. 같은 표를 읽는 쌍둥이(템플릿 + DB 초안)는 형제 · 관계 후보 어디에도 넣지 않고 따로 알린다
        List<ExternalConcept> others = store.ofSystem(c.systemId()).stream().filter(o -> o.id() != c.id()).toList();
        List<ExternalConcept> duplicates = others.stream()
                .filter(o -> OntologyRules.fromTable(o.sql()).map(from::equals).orElse(false))
                .toList();
        List<ExternalConcept> siblings = others.stream().filter(o -> !duplicates.contains(o)).toList();

        // 형제 개념이 읽는 표 → 관계 후보. 표마다 PK 값 한 번씩만 읽는다
        List<OntologyRules.Target> targets = new ArrayList<>();
        for (ExternalConcept o : siblings) {
            if (targets.size() >= RELATION_TARGETS_MAX) break;
            OntologyRules.FromTable of = OntologyRules.fromTable(o.sql()).orElse(null);
            if (of == null || !of.schema().equals(schema)) continue;
            String otherName = of.table();
            SchemaIntrospector.Table ot = all.stream().filter(t -> t.name().equals(otherName)).findFirst().orElse(null);
            if (ot == null || ot.primaryKey().size() != 1) continue;
            try {
                targets.add(new OntologyRules.Target(ot.name(), o.conceptId(), ot.primaryKey().getFirst(), profiler.pkValues(ds, ot)));
            } catch (DataAccessException e) {
                // 한 표의 키를 못 읽어도 나머지 제안은 낸다
            }
        }
        OntologyRules.Suggestion rules = OntologyRules.suggest(c, profiled, table, targets, LocalDate.now());

        String company = registrar.companyNameOf(workspaceId);
        return new RefineInput(
                new SystemInfo(c.systemKind(), c.systemName(), company),
                ExternalConceptAdminResponse.of(c), table, profiled.profile(), rules,
                siblings.stream().map(o -> new Sibling(o.conceptId(), o.name())).toList(),
                duplicates.stream().map(o -> new Sibling(o.conceptId(), o.name())).toList(),
                store.all().stream().map(ExternalConcept::conceptId).toList(),
                store.all().size());
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
