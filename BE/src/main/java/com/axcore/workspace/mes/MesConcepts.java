package com.axcore.workspace.mes;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * AI 가 읽을 수 있는 MES 개념 — 개념마다 SELECT 하나와 거를 수 있는 컬럼 목록.
 *
 * <p><b>SQL 은 여기 적힌 것만 나간다.</b> 모델도 화면도 SQL 을 짓지 않는다. 화면(AI 도구)이 넘기는 것은 개념 id 와
 * {@code 컬럼=값} 동등 조건뿐이고, 값은 전부 바인딩 파라미터다. 컬럼은 이 표의 허용 목록에 있어야 한다. 고객 DB 에
 * 붙는 자리라 인젝션과 엉뚱한 테이블 조회를 구조로 막는다.
 *
 * <p>개념의 모양(컬럼 이름)은 FE 온톨로지({@code FE/lib/ai/ontology.ts})의 {@code attrs} 와 같아야 한다. 컬럼을
 * 바꾸면 그쪽도 같이 바꾼다.
 *
 * <p>고객사마다 MES 테이블이 다르면 이 표가 회사별 매핑 테이블로 옮겨 간다. 지금은 데모 MES
 * ({@code INFRA/seed/data/mes-supabase.sql}) 하나라 코드에 둔다.
 */
public final class MesConcepts {

    /** 한 번에 돌려주는 최대 행. AI 도구는 이 안에서 다시 거르고 40개만 모델에 준다 */
    public static final int MAX_ROWS = 2_000;

    /**
     * @param module  읽기 권한을 볼 모듈(생산관리 · 품질검사). {@code ModuleTabAccess.openRead} 가 본다
     * @param sql     FROM 까지의 SELECT. WHERE · ORDER BY · LIMIT 는 여기서 붙인다
     * @param filters 동등 조건을 걸 수 있는 컬럼. 목록 밖 이름은 400
     * @param orderBy ORDER BY 절(컬럼 고정 문자열)
     */
    public record Concept(String id, String module, String sql, Set<String> filters, String orderBy) {}

    private static final Map<String, Concept> BY_ID = new LinkedHashMap<>();

    static {
        add("work_order", "production",
                "select * from mes.v_work_order_progress",
                Set.of("wo_no", "product_code", "die_drawing_code", "status", "line", "priority"),
                "planned_start desc, wo_no desc");
        add("equipment", "production",
                """
                select e.code, e.name, e.kind, e.line, e.capacity_ton, e.status, e.installed_on, e.maker,
                       d.events as downtime_events_30d, d.downtime_minutes as downtime_minutes_30d,
                       d.breakdown_minutes as breakdown_minutes_30d
                  from mes.equipment e
                  join mes.v_equipment_downtime_30d d on d.equipment_code = e.code""",
                Set.of("code", "kind", "line", "status"),
                "e.code");
        add("production_result", "production",
                """
                select r.id, r.wo_no, r.op_seq, o.process, r.equipment_code, r.worker_id, w.name as worker_name,
                       r.shift, r.recorded_at, r.good_qty, r.defect_qty, r.run_minutes
                  from mes.production_results r
                  join mes.work_order_operations o on o.wo_no = r.wo_no and o.seq = r.op_seq
                  join mes.workers w on w.id = r.worker_id""",
                Set.of("wo_no", "equipment_code", "op_seq", "process", "shift", "worker_id"),
                "r.recorded_at desc, r.id desc");
        add("downtime", "production",
                """
                select id, equipment_code, started_at, ended_at,
                       round(extract(epoch from (ended_at - started_at)) / 60)::int as minutes,
                       reason_code, reason, wo_no, note
                  from mes.downtime_events""",
                Set.of("equipment_code", "reason_code", "wo_no"),
                "started_at desc, id desc");
        add("sensor", "production",
                "select equipment_code, recorded_at, load_pct, slide_temp_c, vibration_mm_s, strokes from mes.sensor_readings",
                Set.of("equipment_code"),
                "recorded_at desc, equipment_code");
        add("defect", "quality",
                "select id, wo_no, op_seq, equipment_code, recorded_at, defect_type, qty, cause, disposition from mes.defects",
                Set.of("wo_no", "equipment_code", "op_seq", "defect_type", "disposition"),
                "recorded_at desc, id desc");
        add("defect_rate", "quality",
                "select * from mes.v_defect_rate_30d",
                Set.of("process", "equipment_code", "op_seq"),
                "defect_rate_pct desc nulls last");
    }

    private static void add(String id, String module, String sql, Set<String> filters, String orderBy) {
        BY_ID.put(id, new Concept(id, module, sql, filters, orderBy));
    }

    private MesConcepts() {}

    public static Optional<Concept> find(String id) {
        return Optional.ofNullable(BY_ID.get(id));
    }

    public static Set<String> ids() {
        return BY_ID.keySet();
    }

    /** 만들어진 질의. {@code sql} 의 {@code ?} 순서대로 {@code params} 를 바인딩한다 */
    public record Query(String sql, List<Object> params) {}

    /**
     * 동등 조건을 WHERE 로 붙인다. 컬럼은 허용 목록에서만, 값은 바인딩으로만.
     *
     * <p>{@code cast(col as text) = ?} 로 비교한다 — 화면이 넘기는 값은 문자열이고 컬럼은 int 인 것도 있다
     * (op_seq). 표가 작아 인덱스를 못 타는 것은 상관없다.
     *
     * @throws IllegalArgumentException 허용되지 않은 컬럼. 컨트롤러가 400 으로 바꾼다
     */
    public static Query build(Concept c, Map<String, String> equals) {
        StringBuilder sql = new StringBuilder(c.sql());
        List<Object> params = new ArrayList<>();
        String glue = " where ";
        for (Map.Entry<String, String> e : equals.entrySet()) {
            if (!c.filters().contains(e.getKey())) {
                throw new IllegalArgumentException(
                        "'%s' 는 %s 에서 거를 수 있는 항목이 아니에요. 가능한 값: %s"
                                .formatted(e.getKey(), c.id(), String.join(", ", c.filters().stream().sorted().toList())));
            }
            sql.append(glue).append("cast(").append(qualified(c, e.getKey())).append(" as text) = ?");
            params.add(e.getValue());
            glue = " and ";
        }
        sql.append(" order by ").append(c.orderBy()).append(" limit ").append(MAX_ROWS);
        return new Query(sql.toString(), params);
    }

    /** 조인이 있는 SELECT 는 컬럼이 어느 표 것인지 붙여 준다 */
    static String qualified(Concept c, String column) {
        return switch (c.id()) {
            case "production_result" -> (column.equals("process") ? "o." : "r.") + column;
            case "equipment" -> "e." + column;
            default -> column;
        };
    }
}
