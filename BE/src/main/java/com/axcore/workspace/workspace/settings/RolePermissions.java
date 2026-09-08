package com.axcore.workspace.workspace.settings;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * 직급 하나가 가진 권한의 묶음 — 기능 탭 + 회사 권한 + 데이터 범위. {@code GET /me} 와 직급 목록이 그대로 내보낸다.
 *
 * @param tabs 볼 수 있는 기능 탭 id. 회사가 끈 기능도 그대로 들어 있다 — "가졌나" 와 "지금 쓸 수 있나" 는 다르다
 */
public record RolePermissions(
        Set<String> tabs,
        boolean admin,
        boolean canInvite,
        boolean canManageIntegrations,
        String dataScope,
        boolean showAmounts) {

    /** 소유자 · 서버 운영자. 카탈로그의 탭 전부와 회사 권한 전부. */
    public static RolePermissions all() {
        Set<String> tabs = new LinkedHashSet<>();
        for (FeatureCatalog.Module m : FeatureCatalog.modules()) {
            tabs.addAll(m.tabs());
        }
        return new RolePermissions(Set.copyOf(tabs), true, true, true, "all", true);
    }
}
