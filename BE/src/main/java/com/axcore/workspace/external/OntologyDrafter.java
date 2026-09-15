package com.axcore.workspace.external;

import com.axcore.workspace.external.SchemaIntrospector.Column;
import com.axcore.workspace.external.SchemaIntrospector.ForeignKey;
import com.axcore.workspace.external.SchemaIntrospector.Table;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 표 하나 → 개념 행 하나. 규칙만 쓰고 모델은 없다. 구조(속성 · 관계)는 맞고 말(이름 · 설명)은 어색하게 나온다 —
 * 운영자가 스튜디오에서 고치는 것을 전제로 한 <b>초안</b>이다.
 *
 * <ul>
 *   <li>concept_id = 접두어 + 표 이름. 이름 · 라벨은 주석이 있으면 주석, 없으면 표 · 컬럼 이름 그대로</li>
 *   <li>속성은 앞 {@value #MAX_ATTRS}개까지 — 도구 설명 4,000자 예산. 나머지는 스튜디오에서 더한다</li>
 *   <li>관계는 FK 제약 그대로 + 이름 규칙: {@code equipment_code} 가 다른 표 {@code equipment} 의 키 {@code code} 를,
 *       {@code wo_no} 가 다른 표의 키 {@code wo_no} 를 가리킨다고 본다. FK 를 안 거는 MES 가 많아서다</li>
 *   <li>filter 컬럼은 PK · FK · 관계 컬럼 · {@code *_code *_type *_no status kind line} 같은 코드성 문자열 컬럼</li>
 *   <li>정렬은 PK 내림차순, PK 가 없으면(뷰) 첫 datetime 컬럼 내림차순, 그것도 없으면 첫 컬럼</li>
 * </ul>
 */
public final class OntologyDrafter {

    static final int MAX_ATTRS = 20;
    private static final long LONG_TABLE_ROWS = 2_000;
    private static final Set<String> KEY_SUFFIXES = Set.of("_code", "_id", "_no", "_key");
    private static final Set<String> CODE_LIKE = Set.of("status", "kind", "type", "line", "shift", "category", "state", "process");

    private OntologyDrafter() {}

    /**
     * @param selected 초안을 만들 표
     * @param all      같은 스키마의 표 전부 — 관계의 상대를 여기서 찾는다
     * @param prefix   개념 id 접두어(예: {@code mes_}). 비면 없음
     * @param tab      초안 전부에 붙일 권한 탭
     */
    public static List<ExternalConcept> draft(List<Table> selected, List<Table> all, String prefix, String tab, long systemId) {
        Map<String, Table> byName = new LinkedHashMap<>();
        for (Table t : all) byName.put(t.name(), t);
        List<ExternalConcept> out = new ArrayList<>();
        for (Table t : selected) {
            out.add(one(t, byName, prefix == null ? "" : prefix, tab, systemId, out.size()));
        }
        return out;
    }

    public static String conceptId(String prefix, String table) {
        String id = (prefix == null ? "" : prefix) + table.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_]", "_");
        return id.length() > 50 ? id.substring(0, 50) : id;
    }

    private static ExternalConcept one(Table t, Map<String, Table> byName, String prefix, String tab, long systemId, int order) {
        List<Column> cols = t.columns().size() > MAX_ATTRS ? t.columns().subList(0, MAX_ATTRS) : t.columns();
        Map<String, String> attrs = new LinkedHashMap<>();
        for (Column c : cols) attrs.put(c.name(), blank(c.comment()) ? c.name() : c.comment().strip());

        // 관계 — FK 먼저, 그다음 이름 규칙. 같은 컬럼에 둘이 잡히면 FK 가 이긴다
        Map<String, String> relations = new LinkedHashMap<>();
        for (ForeignKey fk : t.foreignKeys()) {
            if (attrs.containsKey(fk.column()) && byName.containsKey(fk.refTable()) && !fk.refTable().equals(t.name())) {
                relations.put(fk.column(), conceptId(prefix, fk.refTable()));
            }
        }
        for (Column c : cols) {
            if (relations.containsKey(c.name())) continue;
            Table target = guessTarget(c.name(), t, byName);
            if (target != null) relations.put(c.name(), conceptId(prefix, target.name()));
        }

        // filter — 키 · 관계 · 코드성 문자열
        Set<String> filters = new LinkedHashSet<>();
        for (String pk : t.primaryKey()) if (attrs.containsKey(pk)) filters.add(pk);
        filters.addAll(relations.keySet());
        for (Column c : cols) {
            if (!c.type().equals("string")) continue;
            String n = c.name();
            if (CODE_LIKE.contains(n) || KEY_SUFFIXES.stream().anyMatch(n::endsWith) || n.endsWith("_type") || n.endsWith("_status")) filters.add(n);
        }

        String orderBy = orderBy(t, cols);
        String name = blank(t.comment()) ? t.name() : t.comment().strip();
        StringBuilder desc = new StringBuilder(name).append(" 표(").append(t.schema()).append(".").append(t.name()).append(").");
        if (t.columns().size() > MAX_ATTRS) desc.append(" 컬럼 ").append(t.columns().size()).append("개 중 앞 ").append(MAX_ATTRS).append("개만 넣었다.");
        if (t.approxRows() >= LONG_TABLE_ROWS && !filters.isEmpty()) {
            desc.append(" 목록이 길다(약 ").append(t.approxRows()).append("행) — ").append(String.join(" · ", filters)).append(" 로 거른다.");
        }
        desc.append(" [초안 — 이름 · 설명 · 동의어를 다듬어 주세요]");

        String sql = "select " + String.join(", ", attrs.keySet()) + " from " + t.schema() + "." + t.name();
        return new ExternalConcept(0, systemId, null, null, conceptId(prefix, t.name()), name, List.of(), tab, desc.toString(), attrs,
                relations.entrySet().stream().map(e -> new ExternalConcept.Relation(e.getKey(), e.getValue())).toList(),
                null, sql, List.copyOf(filters), orderBy, order * 10);
    }

    /**
     * 이름 규칙. {@code equipment_code} → 표 {@code equipment}(또는 {@code equipments})의 키 {@code code} · {@code equipment_code}.
     * {@code wo_no} 처럼 접두어가 표 이름이 아니어도, 다른 표의 PK · UNIQUE 컬럼 이름이 정확히 같으면 그 표.
     */
    static Table guessTarget(String column, Table self, Map<String, Table> byName) {
        String suffix = KEY_SUFFIXES.stream().filter(column::endsWith).findFirst().orElse(null);
        if (suffix != null) {
            String base = column.substring(0, column.length() - suffix.length());
            String key = suffix.substring(1); // code · id · no · key
            for (String cand : List.of(base, base + "s", base + "es", base.endsWith("y") ? base.substring(0, base.length() - 1) + "ies" : base + "s")) {
                Table t = byName.get(cand);
                if (t != null && t != self && (hasKey(t, key) || hasKey(t, column))) return t;
            }
        }
        // 정확히 같은 이름의 키를 가진 표 (wo_no → work_orders.wo_no). 여러 표가 맞으면 첫 표
        if (suffix != null || column.endsWith("no")) {
            for (Table t : byName.values()) {
                if (t != self && hasKey(t, column)) return t;
            }
        }
        return null;
    }

    private static boolean hasKey(Table t, String column) {
        return (t.primaryKey().size() == 1 && t.primaryKey().getFirst().equals(column)) || t.uniqueColumns().contains(column);
    }

    private static String orderBy(Table t, List<Column> cols) {
        if (!t.primaryKey().isEmpty() && cols.stream().anyMatch(c -> c.name().equals(t.primaryKey().getFirst()))) {
            return t.primaryKey().getFirst() + " desc";
        }
        return cols.stream().filter(c -> c.type().equals("datetime")).map(c -> c.name() + " desc").findFirst()
                .orElse(cols.isEmpty() ? "1" : cols.getFirst().name());
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
