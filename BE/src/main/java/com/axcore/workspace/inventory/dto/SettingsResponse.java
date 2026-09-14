package com.axcore.workspace.inventory.dto;

import java.util.List;

/**
 * {@code GET /settings} — 기준 세 가지를 한 번에. 화면이 마운트할 때 한 번 받는 다섯 요청 중 하나다
 * ({@code FE/lib/inventory-api.ts} {@code getAll}).
 */
public record SettingsResponse(List<ItemStandardDto> standards, SafetyStandardDto standard, DocRulesDto docRules) {}
