package com.axcore.workspace.management;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.settings.EnabledFeatureStore;
import com.axcore.workspace.workspace.settings.RolePermissionReader;
import com.axcore.workspace.workspace.settings.SettingsForbiddenException;
import com.axcore.workspace.workspace.settings.TenantAccess;
import com.axcore.workspace.workspace.settings.TenantContext;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * 경영지원 탭(hr · payroll · accounting) 하나를 열 자격을 확인한다.
 *
 * <p>{@link TenantAccess#open} 으로 회사를 열고, (1) 내 직급이 그 탭을 가졌는지(role_module_grants, 소유자 · 운영자는 전부)
 * (2) 회사가 그 탭을 켰는지(enabled_features) 를 본다. 둘 중 하나라도 아니면 403 — 사이드바에 없는 탭을 주소로 쳐도 열리지
 * 않는다. 화면의 잠금은 안내일 뿐이고 여기가 경계다.
 *
 * <p>roles.data_scope · show_amounts 는 아직 집행하지 않는다(tenant V9 의 "도메인 API 가 생길 때"). 급여 금액은 탭 자체를
 * 가진 사람만 보므로 우선 탭 단위로 막고, 금액 가리기는 후속이다.
 */
@Component
public class ManagementAccess {

    static final String MODULE = "management";

    private final TenantAccess access;
    private final RolePermissionReader permissions;
    private final EnabledFeatureStore features;

    public ManagementAccess(TenantAccess access, RolePermissionReader permissions, EnabledFeatureStore features) {
        this.access = access;
        this.permissions = permissions;
        this.features = features;
    }

    /** 트랜잭션 안에서 부른다(search_path 가 트랜잭션에 묶인다). */
    public TenantContext open(JwtPrincipal principal, String tab) {
        TenantContext ctx = access.open(principal);
        if (!permissions.forContext(ctx).tabs().contains(tab)) {
            throw new SettingsForbiddenException("이 기능을 볼 권한이 없습니다");
        }
        Boolean on = features.readAll().getOrDefault(MODULE, Map.of()).get(tab);
        if (!Boolean.TRUE.equals(on)) {
            throw new SettingsForbiddenException("이 회사에서 꺼져 있는 기능입니다");
        }
        return ctx;
    }
}
