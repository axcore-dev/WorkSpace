package com.axcore.workspace.external;

import java.util.List;

/**
 * 표 하나의 값 분포 — 「AI 로 다듬기」가 모델에 주는 통계. 표본(최대 {@link TableProfiler#SAMPLE_ROWS}행)에서 센 것이라 근사치다.
 *
 * <p><b>값이 담기는 곳은 {@code values} 뿐이다.</b> 고유값이 {@link TableProfiler#VALUE_LIST_MAX}개 이하인 컬럼(status · kind · 부서 코드
 * 같은 열거형)만 값 목록을 갖고, 그 밖의 문자열 컬럼은 길이 · 모양만 있다 — 직원 이름 · 거래처명처럼 고유값이 많은 컬럼은 그 자체가
 * 개인정보일 수 있어서다. 마스킹 컬럼({@code masked}) · 긴 글({@code longText})은 값 · 모양 어느 것도 없다.
 *
 * @param sampledRows 실제로 읽은 행 수(표본 상한 이하)
 */
public record TableProfile(String schema, String table, int sampledRows, List<ColumnProfile> columns) {

    /**
     * @param distinct  표본 안 고유값 수(null 제외)
     * @param nullRatio 빈 값 비율 0~1
     * @param masked    이름 · 값 모양이 개인정보 · 비밀로 보여 값을 읽지 않은 컬럼
     * @param longText  평균 길이가 긴 글(비고 · 적요) — 값을 주지 않는다
     * @param values    고유값 ≤ {@link TableProfiler#VALUE_LIST_MAX} 인 문자열 · 불리언 컬럼의 값과 건수(건수 내림차순). 그 밖은 null
     * @param shape     값 목록이 없는 문자열 컬럼의 모양 — 한글 · 숫자만 · 날짜형 · 코드형 · 혼합. 그 밖은 null
     * @param avgLen    문자열 컬럼의 평균 길이. 그 밖은 null
     * @param min       숫자 · 날짜 컬럼의 최솟값(문자열로). 그 밖은 null
     * @param max       숫자 · 날짜 컬럼의 최댓값. 그 밖은 null
     */
    public record ColumnProfile(
            String name, String type, int distinct, double nullRatio, boolean masked, boolean longText,
            List<ValueCount> values, String shape, Integer avgLen, String min, String max) {}

    public record ValueCount(String value, int count) {}

    public ColumnProfile column(String name) {
        return columns.stream().filter(c -> c.name().equals(name)).findFirst().orElse(null);
    }
}
