package com.axcore.workspace.inventory.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * 안전 재고를 무엇으로 정하는가. {@code FE/data/inventory.ts} 의 {@code SafetyStandard} 와 같다.
 *
 * @param method {@code manual}(담당자 지정) · {@code leadTimeAvg}(리드타임 × 평균 사용량)
 * @param avgWindowDays 평균 사용량을 볼 기간
 */
public record SafetyStandardDto(
        @NotBlank @Pattern(regexp = "leadTimeAvg|manual") String method, @Min(1) int avgWindowDays) {}
