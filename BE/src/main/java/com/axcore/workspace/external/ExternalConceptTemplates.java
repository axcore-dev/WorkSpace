package com.axcore.workspace.external;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 개념 템플릿 — 운영 콘솔의 「템플릿 적용」이 한 번에 넣는 개념 묶음. 지금은 데모 프레스 MES 하나다
 * ({@code INFRA/seed/data/mes-supabase.sql}). 고객사 MES 가 늘면 벤더별로 묶음이 는다.
 *
 * <p>옛 {@code MesConcepts}(SQL) 와 FE 온톨로지의 {@code mes_*}(설명) 를 합친 것이다. 행이 된 뒤에는 운영 콘솔에서 고친다 —
 * 여기는 처음 넣는 값일 뿐이다. ORDER BY 는 출력 컬럼 이름으로 쓴다({@link ExternalQuery} 가 서브쿼리로 감싼다).
 */
public final class ExternalConceptTemplates {

    /** 템플릿 하나 = 시스템 종류 + 개념 목록. {@code systemId} · {@code systemName} 은 넣을 때 채운다 */
    public record Template(String key, String name, String kind, List<ExternalConcept> concepts) {}

    private static final Map<String, Template> BY_KEY = new LinkedHashMap<>();

    static {
        BY_KEY.put("press-mes-demo", new Template("press-mes-demo", "프레스 MES 데모 (Supabase)", "MES", List.of(
                concept("mes_work_order", "작업지시", List.of("생산 지시", "WO", "생산 계획", "진행률", "생산 실적"), "workorders",
                        "MES 작업지시와 진행률. 어떤 제품을 얼마나 찍기로 했고 지금 몇 개 나왔는지, 지연됐는지를 물을 때. "
                                + "die_drawing_code 가 제품설계 도면번호라 「이 도면으로 찍는 작업지시」 를 이을 수 있다.",
                        attrs("wo_no", "작업지시 번호(WO-YYMM-NNN)", "product_code", "제품 코드", "product_name", "제품명(예: S03 OP20 (FO) LH)",
                                "die_drawing_code", "금형 도면번호", "status", "상태(대기 · 진행 · 완료 · 보류)", "priority", "우선순위(긴급 · 보통 · 낮음)",
                                "line", "라인(1라인 · 2라인)", "planned_qty", "계획 수량", "produced_qty", "생산 수량(마지막 공정 양품)",
                                "defect_qty", "불량 수량", "progress_pct", "진행률 %", "planned_start", "계획 시작일", "planned_end", "계획 종료일",
                                "actual_start", "실제 시작", "actual_end", "실제 종료", "delayed", "계획보다 늦게 끝났는가"),
                        List.of(new ExternalConcept.Relation("die_drawing_code", "drawing")), null,
                        "select * from mes.v_work_order_progress",
                        List.of("wo_no", "product_code", "die_drawing_code", "status", "line", "priority"),
                        "planned_start desc, wo_no desc", 10),
                concept("mes_equipment", "설비", List.of("프레스", "호기", "기계", "장비", "비가동률", "가동률"), "monitoring",
                        "MES 설비 목록과 최근 30일 비가동 합계. 어떤 설비가 있고 상태가 어떤지, 비가동이 많은 설비가 무엇인지를 물을 때.",
                        attrs("code", "설비 코드(PR-03 = 3호기)", "name", "설비 이름", "kind", "종류(BL 블랭킹 · PR 프레스 · WD 용접 · INS 검사)",
                                "line", "라인", "capacity_ton", "프레스 톤수", "status", "상태(가동 · 정지 · 정비중)", "installed_on", "설치일",
                                "maker", "제조사", "downtime_events_30d", "최근 30일 비가동 건수", "downtime_minutes_30d", "최근 30일 비가동 분",
                                "breakdown_minutes_30d", "그중 고장 분"),
                        List.of(), null,
                        """
                        select e.code, e.name, e.kind, e.line, e.capacity_ton, e.status, e.installed_on, e.maker,
                               d.events as downtime_events_30d, d.downtime_minutes as downtime_minutes_30d,
                               d.breakdown_minutes as breakdown_minutes_30d
                          from mes.equipment e
                          join mes.v_equipment_downtime_30d d on d.equipment_code = e.code""",
                        List.of("code", "kind", "line", "status"), "code", 20),
                concept("mes_production_result", "공정 실적", List.of("실적", "양품", "생산량", "교대 실적", "작업자 실적"), "workorders",
                        "MES 공정 실적(교대마다 한 줄, 최신순). 어느 작업지시 · 공정 · 설비 · 작업자가 언제 몇 개 찍었고 불량이 몇 개였는지를 물을 때. "
                                + "목록이 길다 — wo_no 나 equipment_code 로 거른다.",
                        attrs("id", "실적 id", "wo_no", "작업지시 번호", "op_seq", "공정 순번(10 블랭킹 · 20 성형 · 30 트리밍 · 40 피어싱 · 50 검사)",
                                "process", "공정 이름", "equipment_code", "설비 코드", "worker_id", "작업자 id", "worker_name", "작업자 이름",
                                "shift", "교대(주간 · 야간)", "recorded_at", "기록 시각", "good_qty", "양품 수", "defect_qty", "불량 수", "run_minutes", "가동 분"),
                        List.of(new ExternalConcept.Relation("wo_no", "mes_work_order"), new ExternalConcept.Relation("equipment_code", "mes_equipment")), null,
                        """
                        select r.id, r.wo_no, r.op_seq, o.process, r.equipment_code, r.worker_id, w.name as worker_name,
                               r.shift, r.recorded_at, r.good_qty, r.defect_qty, r.run_minutes
                          from mes.production_results r
                          join mes.work_order_operations o on o.wo_no = r.wo_no and o.seq = r.op_seq
                          join mes.workers w on w.id = r.worker_id""",
                        List.of("wo_no", "equipment_code", "op_seq", "process", "shift", "worker_id"), "recorded_at desc, id desc", 30),
                concept("mes_downtime", "비가동", List.of("정지", "고장", "다운타임", "금형 교체", "정비"), "monitoring",
                        "MES 설비 비가동 기록(최신순). 언제 어느 설비가 왜 얼마나 멈췄는지를 물을 때. equipment_code 나 reason_code 로 거른다.",
                        attrs("id", "기록 id", "equipment_code", "설비 코드", "started_at", "시작", "ended_at", "끝", "minutes", "정지 분",
                                "reason_code", "사유 코드(BRK 고장 · CHG 금형교체 · MAT 자재대기 · QC 검사대기 · PM 예방정비 · PWR 정전)",
                                "reason", "사유", "wo_no", "그때 진행 중이던 작업지시", "note", "비고"),
                        List.of(new ExternalConcept.Relation("equipment_code", "mes_equipment"), new ExternalConcept.Relation("wo_no", "mes_work_order")), null,
                        """
                        select id, equipment_code, started_at, ended_at,
                               round(extract(epoch from (ended_at - started_at)) / 60)::int as minutes,
                               reason_code, reason, wo_no, note
                          from mes.downtime_events""",
                        List.of("equipment_code", "reason_code", "wo_no"), "started_at desc, id desc", 40),
                concept("mes_sensor", "설비 센서", List.of("진동", "온도", "부하", "PLC", "스트로크"), "monitoring",
                        "MES 프레스 센서 시간별 기록(최근 14일, 최신순). 진동 · 온도 · 부하가 어떤 추세인지를 물을 때. equipment_code 로 거른다.",
                        attrs("equipment_code", "설비 코드", "recorded_at", "기록 시각", "load_pct", "부하율 %", "slide_temp_c", "슬라이드 온도 ℃",
                                "vibration_mm_s", "진동 mm/s", "strokes", "그 시간의 스트로크 수"),
                        List.of(new ExternalConcept.Relation("equipment_code", "mes_equipment")), null,
                        "select equipment_code, recorded_at, load_pct, slide_temp_c, vibration_mm_s, strokes from mes.sensor_readings",
                        List.of("equipment_code"), "recorded_at desc, equipment_code", 50),
                concept("mes_defect", "불량 기록", List.of("불량", "NG", "크랙", "주름", "버", "폐기", "재작업"), "defects",
                        "MES 불량 기록(최신순). 어느 작업지시 · 공정 · 설비에서 어떤 불량이 몇 개 났고 어떻게 처리했는지를 물을 때. wo_no 나 defect_type 으로 거른다.",
                        attrs("id", "기록 id", "wo_no", "작업지시 번호", "op_seq", "공정 순번", "equipment_code", "설비 코드", "recorded_at", "기록 시각",
                                "defect_type", "불량 유형(크랙 · 주름 · 버 · 스크래치 · 치수불량 · 소재불량 · 피어싱 누락)", "qty", "수량",
                                "cause", "원인", "disposition", "처리(폐기 · 재작업 · 특채)"),
                        List.of(new ExternalConcept.Relation("wo_no", "mes_work_order"), new ExternalConcept.Relation("equipment_code", "mes_equipment")), null,
                        "select id, wo_no, op_seq, equipment_code, recorded_at, defect_type, qty, cause, disposition from mes.defects",
                        List.of("wo_no", "equipment_code", "op_seq", "defect_type", "disposition"), "recorded_at desc, id desc", 60),
                concept("mes_defect_rate", "불량률", List.of("불량율", "수율", "공정 불량", "설비 불량"), "defects",
                        "MES 공정 · 설비별 최근 30일 불량률(높은 순). 어느 공정이나 설비의 불량률이 높은지를 물을 때.",
                        attrs("op_seq", "공정 순번", "process", "공정 이름", "equipment_code", "설비 코드", "good_qty", "양품 합",
                                "defect_qty", "불량 합", "defect_rate_pct", "불량률 %"),
                        List.of(), "불량 ÷ (양품 + 불량) × 100, 최근 30일 실적",
                        "select * from mes.v_defect_rate_30d",
                        List.of("process", "equipment_code", "op_seq"), "defect_rate_pct desc nulls last", 70))));
    }

    private ExternalConceptTemplates() {}

    public static Optional<Template> find(String key) {
        return Optional.ofNullable(BY_KEY.get(key));
    }

    public static List<Template> all() {
        return List.copyOf(BY_KEY.values());
    }

    private static ExternalConcept concept(
            String conceptId, String name, List<String> synonyms, String tab, String description, Map<String, String> attrs,
            List<ExternalConcept.Relation> relations, String formula, String sql, List<String> filters, String orderBy, int sortOrder) {
        return new ExternalConcept(0, 0, null, "MES", conceptId, name, synonyms, tab, description, attrs, relations, formula, sql, filters, orderBy, sortOrder);
    }

    /** 순서를 지키는 attrs — 도구 설명에 나가는 순서가 곧 모델이 보는 순서다 */
    private static Map<String, String> attrs(String... kv) {
        Map<String, String> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            m.put(kv[i], kv[i + 1]);
        }
        return m;
    }
}
