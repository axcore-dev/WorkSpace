package com.axcore.workspace.workspace.settings;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * 직급 하나가 가진 권한의 묶음 — 기능 탭 + 회사 권한 + 데이터 범위.
 *
 * <p>두 곳에서 쓴다. {@code GET /me} 가 "내가 무엇을 가졌나" 를 화면에 알려 줄 때, 그리고 관리자가 다른 직급을 고칠 때
 * <b>자기 권한 안인가</b>를 판정할 때({@link #covers}). 결정 B — 관리자는 자기가 가진 것만 남에게 줄 수 있다.
 * 화면의 {@code data/grants.ts · canGrantRank} 와 같은 규칙이다.
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

    /** 넓은 것부터 — 자기보다 넓은 범위는 남에게 줄 수 없다. */
    static int scopeRank(String scope) {
        return switch (scope) {
            case "all" -> 2;
            case "dept" -> 1;
            default -> 0;
        };
    }

    /**
     * {@code other} 가 전부 내 안에 있는가.
     *
     * <p>탭은 부분집합, 불리언은 "저쪽이 켰으면 나도 켜져 있어야", 범위는 저쪽이 나보다 넓으면 안 된다.
     * 내가 못 보는 탭을 남에게 열어 줄 수 없고, 부서 것만 보는 사람이 전체를 보는 직급을 만들어 낼 수 없다.
     */
    public boolean covers(RolePermissions other) {
        if (!tabs.containsAll(other.tabs)) return false;
        if (other.admin && !admin) return false;
        if (other.canInvite && !canInvite) return false;
        if (other.canManageIntegrations && !canManageIntegrations) return false;
        if (other.showAmounts && !showAmounts) return false;
        return scopeRank(dataScope) >= scopeRank(other.dataScope);
    }
}
