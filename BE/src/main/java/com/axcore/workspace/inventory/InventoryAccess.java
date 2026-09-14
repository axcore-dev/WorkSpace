package com.axcore.workspace.inventory;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.settings.EnabledFeatureStore;
import com.axcore.workspace.workspace.settings.FeatureCatalog;
import com.axcore.workspace.workspace.settings.RolePermissionReader;
import com.axcore.workspace.workspace.settings.SettingsForbiddenException;
import com.axcore.workspace.workspace.settings.TenantAccess;
import com.axcore.workspace.workspace.settings.TenantContext;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * 재고·물류 탭 하나를 열 자격을 확인한다. {@code ManagementAccess} 와 같은 규칙이되 <b>읽기와 쓰기를 가른다.</b>
 *
 * <p>화면은 마운트할 때 다섯 GET 을 한 번에 부른다({@code FE/lib/inventory-api.ts} {@code getAll} 의
 * {@code Promise.all}). 이것을 탭마다 막으면 「현재 재고」만 가진 사람은 {@code /orders} 에서 403 을 받고 그
 * 하나 때문에 화면 전체가 오류가 된다. 재고 데이터는 여덟 탭이 서로 물려 있어(재고를 보려면 이력과 품목이
 * 필요하다) 쪼개 봐야 의미도 없다. 그래서 <b>읽기는 모듈 단위</b>({@link #openRead}) — 이 모듈의 탭을 하나라도
 * 가졌고 회사가 하나라도 켰으면 통과다.
 *
 * <p><b>쓰기는 탭 단위</b>({@link #open}) 다. 발주를 만드는 사람과 입고를 등록하는 사람이 다른 부서라
 * ({@code purchasing} · {@code receiving}) 여기를 뭉뚱그리면 권한을 나눈 뜻이 없어진다.
 *
 * <p>화면의 잠금은 안내일 뿐이고 경계는 여기다 — 사이드바에 없는 탭을 주소로 쳐도 열리지 않는다.
 */
@Component
public class InventoryAccess {

    static final String MODULE = "inventory";

    /** 처리 · 설정 여덟 탭. {@code FeatureCatalog} 의 inventory 모듈과 같아야 한다. */
    private static final List<String> TABS =
            FeatureCatalog.module(MODULE).map(FeatureCatalog.Module::tabs).orElse(List.of());

    private final TenantAccess access;
    private final RolePermissionReader permissions;
    private final EnabledFeatureStore features;

    public InventoryAccess(TenantAccess access, RolePermissionReader permissions, EnabledFeatureStore features) {
        this.access = access;
        this.permissions = permissions;
        this.features = features;
    }

    /** 읽기 — 이 모듈의 탭을 하나라도 가졌고 회사가 하나라도 켰는가. 트랜잭션 안에서 부른다. */
    public TenantContext openRead(JwtPrincipal principal) {
        TenantContext ctx = access.open(principal);
        Map<String, Boolean> on = features.readAll().getOrDefault(MODULE, Map.of());
        var mine = permissions.forContext(ctx).tabs();
        boolean any = TABS.stream().anyMatch(tab -> mine.contains(tab) && Boolean.TRUE.equals(on.get(tab)));
        if (!any) {
            throw new SettingsForbiddenException("이 기능을 볼 권한이 없습니다");
        }
        return ctx;
    }

    /** 쓰기 — 그 탭을 가졌고 회사가 그 탭을 켰는가. 트랜잭션 안에서 부른다. */
    public TenantContext open(JwtPrincipal principal, String tab) {
        TenantContext ctx = access.open(principal);
        if (!permissions.forContext(ctx).tabs().contains(tab)) {
            throw new SettingsForbiddenException("이 기능을 볼 권한이 없습니다");
        }
        if (!Boolean.TRUE.equals(features.readAll().getOrDefault(MODULE, Map.of()).get(tab))) {
            throw new SettingsForbiddenException("이 회사에서 꺼져 있는 기능입니다");
        }
        return ctx;
    }
}
