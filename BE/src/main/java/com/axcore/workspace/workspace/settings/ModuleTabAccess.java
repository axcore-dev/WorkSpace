package com.axcore.workspace.workspace.settings;

import com.axcore.workspace.security.JwtPrincipal;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * 모듈 하나의 탭을 열 자격 — 재고·물류({@code InventoryAccess})가 세운 규칙을 모듈 이름만 바꿔 쓸 수 있게 뽑은 것.
 * 제품설계가 첫 사용자다.
 *
 * <p><b>읽기는 모듈 단위</b>({@link #openRead}) — 이 모듈의 탭을 하나라도 가졌고 회사가 하나라도 켰으면 통과다.
 * 화면이 마운트할 때 여러 GET 을 한 번에 부르므로 탭마다 막으면 탭 하나 없는 사람이 화면 전체를 못 연다(#93 합의).
 *
 * <p><b>쓰기는 탭 단위</b>({@link #open}) — 그 탭을 가졌고 회사가 그 탭을 켰어야 한다.
 */
@Component
public class ModuleTabAccess {

    private final TenantAccess access;
    private final RolePermissionReader permissions;
    private final EnabledFeatureStore features;

    public ModuleTabAccess(TenantAccess access, RolePermissionReader permissions, EnabledFeatureStore features) {
        this.access = access;
        this.permissions = permissions;
        this.features = features;
    }

    /** 읽기 — 이 모듈의 탭을 하나라도 가졌고 회사가 하나라도 켰는가. 트랜잭션 안에서 부른다. */
    public TenantContext openRead(JwtPrincipal principal, String module) {
        TenantContext ctx = access.open(principal);
        List<String> tabs = FeatureCatalog.module(module).map(FeatureCatalog.Module::tabs).orElse(List.of());
        Map<String, Boolean> on = features.readAll().getOrDefault(module, Map.of());
        var mine = permissions.forContext(ctx).tabs();
        boolean any = tabs.stream().anyMatch(tab -> mine.contains(tab) && Boolean.TRUE.equals(on.get(tab)));
        if (!any) {
            throw new SettingsForbiddenException("이 기능을 볼 권한이 없습니다");
        }
        return ctx;
    }

    /** 쓰기 — 그 탭을 가졌고 회사가 그 탭을 켰는가. 트랜잭션 안에서 부른다. */
    public TenantContext open(JwtPrincipal principal, String module, String tab) {
        TenantContext ctx = access.open(principal);
        if (!permissions.forContext(ctx).tabs().contains(tab)) {
            throw new SettingsForbiddenException("이 기능을 볼 권한이 없습니다");
        }
        if (!Boolean.TRUE.equals(features.readAll().getOrDefault(module, Map.of()).get(tab))) {
            throw new SettingsForbiddenException("이 회사에서 꺼져 있는 기능입니다");
        }
        return ctx;
    }
}
