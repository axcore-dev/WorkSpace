package com.axcore.workspace.workspace.settings;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.user.introspection.ModuleAccessReader;
import com.axcore.workspace.workspace.settings.dto.FeatureModuleResponse;
import com.axcore.workspace.workspace.settings.dto.FeatureUpdateRequest;
import com.axcore.workspace.workspace.settings.dto.WorkspaceMeResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * 워크스페이스 설정 — 1단계: 내 자격 · 기능 관리.
 *
 * <p>모든 메서드가 {@link TenantAccess#open} 으로 시작한다. 그 뒤의 조회는 전부 그 회사 스키마를 본다.
 * 메서드가 {@code @Transactional} 인 이유가 그것이다 — {@code search_path} 는 트랜잭션과 함께 사라진다.
 */
@Service
public class WorkspaceSettingsService {

    private static final Logger log = LoggerFactory.getLogger(WorkspaceSettingsService.class);

    private final TenantAccess access;
    private final EnabledFeatureStore features;
    private final ModuleAccessReader moduleAccess;
    private final RolePermissionReader permissions;

    public WorkspaceSettingsService(
            TenantAccess access,
            EnabledFeatureStore features,
            ModuleAccessReader moduleAccess,
            RolePermissionReader permissions) {
        this.access = access;
        this.features = features;
        this.moduleAccess = moduleAccess;
        this.permissions = permissions;
    }

    /** 내 자격과 회사가 켠 기능. 구성원이면 누구나 본다. */
    @Transactional(readOnly = true)
    public WorkspaceMeResponse me(JwtPrincipal principal) {
        TenantContext ctx = access.open(principal);
        List<String> modules =
                moduleAccess.allowedModules(ctx.schemaName(), ctx.userId(), ctx.internalAdmin());
        return new WorkspaceMeResponse(
                ctx.workspaceId(),
                ctx.workspaceName(),
                WorkspaceMeResponse.Member.from(ctx),
                modules,
                permissions.forContext(ctx),
                toResponse(features.readAll()));
    }

    @Transactional(readOnly = true)
    public List<FeatureModuleResponse> listFeatures(JwtPrincipal principal) {
        access.open(principal);
        return toResponse(features.readAll());
    }

    /**
     * 한 모듈의 탭을 켜고 끈다. 관리자만.
     *
     * <p>넘어온 탭이 전부 그 모듈의 것인지 카탈로그로 본다. 하나라도 어긋나면 아무것도 저장하지 않는다 —
     * 절반만 저장되면 화면이 보여 주는 것과 DB 가 다른 상태로 남는다.
     */
    @Transactional
    public FeatureModuleResponse updateFeatures(
            JwtPrincipal principal, String moduleSlug, FeatureUpdateRequest request) {
        TenantContext ctx = access.open(principal);
        ctx.requireAdmin();

        FeatureCatalog.Module module =
                FeatureCatalog.module(moduleSlug)
                        .orElseThrow(() -> new SettingsValidationException("알 수 없는 기능입니다: " + moduleSlug));
        for (Map.Entry<String, Boolean> e : request.tabs().entrySet()) {
            if (!module.tabs().contains(e.getKey())) {
                throw new SettingsValidationException(
                        module.name() + " 에 없는 탭입니다: " + e.getKey());
            }
            if (e.getValue() == null) {
                throw new SettingsValidationException("탭 상태는 true 또는 false 여야 합니다: " + e.getKey());
            }
        }

        features.upsert(moduleSlug, request.tabs(), ctx.userId());
        log.info(
                "워크스페이스 {} 기능 {} 의 탭 {}개를 사용자 {} 가 바꿨다",
                ctx.workspaceId(),
                moduleSlug,
                request.tabs().size(),
                ctx.userId());

        Map<String, Boolean> tabs = features.readAll().get(moduleSlug);
        return FeatureModuleResponse.of(moduleSlug, tabs);
    }

    private static List<FeatureModuleResponse> toResponse(Map<String, Map<String, Boolean>> all) {
        return all.entrySet().stream()
                .map(e -> FeatureModuleResponse.of(e.getKey(), e.getValue()))
                .toList();
    }
}
