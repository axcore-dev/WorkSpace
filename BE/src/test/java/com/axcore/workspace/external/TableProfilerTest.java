package com.axcore.workspace.external;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.axcore.workspace.external.SchemaIntrospector.Column;
import com.axcore.workspace.external.SchemaIntrospector.Table;
import java.sql.Date;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 표본 → 프로파일. 값이 모델로 나가는 컬럼과 나가지 않는 컬럼을 가른다. */
class TableProfilerTest {

    private static Column col(String name, String type) {
        return new Column(name, type, SchemaIntrospector.classify(type), true, null);
    }

    private static final Table EMPLOYEES = new Table("erp", "employees", false, "직원", 32,
            List.of(col("emp_no", "text"), col("name", "text"), col("status", "text"), col("email", "text"), col("contact", "text"),
                    col("memo", "text"), col("hire_date", "date"), col("base_pay", "integer"), col("grade", "integer")),
            List.of("emp_no"), List.of(), List.of());

    private static List<Map<String, Object>> rows() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (int i = 0; i < 40; i++) {
            Map<String, Object> r = new HashMap<>();
            r.put("emp_no", "E%03d".formatted(i));
            r.put("name", "직원" + i);
            r.put("status", i % 10 == 0 ? "퇴직" : i % 7 == 0 ? "휴직" : "재직");
            r.put("email", "u" + i + "@example.com");
            r.put("contact", "010-1234-%04d".formatted(i));
            r.put("memo", "긴 비고 문장입니다. ".repeat(6) + i);
            r.put("hire_date", Date.valueOf("2020-01-01").toLocalDate().plusDays(i * 30L).toString());
            r.put("base_pay", 3_000_000 + i * 10_000);
            r.put("grade", 1 + i % 4);
            out.add(r);
        }
        return out;
    }

    @Test
    void 열거형_컬럼만_값_목록을_갖고_고유값_많은_문자열은_모양만() {
        TableProfile p = TableProfiler.profileRows(EMPLOYEES, rows()).profile();
        assertEquals(40, p.sampledRows());

        var status = p.column("status");
        assertEquals(3, status.distinct());
        assertEquals("재직", status.values().getFirst().value());
        assertTrue(status.values().getFirst().count() > status.values().getLast().count());

        var name = p.column("name");
        assertNull(name.values(), "이름은 값이 나가면 안 된다");
        assertEquals("한글", name.shape());
        assertEquals(40, name.distinct());

        var empNo = p.column("emp_no");
        assertNull(empNo.values());
        assertEquals("코드형", empNo.shape());
    }

    @Test
    void 이름_또는_값_모양이_개인정보면_마스킹하고_긴_글은_값이_없다() {
        TableProfile p = TableProfiler.profileRows(EMPLOYEES, rows()).profile();
        assertTrue(p.column("email").masked(), "이름 규칙");
        assertTrue(p.column("contact").masked(), "값 모양(전화번호) 규칙 — 이름으로는 못 잡는다");
        assertNull(p.column("contact").shape());
        assertTrue(p.column("memo").longText());
        assertNull(p.column("memo").values());
        assertNull(p.column("memo").shape());
    }

    @Test
    void 숫자_날짜는_최소_최대만_주고_작은_정수_코드는_값_목록도_준다() {
        TableProfile p = TableProfiler.profileRows(EMPLOYEES, rows()).profile();
        var pay = p.column("base_pay");
        assertEquals("3000000", pay.min());
        assertEquals("3390000", pay.max());
        assertNull(pay.values(), "급여는 고유값이 많아 목록 없음");
        var grade = p.column("grade");
        assertEquals(4, grade.values().size());
        var hire = p.column("hire_date");
        assertEquals("2020-01-01", hire.min());
        assertTrue(hire.max().startsWith("2023"));
    }

    @Test
    void 관계_추정용_값_집합은_마스킹_긴_글_컬럼을_뺀다() {
        var values = TableProfiler.profileRows(EMPLOYEES, rows()).columnValues();
        assertTrue(values.containsKey("emp_no"));
        assertFalse(values.containsKey("email"));
        assertFalse(values.containsKey("contact"));
        assertFalse(values.containsKey("memo"));
    }

    @Test
    void 마스킹_이름_규칙은_단어_경계로_본다() {
        assertTrue(TableProfiler.maskedByName("email"));
        assertTrue(TableProfiler.maskedByName("home_phone"));
        assertTrue(TableProfiler.maskedByName("card_no"));
        assertFalse(TableProfiler.maskedByName("emailed_at_count")); // "email" 로 시작하지만 단어가 다르다
        assertFalse(TableProfiler.maskedByName("cardinality"));
        // 보수적으로 잡는다 — hp_ 접두는 설비 마력일 수도 있지만 값을 안 보는 쪽이 안전하다
        assertTrue(TableProfiler.maskedByName("hp_pressure"));
        // 사람 이름 · 급여는 이름으로 잡는다. 작은 표에서는 고유값이 30 이하라 값 목록으로 나가 버리기 때문
        assertTrue(TableProfiler.maskedByName("emp_name"));
        assertTrue(TableProfiler.maskedByName("manager_name"));
        assertTrue(TableProfiler.maskedByName("base_salary"));
        assertTrue(TableProfiler.maskedByName("net_pay"));
        // 조직 · 품목 이름과 사람 id 는 라벨 · 관계의 근거라 남긴다
        assertFalse(TableProfiler.maskedByName("dept_name"));
        assertFalse(TableProfiler.maskedByName("item_name"));
        assertFalse(TableProfiler.maskedByName("manager_id"));
        assertFalse(TableProfiler.maskedByName("pay_month"));
    }

    @Test
    void 식별자는_따옴표로_감싸고_안의_따옴표는_두_번_쓴다() {
        assertEquals("\"emp_no\"", TableProfiler.quote("emp_no"));
        assertEquals("\"Mixed Case\"", TableProfiler.quote("Mixed Case"));
        assertEquals("\"a\"\"b\"", TableProfiler.quote("a\"b"));
    }
}
