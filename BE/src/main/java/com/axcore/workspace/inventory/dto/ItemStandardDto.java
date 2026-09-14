package com.axcore.workspace.inventory.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/**
 * 품목 하나의 기초 재고 · 안전 재고. {@code FE/data/inventory.ts} 의 {@code ItemStandard} 와 같다 — 응답이자
 * {@code PUT /items/{code}/standard} 의 요청 본문이다({@code itemCode} 는 경로에서 온다).
 *
 * @param asOf 기초 재고의 기준일 {@code YYYY-MM-DD}. <b>빈 문자열은 「처음부터」</b> 로, 이력 전체가 기초 위에
 *     쌓인다. 화면이 날짜를 문자열로 비교하므로({@code m.at.slice(0,10) >= asOf}) 여기서도 문자열로 주고받는다 —
 *     {@code LocalDate} 로 바꾸면 "처음부터" 를 표현할 수 없어 null 이 되고 화면 비교가 깨진다
 * @param safety null 은 담당자 미설정
 */
public record ItemStandardDto(
        String itemCode,
        @Min(0) int baseline,
        @NotNull @Pattern(regexp = "|\\d{4}-\\d{2}-\\d{2}", message = "기준일은 YYYY-MM-DD 여야 합니다") String asOf,
        @Min(0) Integer safety) {}
