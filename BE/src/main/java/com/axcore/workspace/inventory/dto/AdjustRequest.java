package com.axcore.workspace.inventory.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * {@code POST /adjustments} — 실사 차이 등을 이력 한 줄로 남긴다.
 *
 * @param qty 부호 있는 증감. 0 은 남길 이유가 없어 막는다(서비스에서 본다)
 */
public record AdjustRequest(
        @NotBlank @Size(max = 50) String itemCode, int qty, @Size(max = 200) String note) {}
