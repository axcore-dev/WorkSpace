package com.axcore.workspace.external;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.axcore.workspace.external.SchemaIntrospector.Column;
import com.axcore.workspace.external.SchemaIntrospector.Table;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** 통계 규칙 — 필터 추가 · 제거, 값 겹침 관계, 버릴 표, 정렬. */
class OntologyRulesTest {

    private static Column col(String name, String type) {
        return new Column(name, type, SchemaIntrospector.classify(type), true, null);
    }

    private static final Table PAYROLL = new Table("erp", "payroll_runs", false, "월 급여", 120,
            List.of(col("id", "bigint"), col("pay_month", "text"), col("emp_no", "text"), col("net_pay", "integer"),
                    col("paid_on", "date"), col("status", "text"), col("voucher_no", "text")),
            List.of("id"), List.of(), List.of());

    private static List<Map<String, Object>> rows(int n) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            Map<String, Object> r = new HashMap<>();
            r.put("id", (long) i);
            r.put("pay_month", "2026-0" + (5 + i % 4));
            r.put("emp_no", "E%03d".formatted(i % 30));
            r.put("net_pay", 2_500_000 + i * 1000);
            r.put("paid_on", "2026-0" + (5 + i % 4) + "-25");
            r.put("status", i % 4 == 3 ? "작성중" : "지급완료");
            r.put("voucher_no", "V-%04d".formatted(i));
            out.add(r);
        }
        return out;
    }

    /** 초안 규칙이 낸 모양 — filter 에 id · emp_no · status · voucher_no(코드성) 가 들어 있고 pay_month 는 빠져 있다 */
    private static ExternalConcept draft() {
        Map<String, String> attrs = new java.util.LinkedHashMap<>();
        for (Column c : PAYROLL.columns()) attrs.put(c.name(), c.name());
        return new ExternalConcept(1, 4, "한빛ERP", "ERP", "erp_payroll_runs", "월 급여", List.of(), "payroll", "월 급여 표. [초안]", attrs,
                List.of(), null, "select id, pay_month, emp_no, net_pay, paid_on, status, voucher_no from erp.payroll_runs",
                List.of("id", "emp_no", "status", "voucher_no"), "id desc", 0);
    }

    @Test
    void 개념_SQL_에서_읽는_표를_소문자로_잡고_같은_표는_equals_로_판정한다() {
        var draft = OntologyRules.fromTable("select id, name from MES.Defects where line = 'A' order by id desc").orElseThrow();
        var template = OntologyRules.fromTable("select d.id, d.name\n  from mes.defects d\n  join mes.lines l on l.id = d.line_id").orElseThrow();
        assertEquals(new OntologyRules.FromTable("mes", "defects"), draft);
        assertEquals(draft, template, "DB 초안(mes_defects)과 템플릿(mes_defect)이 같은 표를 읽으면 쌍둥이다");
        assertTrue(OntologyRules.fromTable("select 1").isEmpty(), "스키마.표 꼴이 없으면 비어 있다");
        assertTrue(OntologyRules.fromTable("select * from defects").isEmpty(), "스키마 없는 손 SQL 도 비어 있다");
        assertTrue(OntologyRules.fromTable(null).isEmpty());
    }

    @Test
    void 고유값_적은_컬럼은_필터에_더하고_사실상_유일값은_뺀다() {
        var profiled = TableProfiler.profileRows(PAYROLL, rows(120));
        var s = OntologyRules.suggest(draft(), profiled, PAYROLL, List.of(), LocalDate.of(2026, 9, 15));
        assertTrue(s.addFilters().contains("pay_month"), s.addFilters().toString());
        assertEquals("고유값 4", s.reason().get("pay_month"));
        assertFalse(s.addFilters().contains("net_pay"), "금액은 고유값이 많다");
        assertFalse(s.addFilters().contains("status"), "이미 필터다");
        assertEquals(List.of("voucher_no"), s.removeFilters(), "전표번호는 행마다 달라 필터로 쓸모없다. id 는 PK 라 남긴다");
    }

    @Test
    void 값이_상대_표_PK_에_90퍼센트_이상_들어_있으면_관계() {
        var profiled = TableProfiler.profileRows(PAYROLL, rows(120));
        Set<String> employees = new HashSet<>();
        for (int i = 0; i < 32; i++) employees.add("E%03d".formatted(i));
        Set<String> vouchers = Set.of("V-0001", "V-0002"); // 거의 안 겹친다
        var targets = List.of(
                new OntologyRules.Target("employees", "erp_employees", "emp_no", employees),
                new OntologyRules.Target("vouchers", "erp_vouchers", "voucher_no", vouchers));
        var s = OntologyRules.suggest(draft(), profiled, PAYROLL, targets, LocalDate.of(2026, 9, 15));
        assertEquals(1, s.relations().size());
        assertEquals("emp_no", s.relations().getFirst().attr());
        assertEquals("erp_employees", s.relations().getFirst().to());
        assertEquals(1.0, s.relations().getFirst().overlap());
    }

    @Test
    void 이미_초안에_있는_관계는_다시_제안하지_않는다() {
        var profiled = TableProfiler.profileRows(PAYROLL, rows(120));
        Set<String> employees = new HashSet<>();
        for (int i = 0; i < 32; i++) employees.add("E%03d".formatted(i));
        var d = draft();
        var withRel = new ExternalConcept(d.id(), d.systemId(), d.systemName(), d.systemKind(), d.conceptId(), d.name(), d.synonyms(), d.tab(),
                d.description(), d.attrs(), List.of(new ExternalConcept.Relation("emp_no", "erp_employees")), d.formula(), d.sql(), d.filterColumns(), d.orderBy(), 0);
        var s = OntologyRules.suggest(withRel, profiled, PAYROLL, List.of(new OntologyRules.Target("employees", "erp_employees", "emp_no", employees)), LocalDate.of(2026, 9, 15));
        assertTrue(s.relations().isEmpty());
    }

    @Test
    void 최근_날짜_컬럼이_있으면_그_컬럼_desc_를_정렬로_제안한다() {
        var profiled = TableProfiler.profileRows(PAYROLL, rows(120));
        var s = OntologyRules.suggest(draft(), profiled, PAYROLL, List.of(), LocalDate.of(2026, 9, 15));
        assertEquals("paid_on desc", s.orderBy());
    }

    @Test
    void 빈_표_로그_표_관계_없는_작은_표는_버릴_후보() {
        Table log = new Table("erp", "audit_log", false, null, 0, List.of(col("id", "bigint"), col("msg", "text")), List.of("id"), List.of(), List.of());
        var d = new ExternalConcept(1, 4, "x", "ERP", "erp_audit_log", "audit_log", List.of(), "hr", "d", Map.of("id", "id", "msg", "msg"),
                List.of(), null, "select id, msg from erp.audit_log", List.of("id"), "id desc", 0);
        var empty = OntologyRules.suggest(d, TableProfiler.profileRows(log, List.of()), log, List.of(), LocalDate.now());
        assertTrue(empty.skip());
        assertEquals("표본에 행이 없어요", empty.skipReason());

        var three = OntologyRules.suggest(d, TableProfiler.profileRows(log, List.of(Map.of("id", 1L, "msg", "a"), Map.of("id", 2L, "msg", "b"), Map.of("id", 3L, "msg", "c"))), log, List.of(), LocalDate.now());
        assertTrue(three.skip());
        assertTrue(three.skipReason().contains("로그"));

        var payroll = OntologyRules.suggest(draft(), TableProfiler.profileRows(PAYROLL, rows(120)), PAYROLL, List.of(), LocalDate.now());
        assertFalse(payroll.skip());
        assertNull(payroll.skipReason());
    }
}
