package com.axcore.workspace.external;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import java.sql.Array;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;

/**
 * 테넌트의 {@code external_system_concepts} 읽기 · 쓰기. <b>트랜잭션 안, search_path 가 묶인 뒤에 부른다.</b>
 *
 * <p>읽는 쪽(AI 도구 · 연동 화면)과 쓰는 쪽(운영 콘솔)이 같은 행 매핑을 쓴다. jsonb 는 Jackson 으로, text[] 는 드라이버 배열로.
 */
@Component
public class ExternalConceptStore {

    private static final String SELECT =
            """
            select c.id, c.external_system_id, s.name as system_name, s.kind as system_kind, c.concept_id, c.name, c.synonyms, c.tab,
                   c.description, c.attrs::text as attrs, c.relations::text as relations, c.formula, c.sql, c.filter_columns,
                   c.order_by, c.sort_order
              from external_system_concepts c
              join external_systems s on s.id = c.external_system_id
            """;
    private static final String ORDER = " order by s.sort_order, s.id, c.sort_order, c.id";

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final RowMapper<ExternalConcept> row;

    public ExternalConceptStore(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
        this.row = (rs, i) -> new ExternalConcept(
                rs.getLong("id"), rs.getLong("external_system_id"), rs.getString("system_name"), rs.getString("system_kind"),
                rs.getString("concept_id"), rs.getString("name"), strings(rs.getArray("synonyms")), rs.getString("tab"),
                rs.getString("description"), attrs(rs.getString("attrs")), relations(rs.getString("relations")), rs.getString("formula"),
                rs.getString("sql"), strings(rs.getArray("filter_columns")), rs.getString("order_by"), rs.getInt("sort_order"));
    }

    /** 이 회사의 개념 전부 — 시스템 순서, 개념 순서 */
    public List<ExternalConcept> all() {
        return jdbc.query(SELECT + ORDER, row);
    }

    public List<ExternalConcept> ofSystem(long systemId) {
        return jdbc.query(SELECT + " where c.external_system_id = ?" + ORDER, row, systemId);
    }

    public Optional<ExternalConcept> byConceptId(String conceptId) {
        return jdbc.query(SELECT + " where c.concept_id = ?", row, conceptId).stream().findFirst();
    }

    public Optional<ExternalConcept> byId(long id) {
        return jdbc.query(SELECT + " where c.id = ?", row, id).stream().findFirst();
    }

    /** 넣고 새 id 를 돌려준다. {@code c.systemId()} 의 시스템에 붙는다 */
    public long insert(ExternalConcept c) {
        Long id = jdbc.queryForObject(
                """
                insert into external_system_concepts
                    (external_system_id, concept_id, name, synonyms, tab, description, attrs, relations, formula, sql, filter_columns, order_by, sort_order, updated_at)
                values (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?, ?, ?, now())
                returning id
                """,
                Long.class,
                c.systemId(), c.conceptId(), c.name(), c.synonyms().toArray(String[]::new), c.tab(), c.description(),
                write(c.attrs()), write(c.relations()), c.formula(), c.sql(), c.filterColumns().toArray(String[]::new), c.orderBy(), c.sortOrder());
        return id == null ? 0 : id;
    }

    public void update(long id, ExternalConcept c) {
        jdbc.update(
                """
                update external_system_concepts
                   set concept_id = ?, name = ?, synonyms = ?, tab = ?, description = ?, attrs = ?::jsonb, relations = ?::jsonb,
                       formula = ?, sql = ?, filter_columns = ?, order_by = ?, sort_order = ?, updated_at = now()
                 where id = ?
                """,
                c.conceptId(), c.name(), c.synonyms().toArray(String[]::new), c.tab(), c.description(), write(c.attrs()), write(c.relations()),
                c.formula(), c.sql(), c.filterColumns().toArray(String[]::new), c.orderBy(), c.sortOrder(), id);
    }

    public void delete(long id) {
        jdbc.update("delete from external_system_concepts where id = ?", id);
    }

    public boolean conceptIdTaken(String conceptId, Long exceptId) {
        Integer n = jdbc.queryForObject(
                "select count(*) from external_system_concepts where concept_id = ? and id <> coalesce(?, -1)", Integer.class, conceptId, exceptId);
        return n != null && n > 0;
    }

    // ── 변환 ────────────────────────────────────────────────────────────────

    private static List<String> strings(Array a) throws SQLException {
        return a == null ? List.of() : List.of((String[]) a.getArray());
    }

    private Map<String, String> attrs(String s) {
        try {
            return s == null ? Map.of() : json.readValue(s, new TypeReference<LinkedHashMap<String, String>>() {});
        } catch (Exception e) {
            throw new IllegalStateException("attrs jsonb 를 읽지 못했다", e);
        }
    }

    private List<ExternalConcept.Relation> relations(String s) {
        try {
            return s == null ? List.of() : json.readValue(s, new TypeReference<List<ExternalConcept.Relation>>() {});
        } catch (Exception e) {
            throw new IllegalStateException("relations jsonb 를 읽지 못했다", e);
        }
    }

    private String write(Object o) {
        try {
            return json.writeValueAsString(o);
        } catch (Exception e) {
            throw new IllegalStateException("jsonb 로 쓰지 못했다", e);
        }
    }
}
