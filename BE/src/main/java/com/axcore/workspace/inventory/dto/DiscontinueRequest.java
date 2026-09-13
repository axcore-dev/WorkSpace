package com.axcore.workspace.inventory.dto;

/** {@code PUT /items/{code}/discontinued} — 단종 표시만 바꾼다. 품목은 지우지 않는다(발주·이력이 가리킨다). */
public record DiscontinueRequest(boolean discontinued) {}
