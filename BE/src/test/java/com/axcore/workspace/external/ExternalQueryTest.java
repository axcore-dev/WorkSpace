package com.axcore.workspace.external;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 개념 행 → 질의 조립 규칙과 SQL 모양 검사 — DB 없이 본다. 고객 DB 에 나가는 SQL 은 여기 적힌 모양뿐이어야 한다. */
class ExternalQueryTest {

    private static final ExternalConcept DOWNTIME = ExternalConceptTemplates.find("press-mes-demo").orElseThrow().concepts().stream()
            .filter(c -> c.conceptId().equals("mes_downtime")).findFirst().orElseThrow();

    @Test
    void 동등_조건은_서브쿼리_바깥에_바인딩으로_붙고_컬럼은_허용_목록에서만() {
        Map<String, String> eq = new LinkedHashMap<>();
        eq.put("equipment_code", "PR-03");
        eq.put("reason_code", "BRK");
        var q = ExternalQuery.build(DOWNTIME, eq);

        assertTrue(q.sql().startsWith("select * from (select id, equipment_code"), q.sql());
        assertTrue(q.sql().contains(") t where cast(t.equipment_code as text) = ? and cast(t.reason_code as text) = ?"), q.sql());
        assertTrue(q.sql().endsWith(" order by started_at desc, id desc limit " + ExternalQuery.MAX_ROWS), q.sql());
        assertEquals(List.of("PR-03", "BRK"), q.params());
        assertFalse(q.sql().contains("PR-03"));
    }

    @Test
    void 허용_목록_밖_컬럼은_거절하고_조건_없으면_WHERE_가_없다() {
        var e = assertThrows(IllegalArgumentException.class, () -> ExternalQuery.build(DOWNTIME, Map.of("note", "x")));
        assertTrue(e.getMessage().contains("equipment_code"), e.getMessage());
        assertFalse(ExternalQuery.build(DOWNTIME, Map.of()).sql().contains("where"));
    }

    @Test
    void 조인이_있는_SELECT_도_출력_컬럼_이름으로_거른다() {
        var eq = ExternalConceptTemplates.find("press-mes-demo").orElseThrow().concepts().stream()
                .filter(c -> c.conceptId().equals("mes_production_result")).findFirst().orElseThrow();
        var q = ExternalQuery.build(eq, Map.of("process", "성형"));
        assertTrue(q.sql().contains("cast(t.process as text) = ?"), q.sql());
    }

    @Test
    void 정의_검사_select_로_시작_세미콜론_없음_정렬_모양() {
        assertTrue(ExternalQuery.problem("select 1 from mes.x", List.of("a"), "a desc, b").isEmpty());
        assertTrue(ExternalQuery.problem("delete from mes.x", List.of(), "a").orElseThrow().contains("select"));
        assertTrue(ExternalQuery.problem("select 1; drop table x", List.of(), "a").orElseThrow().contains("세미콜론"));
        assertTrue(ExternalQuery.problem("select 1", List.of("bad col"), "a").orElseThrow().contains("허용 컬럼"));
        assertTrue(ExternalQuery.problem("select 1", List.of(), "a; drop").orElseThrow().contains("정렬"));
    }

    @Test
    void 템플릿의_허용_컬럼은_전부_attrs_에_있다() {
        for (var c : ExternalConceptTemplates.find("press-mes-demo").orElseThrow().concepts()) {
            for (String col : c.filterColumns()) assertTrue(c.attrs().containsKey(col), c.conceptId() + "." + col);
            assertTrue(ExternalQuery.problem(c.sql(), c.filterColumns(), c.orderBy()).isEmpty(), c.conceptId());
        }
    }
}
