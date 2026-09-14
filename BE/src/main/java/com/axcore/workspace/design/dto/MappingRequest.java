package com.axcore.workspace.design.dto;

import jakarta.validation.constraints.Size;

/** BOM 한 줄 ↔ 품목. {@code itemCode} 가 비면 매핑을 푼다. */
public record MappingRequest(@Size(max = 50) String itemCode) {}
