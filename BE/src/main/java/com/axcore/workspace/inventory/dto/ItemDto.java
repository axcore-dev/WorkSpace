package com.axcore.workspace.inventory.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 품목. {@code FE/data/inventory.ts} 의 {@code Item} 과 같다 — 응답이자 {@code PUT /items/{code}} · 엑셀 업로드의
 * 요청 본문이다.
 *
 * @param vendorIds 여러 곳. {@code [0]} 이 기본 거래처라 순서가 뜻이다
 */
public record ItemDto(
        @NotBlank @Size(max = 50) String code,
        @NotBlank @Size(max = 100) String name,
        @Size(max = 100) String spec,
        @Size(max = 100) String size,
        @NotBlank @Size(max = 20) String unit,
        @Size(max = 50) String category,
        @NotNull List<@NotBlank @Size(max = 50) String> vendorIds,
        @Size(max = 100) String location,
        boolean discontinued) {}
