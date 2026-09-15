package com.axcore.workspace.external;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * 개념 행의 SELECT 에 동등 조건 · 정렬 · 상한을 붙인다. 고객 DB 로 나가는 SQL 은 이 모양뿐이다.
 *
 * <p><b>서브쿼리로 감싼다.</b> {@code select * from (<sql>) t where cast(t.col as text) = ? order by … limit …}.
 * 조인이 있는 SELECT 라도 WHERE 와 ORDER BY 가 출력 컬럼 이름만 보면 되므로, 개념마다 "이 컬럼은 어느 표 것인가" 를
 * 적어 둘 필요가 없다. 컬럼은 허용 목록에서만, 값은 바인딩으로만.
 *
 * <p>{@code cast(col as text) = ?} 로 비교한다 — 화면이 넘기는 값은 문자열이고 컬럼은 int 인 것도 있다(op_seq).
 * 표가 작아 인덱스를 못 타는 것은 상관없다.
 */
public final class ExternalQuery {

    /** 한 번에 돌려주는 최대 행. AI 도구는 이 안에서 다시 거르고 40개만 모델에 준다 */
    public static final int MAX_ROWS = 2_000;
    public static final int MAX_SQL_LENGTH = 8_000;

    private static final Pattern IDENT = Pattern.compile("^[a-z_][a-z0-9_]*$");
    private static final Pattern ORDER_BY = Pattern.compile("^[a-z_][a-z0-9_]*( (asc|desc))?( nulls (first|last))?(, [a-z_][a-z0-9_]*( (asc|desc))?( nulls (first|last))?)*$");

    private ExternalQuery() {}

    /** 만들어진 질의. {@code sql} 의 {@code ?} 순서대로 {@code params} 를 바인딩한다 */
    public record Query(String sql, List<Object> params) {}

    /** @throws IllegalArgumentException 허용되지 않은 컬럼. 컨트롤러가 400 으로 바꾼다 */
    public static Query build(ExternalConcept c, Map<String, String> equals) {
        StringBuilder sql = new StringBuilder("select * from (").append(c.sql()).append(") t");
        List<Object> params = new ArrayList<>();
        String glue = " where ";
        for (Map.Entry<String, String> e : equals.entrySet()) {
            if (!c.filterColumns().contains(e.getKey())) {
                throw new IllegalArgumentException(
                        "'%s' 는 %s 에서 거를 수 있는 항목이 아니에요. 가능한 값: %s"
                                .formatted(e.getKey(), c.conceptId(), String.join(", ", c.filterColumns().stream().sorted().toList())));
            }
            sql.append(glue).append("cast(t.").append(e.getKey()).append(" as text) = ?");
            params.add(e.getValue());
            glue = " and ";
        }
        sql.append(" order by ").append(c.orderBy()).append(" limit ").append(MAX_ROWS);
        return new Query(sql.toString(), params);
    }

    /**
     * 운영 콘솔이 넣는 정의가 이 모양에 맞는지. 맞지 않으면 사람이 읽을 이유. 실제 안전장치는 DB 롤 · readOnly ·
     * 타임아웃이고 이것은 실수를 일찍 잡는 그물이다.
     */
    public static Optional<String> problem(String sql, List<String> filterColumns, String orderBy) {
        String s = sql == null ? "" : sql.strip();
        if (s.isEmpty()) return Optional.of("SQL 을 적어 주세요");
        if (s.length() > MAX_SQL_LENGTH) return Optional.of("SQL 이 너무 길어요 (" + MAX_SQL_LENGTH + "자까지)");
        if (!s.toLowerCase(Locale.ROOT).startsWith("select")) return Optional.of("SQL 은 select 로 시작해야 해요");
        if (s.contains(";")) return Optional.of("SQL 에 세미콜론을 쓸 수 없어요 — 문장 하나만");
        for (String col : filterColumns) {
            if (!IDENT.matcher(col).matches()) return Optional.of("허용 컬럼 이름이 올바르지 않아요: " + col);
        }
        if (orderBy == null || !ORDER_BY.matcher(orderBy.strip()).matches()) {
            return Optional.of("정렬은 「컬럼 [asc|desc] [nulls first|last], …」 모양이어야 해요");
        }
        return Optional.empty();
    }
}
