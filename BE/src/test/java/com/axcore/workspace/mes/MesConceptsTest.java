package com.axcore.workspace.mes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** MES 개념표의 질의 생성 규칙 — DB 없이 본다. 고객 DB 에 나가는 SQL 은 여기 적힌 모양뿐이어야 한다. */
class MesConceptsTest {

    @Test
    void 동등_조건은_바인딩으로_붙고_컬럼은_허용_목록에서만() {
        var c = MesConcepts.find("downtime").orElseThrow();
        Map<String, String> eq = new LinkedHashMap<>();
        eq.put("equipment_code", "PR-03");
        eq.put("reason_code", "BRK");
        var q = MesConcepts.build(c, eq);

        assertTrue(q.sql().contains(" where cast(equipment_code as text) = ? and cast(reason_code as text) = ?"), q.sql());
        assertTrue(q.sql().endsWith(" order by started_at desc, id desc limit " + MesConcepts.MAX_ROWS), q.sql());
        assertEquals(java.util.List.of("PR-03", "BRK"), q.params());
        // 값이 SQL 문자열에 섞여 들어가지 않는다
        assertFalse(q.sql().contains("PR-03"));
    }

    @Test
    void 허용되지_않은_컬럼은_거절한다() {
        var c = MesConcepts.find("work_order").orElseThrow();
        var e = assertThrows(IllegalArgumentException.class, () -> MesConcepts.build(c, Map.of("note", "x")));
        assertTrue(e.getMessage().contains("note"));
        assertTrue(e.getMessage().contains("wo_no"));
    }

    @Test
    void 조건이_없으면_정렬과_상한만_붙는다() {
        var c = MesConcepts.find("sensor").orElseThrow();
        var q = MesConcepts.build(c, Map.of());
        assertFalse(q.sql().contains(" where "));
        assertTrue(q.sql().endsWith("limit " + MesConcepts.MAX_ROWS));
        assertTrue(q.params().isEmpty());
    }

    @Test
    void 조인이_있는_개념은_컬럼에_표_별칭이_붙는다() {
        var c = MesConcepts.find("production_result").orElseThrow();
        assertEquals("r.wo_no", MesConcepts.qualified(c, "wo_no"));
        assertEquals("o.process", MesConcepts.qualified(c, "process"));
        var q = MesConcepts.build(c, Map.of("process", "성형"));
        assertTrue(q.sql().contains("cast(o.process as text) = ?"), q.sql());
    }

    @Test
    void 모든_개념은_모듈과_허용_컬럼이_있다() {
        for (String id : MesConcepts.ids()) {
            var c = MesConcepts.find(id).orElseThrow();
            assertTrue(c.module().equals("production") || c.module().equals("quality"), id);
            assertFalse(c.filters().isEmpty(), id);
        }
    }
}
