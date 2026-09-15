package com.axcore.workspace.external;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.axcore.workspace.external.SchemaIntrospector.Column;
import com.axcore.workspace.external.SchemaIntrospector.ForeignKey;
import com.axcore.workspace.external.SchemaIntrospector.Table;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

/** 표 → 개념 초안 규칙. 데모 MES 모양의 표 셋으로 본다 — FK 가 있는 것과 이름만 맞는 것. */
class OntologyDrafterTest {

    private static Column col(String name, String type) {
        return new Column(name, type, SchemaIntrospector.classify(type), true, null);
    }

    private static final Table EQUIPMENT = new Table("mes", "equipment", false, "설비", 10,
            List.of(col("code", "text"), col("name", "text"), col("kind", "text"), col("line", "text"), col("status", "text")),
            List.of("code"), List.of(), List.of());
    private static final Table WORK_ORDERS = new Table("mes", "work_orders", false, null, 60,
            List.of(col("wo_no", "text"), col("product_code", "text"), col("status", "text"), col("planned_start", "date")),
            List.of("wo_no"), List.of(), List.of());
    /** FK 는 equipment 로만 걸려 있고, wo_no 는 이름으로만 맞는다 */
    private static final Table DOWNTIME = new Table("mes", "downtime_events", false, null, 5_000,
            List.of(col("id", "bigint"), col("equipment_code", "text"), col("started_at", "timestamp without time zone"),
                    col("reason_code", "text"), col("wo_no", "text"), col("note", "text")),
            List.of("id"), List.of(), List.of(new ForeignKey("equipment_code", "equipment", "code")));
    private static final List<Table> ALL = List.of(EQUIPMENT, WORK_ORDERS, DOWNTIME);

    @Test
    void FK_와_이름_규칙으로_관계를_잡고_id_는_접두어_붙은_표_이름() {
        var c = OntologyDrafter.draft(List.of(DOWNTIME), ALL, "mes_", "monitoring", 7).getFirst();
        assertEquals("mes_downtime_events", c.conceptId());
        assertEquals(7, c.systemId());
        assertEquals("monitoring", c.tab());
        assertEquals(List.of(new ExternalConcept.Relation("equipment_code", "mes_equipment"), new ExternalConcept.Relation("wo_no", "mes_work_orders")), c.relations());
        // reason_code 는 맞는 표가 없어 관계 없음. 그래도 코드성 컬럼이라 filter 에는 든다
        assertEquals(List.of("id", "equipment_code", "wo_no", "reason_code"), c.filterColumns());
        assertEquals("id desc", c.orderBy());
        assertEquals("select id, equipment_code, started_at, reason_code, wo_no, note from mes.downtime_events", c.sql());
        assertTrue(c.description().contains("목록이 길다"), c.description());
        assertTrue(c.description().contains("[초안"), c.description());
        assertTrue(ExternalQuery.problem(c.sql(), c.filterColumns(), c.orderBy()).isEmpty());
    }

    @Test
    void 주석이_있으면_이름과_라벨이_되고_뷰는_datetime_으로_정렬() {
        var eq = OntologyDrafter.draft(List.of(EQUIPMENT), ALL, "mes_", "monitoring", 1).getFirst();
        assertEquals("설비", eq.name());
        assertEquals("code desc", eq.orderBy());
        assertEquals(List.of("code", "kind", "line", "status"), eq.filterColumns());

        Table view = new Table("mes", "v_defect_rate_30d", true, null, 0,
                List.of(col("process", "text"), col("defect_rate_pct", "numeric"), col("calculated_at", "timestamp")), List.of(), List.of(), List.of());
        var v = OntologyDrafter.draft(List.of(view), List.of(view), "mes_", "defects", 1).getFirst();
        assertEquals("calculated_at desc", v.orderBy());
        assertEquals(List.of("process"), v.filterColumns());
    }

    @Test
    void 컬럼이_많으면_스무_개에서_자르고_설명에_적는다() {
        Table wide = new Table("erp", "mard", false, null, 100,
                IntStream.range(0, 30).mapToObj(i -> col("c" + i, "text")).toList(), List.of("c0"), List.of(), List.of());
        var c = OntologyDrafter.draft(List.of(wide), List.of(wide), "", "stock", 1).getFirst();
        assertEquals("mard", c.conceptId());
        assertEquals(OntologyDrafter.MAX_ATTRS, c.attrs().size());
        assertTrue(c.description().contains("30개 중 앞 20개"), c.description());
    }
}
