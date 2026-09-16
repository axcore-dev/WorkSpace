package com.axcore.workspace.external;

import com.axcore.workspace.external.SchemaIntrospector.Column;
import com.axcore.workspace.external.SchemaIntrospector.Table;
import com.axcore.workspace.external.TableProfile.ColumnProfile;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 「AI 로 다듬기」의 통계 규칙 — 모델 없이 값 분포만으로 정하는 것. 필터 컬럼 추가 · 제거, 값 겹침으로 잡는 관계, 버릴 표, 정렬.
 *
 * <p>결정적이고 비용이 없고 설명할 수 있어서 모델에게 묻지 않는다. 결과는 모델에도 전달돼 말을 맞추게 하고, 검토 화면에는
 * 근거(고유값 수 · 겹침 비율)와 함께 보인다. 문턱값은 상수로 두고 첫 회사에서 조정한다.
 */
public final class OntologyRules {

    /** 고유값이 이 수 이하면 거르기 좋은 컬럼 */
    static final int LOW_CARDINALITY = 30;
    /** 고유값 / 표본 행이 이 비율 이하여도 거르기 좋은 컬럼 */
    static final double LOW_CARDINALITY_RATIO = 0.05;
    /** 고유값이 표본 행의 이 비율 이상이면 사실상 유일값 — 필터로 쓸모없다 */
    static final double UNIQUE_RATIO = 0.9;
    /** 필터 제거 · 유일값 판정을 믿을 최소 표본 */
    static final int MIN_ROWS_FOR_RATIO = 20;
    /** 빈 값이 이 비율을 넘는 컬럼은 필터에 넣지 않는다 */
    static final double MAX_NULL_RATIO = 0.95;
    /** 값 겹침이 이 비율 이상이면 관계 */
    static final double RELATION_OVERLAP = 0.9;
    /** 겹침을 잴 최소 고유값 수 */
    static final int MIN_VALUES_FOR_OVERLAP = 5;
    /** 관계도 없고 행이 이보다 적으면 버릴 표 후보 */
    static final int TINY_TABLE_ROWS = 5;

    private static final List<String> KEY_SUFFIXES = List.of("_code", "_id", "_no", "_cd", "_key");
    private static final Pattern SKIP_NAME = Pattern.compile("(^|_)(log|logs|tmp|temp|bak|backup|hist|history|old|test)($|_)");

    /** 개념 SQL 의 {@code from 스키마.표}. 조인 · 서브쿼리가 있는 손 SQL 은 첫 FROM 을 잡는다 */
    private static final Pattern FROM_TABLE = Pattern.compile("\\bfrom\\s+([a-z_][a-z0-9_]*)\\.([a-z_][a-z0-9_]*)", Pattern.CASE_INSENSITIVE);

    private OntologyRules() {}

    /** 개념이 읽는 표. 소문자로 맞춰 두어 {@code equals} 가 곧 「같은 표」 판정이다 */
    public record FromTable(String schema, String table) {}

    /**
     * 개념 SQL 이 읽는 표 — 「같은 표를 읽는 개념」 판정(쌍둥이 경고 · 관계 후보 제외)과 다듬기 재료가 같은 파서를 쓴다.
     * {@code 스키마.표} 꼴이 없으면(스키마 없는 손 SQL) 비어 있다.
     */
    public static Optional<FromTable> fromTable(String sql) {
        if (sql == null) return Optional.empty();
        Matcher m = FROM_TABLE.matcher(sql);
        if (!m.find()) return Optional.empty();
        return Optional.of(new FromTable(m.group(1).toLowerCase(Locale.ROOT), m.group(2).toLowerCase(Locale.ROOT)));
    }

    /** @param overlap 값 겹침 비율 0~1 */
    public record RelationHint(String attr, String to, double overlap) {}

    /**
     * @param addFilters    초안에 없지만 거르기 좋은 컬럼 (고유값 수와 함께 {@link #reason})
     * @param removeFilters 초안에 있지만 사실상 유일값이라 쓸모없는 컬럼
     * @param relations     값 겹침으로 잡은 관계(초안에 이미 있는 것 제외)
     * @param skip          개념으로 둘 가치가 낮아 보이는 표
     * @param orderBy       더 나은 정렬이 있으면 그것, 없으면 null
     */
    public record Suggestion(
            List<String> addFilters, Map<String, String> reason, List<String> removeFilters, List<RelationHint> relations,
            boolean skip, String skipReason, String orderBy) {}

    /** 관계가 가리킬 수 있는 표 — 그 표의 개념 id · PK 컬럼 · PK 값 집합(BE 안에서만 쓴다) */
    public record Target(String table, String conceptId, String pkColumn, Set<String> pkValues) {}

    /**
     * @param draft   초안(또는 지금 저장된) 개념
     * @param profile 그 표의 프로파일과 컬럼 값 집합
     * @param t       그 표의 구조
     * @param targets 같은 시스템에 개념이 있는 다른 표들
     */
    public static Suggestion suggest(ExternalConcept draft, TableProfiler.Profiled profile, Table t, List<Target> targets, LocalDate today) {
        TableProfile p = profile.profile();
        int rows = p.sampledRows();
        Set<String> attrs = draft.attrs().keySet();
        Set<String> filters = new HashSet<>(draft.filterColumns());
        Set<String> related = new HashSet<>(draft.relations().stream().map(ExternalConcept.Relation::attr).toList());

        List<String> add = new ArrayList<>();
        Map<String, String> reason = new java.util.LinkedHashMap<>();
        List<String> remove = new ArrayList<>();
        for (ColumnProfile c : p.columns()) {
            if (!attrs.contains(c.name()) || c.masked() || c.longText()) continue;
            boolean filterable = c.type().equals("string") || c.type().equals("number") || c.type().equals("boolean");
            if (!filterable) continue;
            boolean low = c.distinct() > 0 && (c.distinct() <= LOW_CARDINALITY || (rows >= MIN_ROWS_FOR_RATIO && (double) c.distinct() / rows <= LOW_CARDINALITY_RATIO));
            boolean unique = rows >= MIN_ROWS_FOR_RATIO && c.distinct() >= rows * UNIQUE_RATIO;
            if (!filters.contains(c.name()) && low && c.nullRatio() <= MAX_NULL_RATIO) {
                add.add(c.name());
                reason.put(c.name(), "고유값 " + c.distinct());
            }
            if (filters.contains(c.name()) && unique && !t.primaryKey().contains(c.name())) {
                remove.add(c.name());
            }
        }

        List<RelationHint> hints = new ArrayList<>();
        for (Column c : t.columns()) {
            if (!attrs.contains(c.name()) || related.contains(c.name())) continue;
            Set<String> values = profile.columnValues().get(c.name());
            if (values == null || values.size() < MIN_VALUES_FOR_OVERLAP) continue;
            String lower = c.name().toLowerCase(Locale.ROOT);
            boolean keyLike = KEY_SUFFIXES.stream().anyMatch(lower::endsWith);
            for (Target target : targets) {
                if (target.table().equals(t.name()) || target.pkValues().isEmpty()) continue;
                // 이름이 키처럼 생겼거나(xxx_code) 상대 표 PK 컬럼과 이름이 같으면(wo_no = work_orders.wo_no) 겹침을 잰다
                if (!keyLike && !c.name().equals(target.pkColumn())) continue;
                long hit = values.stream().filter(target.pkValues()::contains).count();
                double overlap = (double) hit / values.size();
                if (overlap >= RELATION_OVERLAP) {
                    hints.add(new RelationHint(c.name(), target.conceptId(), Math.round(overlap * 100) / 100.0));
                    break;
                }
            }
        }

        boolean skip = false;
        String skipReason = null;
        String lowerName = t.name().toLowerCase(Locale.ROOT);
        if (rows == 0) {
            skip = true;
            skipReason = "표본에 행이 없어요";
        } else if (SKIP_NAME.matcher(lowerName).find()) {
            skip = true;
            skipReason = "이름이 로그 · 임시 · 백업 표로 보여요";
        } else if (related.isEmpty() && hints.isEmpty() && rows < TINY_TABLE_ROWS) {
            skip = true;
            skipReason = "관계가 없고 행이 " + rows + "개뿐이에요";
        }

        String orderBy = betterOrder(draft, p, today);
        return new Suggestion(List.copyOf(add), Map.copyOf(reason), List.copyOf(remove), List.copyOf(hints), skip, skipReason, orderBy);
    }

    /**
     * 날짜 컬럼 중 최댓값이 오늘에 가장 가까운 것 desc — 「최근 것부터」 가 맞게. 초안 정렬이 이미 그 컬럼이면 null.
     * 값 목록만으로는 못 정하는 것은 초안 규칙(PK desc)을 그대로 둔다.
     */
    static String betterOrder(ExternalConcept draft, TableProfile p, LocalDate today) {
        ColumnProfile best = null;
        long bestGap = Long.MAX_VALUE;
        for (ColumnProfile c : p.columns()) {
            if (!c.type().equals("datetime") || c.max() == null || !draft.attrs().containsKey(c.name())) continue;
            LocalDate d;
            try {
                d = LocalDate.parse(c.max().length() > 10 ? c.max().substring(0, 10) : c.max());
            } catch (RuntimeException e) {
                continue;
            }
            long gap = Math.abs(java.time.temporal.ChronoUnit.DAYS.between(d, today));
            if (gap < bestGap) {
                bestGap = gap;
                best = c;
            }
        }
        if (best == null) return null;
        String proposed = best.name() + " desc";
        return proposed.equals(draft.orderBy().strip()) ? null : proposed;
    }
}
