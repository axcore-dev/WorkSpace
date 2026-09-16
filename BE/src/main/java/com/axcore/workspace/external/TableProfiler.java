package com.axcore.workspace.external;

import com.axcore.workspace.external.SchemaIntrospector.Column;
import com.axcore.workspace.external.SchemaIntrospector.Table;
import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * 표 하나의 값 분포를 잰다 — 「AI 로 다듬기」의 재료. 표마다 <b>쿼리 한 번</b>({@code select … limit 2000})으로 표본을 받아 BE 메모리에서
 * 세고, 표본은 이 메서드가 끝나면 버린다. 파일 · DB · 로그 어디에도 쓰지 않는다.
 *
 * <p>고객 데이터를 다루는 규칙은 {@link TableProfile} 에 적었다. 여기서는 그 규칙을 구현한다:
 * <ul>
 *   <li>이름이 개인정보 · 비밀로 보이는 컬럼({@link #MASKED_NAMES})은 값을 보지 않는다</li>
 *   <li>값 모양이 이메일 · 전화번호 · 13자리 숫자 · 카드번호인 것이 절반을 넘으면 마스킹한다</li>
 *   <li>평균 {@link #LONG_TEXT_LEN}자를 넘는 문자열은 긴 글 — 값 · 모양 없음</li>
 *   <li>값 목록은 고유값 ≤ {@link #VALUE_LIST_MAX} 인 문자열 · 불리언 컬럼에만</li>
 * </ul>
 *
 * <p>관계 추정(값 겹침)에 쓰는 컬럼 값 집합은 {@link Profiled#columnValues()} 로 따로 돌려주되 <b>API 응답에는 싣지 않는다</b>
 * — {@link OntologyRules} 가 BE 안에서만 쓴다.
 */
@Component
public class TableProfiler {

    public static final int SAMPLE_ROWS = 2_000;
    public static final int VALUE_LIST_MAX = 30;
    public static final int LONG_TEXT_LEN = 60;
    /** 관계 추정용 PK 값 집합의 상한 */
    public static final int PK_VALUES_MAX = 5_000;
    private static final int QUERY_TIMEOUT_SEC = 15;

    /**
     * 이름만 보고 값을 안 보는 컬럼. 연락처 · 식별번호 · 비밀 외에 <b>사람 이름 · 급여</b>도 든다 — 작은 표(사원 30명)에서는 고유값이
     * 30 이하라 이름이 값 목록으로 나가고, 급여는 최솟값 · 최댓값이 한 사람의 값이 되기 때문. {@code dept_name} 같은 조직 이름은
     * 라벨 괄호의 근거라 남긴다 — 그래서 {@code name} 이 아니라 {@code emp_name} 처럼 사람을 가리키는 꼴만 적었다.
     */
    static final List<String> MASKED_NAMES = List.of(
            "email", "mail", "phone", "tel", "mobile", "hp", "fax", "ssn", "resident", "jumin", "birth", "addr", "address",
            "card", "acct", "account_no", "bank", "password", "passwd", "pw", "pwd", "token", "secret", "salt", "iban",
            "emp_name", "employee_name", "user_name", "username", "person", "contact", "manager_name", "owner_name", "worker_name",
            "salary", "wage", "bonus", "net_pay", "gross_pay", "annual_pay");

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Pattern PHONE = Pattern.compile("^\\+?\\d{2,3}[- .]?\\d{3,4}[- .]?\\d{4}$");
    private static final Pattern RESIDENT = Pattern.compile("^\\d{6}-?\\d{7}$");
    private static final Pattern CARD = Pattern.compile("^\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}$");
    private static final Pattern DATE_LIKE = Pattern.compile("^\\d{4}[-./]\\d{1,2}([-./]\\d{1,2})?([ T].*)?$|^\\d{4}-?\\d{2}$");
    private static final Pattern DIGITS = Pattern.compile("^\\d+$");
    private static final Pattern CODE_LIKE = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9_./-]*$");
    private static final Pattern HANGUL = Pattern.compile("[\\uAC00-\\uD7A3]");

    /** 응답용 프로파일과, BE 안에서만 쓰는 컬럼별 값 집합(관계 추정) */
    public record Profiled(TableProfile profile, Map<String, Set<String>> columnValues) {}

    public Profiled profile(ExternalDataSource ds, Table t) {
        JdbcTemplate jdbc = new JdbcTemplate(ds.dataSource());
        jdbc.setQueryTimeout(QUERY_TIMEOUT_SEC);
        jdbc.setMaxRows(SAMPLE_ROWS);
        String cols = String.join(", ", t.columns().stream().map(c -> quote(c.name())).toList());
        List<Map<String, Object>> rows = jdbc.queryForList("select " + cols + " from " + quote(t.schema()) + "." + quote(t.name()) + " limit " + SAMPLE_ROWS);
        return profileRows(t, rows);
    }

    /** 카탈로그에서 읽은 식별자를 그대로 따옴표로 감싼다 — 대소문자 · 특수문자가 든 이름도 깨지지 않고, SQL 로 읽히지 않는다 */
    static String quote(String identifier) {
        return "\"" + identifier.replace("\"", "\"\"") + "\"";
    }

    /** 한 컬럼짜리 PK 의 값 집합 — 다른 표의 컬럼이 이 표를 가리키는지 볼 때. 복합 키면 빈 집합 */
    public Set<String> pkValues(ExternalDataSource ds, Table t) {
        if (t.primaryKey().size() != 1) return Set.of();
        JdbcTemplate jdbc = new JdbcTemplate(ds.dataSource());
        jdbc.setQueryTimeout(QUERY_TIMEOUT_SEC);
        jdbc.setMaxRows(PK_VALUES_MAX);
        String pk = t.primaryKey().getFirst();
        Set<String> out = new HashSet<>();
        jdbc.query("select " + quote(pk) + " from " + quote(t.schema()) + "." + quote(t.name()) + " limit " + PK_VALUES_MAX, rs -> {
            Object v = rs.getObject(1);
            if (v != null) out.add(text(v));
        });
        return out;
    }

    /** 표본 → 프로파일. 순수 함수라 테스트가 행을 직접 넣는다 */
    public static Profiled profileRows(Table t, List<Map<String, Object>> rows) {
        List<TableProfile.ColumnProfile> out = new ArrayList<>();
        Map<String, Set<String>> valueSets = new HashMap<>();
        int n = rows.size();
        for (Column c : t.columns()) {
            List<Object> raw = rows.stream().map(r -> r.get(c.name())).toList();
            List<String> nonNull = raw.stream().filter(v -> v != null && !(v instanceof String s && s.isBlank())).map(TableProfiler::text).toList();
            double nullRatio = n == 0 ? 0 : (double) (n - nonNull.size()) / n;
            Map<String, Integer> counts = new LinkedHashMap<>();
            for (String v : nonNull) counts.merge(v, 1, Integer::sum);
            int distinct = counts.size();

            boolean masked = maskedByName(c.name()) || maskedByValue(nonNull);
            if (masked) {
                out.add(new TableProfile.ColumnProfile(c.name(), c.type(), distinct, nullRatio, true, false, null, null, null, null, null));
                continue;
            }
            valueSets.put(c.name(), counts.keySet());

            switch (c.type()) {
                case "number", "datetime" -> {
                    String min = nonNull.stream().min(comparator(c.type())).orElse(null);
                    String max = nonNull.stream().max(comparator(c.type())).orElse(null);
                    // 정수형 코드(상태 코드 1 · 2 · 3)는 값 목록도 준다 — 라벨 괄호의 근거
                    List<TableProfile.ValueCount> values = c.type().equals("number") && distinct <= VALUE_LIST_MAX && distinct > 0 && nonNull.stream().allMatch(DIGITS.asMatchPredicate())
                            ? valueList(counts) : null;
                    out.add(new TableProfile.ColumnProfile(c.name(), c.type(), distinct, nullRatio, false, false, values, null, null, min, max));
                }
                case "boolean" -> out.add(new TableProfile.ColumnProfile(c.name(), c.type(), distinct, nullRatio, false, false, valueList(counts), null, null, null, null));
                case "string" -> {
                    int avgLen = nonNull.isEmpty() ? 0 : (int) Math.round(nonNull.stream().mapToInt(String::length).average().orElse(0));
                    if (avgLen > LONG_TEXT_LEN) {
                        valueSets.remove(c.name());
                        out.add(new TableProfile.ColumnProfile(c.name(), c.type(), distinct, nullRatio, false, true, null, null, avgLen, null, null));
                    } else if (distinct <= VALUE_LIST_MAX) {
                        out.add(new TableProfile.ColumnProfile(c.name(), c.type(), distinct, nullRatio, false, false, valueList(counts), null, avgLen, null, null));
                    } else {
                        out.add(new TableProfile.ColumnProfile(c.name(), c.type(), distinct, nullRatio, false, false, null, shape(nonNull), avgLen, null, null));
                    }
                }
                default -> out.add(new TableProfile.ColumnProfile(c.name(), c.type(), distinct, nullRatio, false, false, null, null, null, null, null));
            }
        }
        return new Profiled(new TableProfile(t.schema(), t.name(), n, out), valueSets);
    }

    static boolean maskedByName(String column) {
        String n = column.toLowerCase(Locale.ROOT);
        for (String m : MASKED_NAMES) {
            if (n.equals(m) || n.startsWith(m + "_") || n.endsWith("_" + m) || n.contains("_" + m + "_")) return true;
        }
        return false;
    }

    /** 표본 값의 절반 이상이 이메일 · 전화 · 주민번호 · 카드번호 모양이면 개인정보로 본다 */
    static boolean maskedByValue(List<String> values) {
        if (values.isEmpty()) return false;
        long hits = values.stream().filter(v -> EMAIL.matcher(v).matches() || PHONE.matcher(v).matches()
                || RESIDENT.matcher(v).matches() || CARD.matcher(v).matches()).count();
        return hits * 2 >= values.size();
    }

    /** 값 목록이 없는 문자열 컬럼의 모양 — 모델이 "코드인지 이름인지" 를 값 없이 알게 */
    static String shape(List<String> values) {
        if (values.isEmpty()) return "혼합";
        long hangul = values.stream().filter(v -> HANGUL.matcher(v).find()).count();
        long digits = values.stream().filter(v -> DIGITS.matcher(v).matches()).count();
        long dates = values.stream().filter(v -> DATE_LIKE.matcher(v).matches()).count();
        long codes = values.stream().filter(v -> CODE_LIKE.matcher(v).matches()).count();
        int n = values.size();
        if (hangul * 10 >= n * 7) return "한글";
        if (dates * 10 >= n * 7) return "날짜형";
        if (digits * 10 >= n * 7) return "숫자만";
        if (codes * 10 >= n * 7) return "코드형";
        return "혼합";
    }

    private static List<TableProfile.ValueCount> valueList(Map<String, Integer> counts) {
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
                .map(e -> new TableProfile.ValueCount(e.getKey(), e.getValue()))
                .toList();
    }

    private static Comparator<String> comparator(String type) {
        if (type.equals("number")) {
            return Comparator.comparing(s -> {
                try {
                    return new BigDecimal(s);
                } catch (NumberFormatException e) {
                    return BigDecimal.ZERO;
                }
            });
        }
        return Comparator.naturalOrder();
    }

    static String text(Object v) {
        return switch (v) {
            case Timestamp ts -> ts.toLocalDateTime().toString();
            case Date d -> d.toLocalDate().toString();
            case BigDecimal b -> b.stripTrailingZeros().toPlainString();
            default -> String.valueOf(v);
        };
    }
}
