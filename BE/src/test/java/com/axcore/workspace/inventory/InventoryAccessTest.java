package com.axcore.workspace.inventory;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.settings.EnabledFeatureStore;
import com.axcore.workspace.workspace.settings.RolePermissionReader;
import com.axcore.workspace.workspace.settings.RolePermissions;
import com.axcore.workspace.workspace.settings.SettingsForbiddenException;
import com.axcore.workspace.workspace.settings.TenantAccess;
import com.axcore.workspace.workspace.settings.TenantContext;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * 읽기(모듈 단위)와 쓰기(탭 단위)가 갈리는 자리. 여기가 조용히 열리면 권한 체계 전체가 무의미해진다(#94).
 *
 * <p>협력자는 전부 mock 이다 — 회사 진입({@code TenantAccess})과 직급 권한·기능 스위치 읽기는 각자의 자리에서
 * 검사하고, 여기서는 그 셋을 조합하는 규칙만 본다.
 */
class InventoryAccessTest {

    private final JwtPrincipal principal = new JwtPrincipal(UUID.randomUUID(), UUID.randomUUID(), 8L);
    private final TenantContext ctx = mock(TenantContext.class);
    private final TenantAccess tenant = mock(TenantAccess.class);
    private final RolePermissionReader permissions = mock(RolePermissionReader.class);
    private final EnabledFeatureStore features = mock(EnabledFeatureStore.class);
    private final InventoryAccess access = new InventoryAccess(tenant, permissions, features);

    /** 「현재 재고」 탭 하나만 가진 구성원. 회사는 여덟 탭 중 재고·발주·입고를 켰다. */
    private void stockOnlyMember(Map<String, Boolean> enabled) {
        when(tenant.open(principal)).thenReturn(ctx);
        when(permissions.forContext(any())).thenReturn(new RolePermissions(Set.of("stock"), false, false, false, "own", false));
        when(features.readAll()).thenReturn(Map.of("inventory", enabled));
    }

    @Test
    void 탭_하나만_가져도_읽기는_모듈_단위로_통과한다() {
        stockOnlyMember(Map.of("stock", true, "purchasing", true, "receiving", true));
        assertSame(ctx, access.openRead(principal));
    }

    @Test
    void 자기_탭이_아닌_쓰기는_거절한다() {
        stockOnlyMember(Map.of("stock", true, "purchasing", true, "receiving", true));
        assertThrows(SettingsForbiddenException.class, () -> access.open(principal, "purchasing"));
        // 자기 탭은 통과
        assertSame(ctx, access.open(principal, "stock"));
    }

    @Test
    void 회사가_그_탭을_꺼_두면_가졌어도_거절한다() {
        stockOnlyMember(Map.of("stock", false, "purchasing", true));
        assertThrows(SettingsForbiddenException.class, () -> access.open(principal, "stock"));
        // 읽기도 같다 — 가진 탭이 전부 꺼져 있으면 모듈 자체가 닫힌다
        assertThrows(SettingsForbiddenException.class, () -> access.openRead(principal));
    }

    @Test
    void 이_모듈의_탭이_하나도_없으면_읽기도_거절한다() {
        when(tenant.open(principal)).thenReturn(ctx);
        when(permissions.forContext(any())).thenReturn(new RolePermissions(Set.of("payroll"), false, false, false, "own", false));
        when(features.readAll()).thenReturn(Map.of("inventory", Map.of("stock", true)));
        assertThrows(SettingsForbiddenException.class, () -> access.openRead(principal));
    }
}
