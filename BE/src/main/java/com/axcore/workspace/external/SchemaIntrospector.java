package com.axcore.workspace.external;

import java.sql.Array;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * 외부 DB 의 구조를 읽는다 — 표 · 컬럼 · 키 · 주석 · 대략 행 수. 데이터는 읽지 않는다.
 *
 * <p>그 시스템의 읽기 전용 풀로 카탈로그만 본다. {@code information_schema} 는 접속 롤이 볼 수 있는 표만 돌려주고,
 * 키는 {@code pg_constraint} 로 읽는다 — {@code information_schema.constraint_column_usage} 는 표 소유자에게만 보여서
 * SELECT 만 가진 롤로는 FK 가 비어 나온다.
 *
 * <p>PostgreSQL 전용이다. MySQL · MSSQL 고객이 생기면 {@code kind} 별로 카탈로그 SQL 을 나눈다.
 */
@Component
public class SchemaIntrospector {

    private static final int QUERY_TIMEOUT_SEC = 10;

    /** @param type string · number · datetime · boolean · other — 초안이 라벨 · 정렬을 고를 때 쓰는 거친 분류 */
    public record Column(String name, String dataType, String type, boolean nullable, String comment) {}

    /** @param columns 한 컬럼짜리 키만 초안에 쓴다. 복합 키는 첫 컬럼만 담는다 */
    public record ForeignKey(String column, String refTable, String refColumn) {}

    public record Table(
            String schema, String name, boolean view, String comment, long approxRows,
            List<Column> columns, List<String> primaryKey, List<String> uniqueColumns, List<ForeignKey> foreignKeys) {}

    /** 접속 롤이 볼 수 있는 스키마. 시스템 스키마는 뺀다 */
    public List<String> schemas(ExternalDataSource ds) {
        return jdbc(ds).queryForList(
                """
                select distinct table_schema
                  from information_schema.tables
                 where table_schema not in ('pg_catalog', 'information_schema')
                   and table_schema not like 'pg_%'
                 order by table_schema
                """, String.class);
    }

    public List<Table> tables(ExternalDataSource ds, String schema) {
        JdbcTemplate jdbc = jdbc(ds);
        Map<String, TableBuilder> byName = new LinkedHashMap<>();

        jdbc.query(
                """
                select c.relname, c.relkind, c.reltuples, obj_description(c.oid, 'pg_class') as comment
                  from pg_class c
                  join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = ? and c.relkind in ('r', 'p', 'v', 'm')
                 order by c.relname
                """,
                rs -> {
                    String kind = rs.getString("relkind");
                    byName.put(rs.getString("relname"), new TableBuilder(schema, rs.getString("relname"),
                            kind.equals("v") || kind.equals("m"), rs.getString("comment"), Math.max(0, (long) rs.getFloat("reltuples"))));
                }, schema);

        jdbc.query(
                """
                select c.relname, a.attname, format_type(a.atttypid, a.atttypmod) as data_type, a.attnotnull,
                       col_description(c.oid, a.attnum) as comment
                  from pg_attribute a
                  join pg_class c on c.oid = a.attrelid
                  join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = ? and a.attnum > 0 and not a.attisdropped and c.relkind in ('r', 'p', 'v', 'm')
                 order by c.relname, a.attnum
                """,
                rs -> {
                    TableBuilder t = byName.get(rs.getString("relname"));
                    if (t != null) {
                        String dataType = rs.getString("data_type");
                        t.columns.add(new Column(rs.getString("attname"), dataType, classify(dataType), !rs.getBoolean("attnotnull"), rs.getString("comment")));
                    }
                }, schema);

        jdbc.query(
                """
                select c.contype, r.relname as table_name,
                       (select array_agg(a.attname order by k.ord)
                          from unnest(c.conkey) with ordinality k(attnum, ord)
                          join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as cols,
                       fr.relname as ref_table,
                       (select array_agg(a.attname order by k.ord)
                          from unnest(c.confkey) with ordinality k(attnum, ord)
                          join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.attnum) as ref_cols
                  from pg_constraint c
                  join pg_class r on r.oid = c.conrelid
                  join pg_namespace n on n.oid = r.relnamespace
                  left join pg_class fr on fr.oid = c.confrelid
                 where n.nspname = ? and c.contype in ('p', 'u', 'f')
                """,
                rs -> {
                    TableBuilder t = byName.get(rs.getString("table_name"));
                    if (t == null) return;
                    List<String> cols = strings(rs.getArray("cols"));
                    switch (rs.getString("contype")) {
                        case "p" -> t.primaryKey.addAll(cols);
                        case "u" -> { if (cols.size() == 1) t.uniqueColumns.add(cols.getFirst()); }
                        case "f" -> {
                            List<String> ref = strings(rs.getArray("ref_cols"));
                            if (!cols.isEmpty() && !ref.isEmpty()) {
                                t.foreignKeys.add(new ForeignKey(cols.getFirst(), rs.getString("ref_table"), ref.getFirst()));
                            }
                        }
                        default -> { }
                    }
                }, schema);

        List<Table> out = new ArrayList<>();
        for (TableBuilder b : byName.values()) {
            out.add(new Table(b.schema, b.name, b.view, b.comment, b.approxRows,
                    List.copyOf(b.columns), List.copyOf(b.primaryKey), List.copyOf(b.uniqueColumns), List.copyOf(b.foreignKeys)));
        }
        return out;
    }

    static String classify(String dataType) {
        String t = dataType.toLowerCase();
        if (t.contains("timestamp") || t.equals("date") || t.contains("time")) return "datetime";
        if (t.equals("boolean")) return "boolean";
        if (t.contains("int") || t.equals("numeric") || t.startsWith("numeric(") || t.contains("double") || t.equals("real") || t.startsWith("decimal")) return "number";
        if (t.startsWith("character") || t.equals("text") || t.startsWith("varchar") || t.equals("uuid")) return "string";
        return "other";
    }

    private static JdbcTemplate jdbc(ExternalDataSource ds) {
        JdbcTemplate jdbc = new JdbcTemplate(ds.dataSource());
        jdbc.setQueryTimeout(QUERY_TIMEOUT_SEC);
        return jdbc;
    }

    private static List<String> strings(Array a) throws SQLException {
        return a == null ? List.of() : List.of((String[]) a.getArray());
    }

    private static final class TableBuilder {
        final String schema;
        final String name;
        final boolean view;
        final String comment;
        final long approxRows;
        final List<Column> columns = new ArrayList<>();
        final List<String> primaryKey = new ArrayList<>();
        final List<String> uniqueColumns = new ArrayList<>();
        final List<ForeignKey> foreignKeys = new ArrayList<>();

        TableBuilder(String schema, String name, boolean view, String comment, long approxRows) {
            this.schema = schema;
            this.name = name;
            this.view = view;
            this.comment = comment;
            this.approxRows = approxRows;
        }
    }
}
