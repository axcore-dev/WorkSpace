package com.axcore.workspace.workspace.settings.dto;

import java.util.Map;

/**
 * 기능 관리 화면의 모듈 한 칸.
 *
 * @param enabled 탭이 하나라도 켜져 있는가. 저장된 값이 아니라 {@code tabs} 에서 파생한다
 * @param tabs    탭 id → 켜짐. 카탈로그의 모든 탭이 들어 있다(행이 없는 탭은 기본값)
 */
public record FeatureModuleResponse(String module, boolean enabled, Map<String, Boolean> tabs) {

    public static FeatureModuleResponse of(String module, Map<String, Boolean> tabs) {
        return new FeatureModuleResponse(module, tabs.containsValue(Boolean.TRUE), tabs);
    }
}
