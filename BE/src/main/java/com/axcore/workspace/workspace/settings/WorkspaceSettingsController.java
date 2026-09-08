package com.axcore.workspace.workspace.settings;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.settings.dto.ConnectorUpdateRequest;
import com.axcore.workspace.workspace.settings.dto.ConnectorsResponse;
import com.axcore.workspace.workspace.settings.dto.FeatureModuleResponse;
import com.axcore.workspace.workspace.settings.dto.FeatureUpdateRequest;
import com.axcore.workspace.workspace.settings.dto.WorkspaceMeResponse;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 고객 워크스페이스의 설정 API. <b>지금 고른 회사</b>({@code wsid})가 대상이고, 그 회사의 구성원이 부른다.
 *
 * <p>{@code /api/admin/**}(우리 운영자가 회사를 개설·관리)과 다르다. 여기는 회사 안의 사람이 자기 회사를
 * 만지는 곳이다. 누가 무엇까지 할 수 있는지는 {@link TenantContext} 가 요청마다 DB 로 판정한다 —
 * 경로 규칙({@code SecurityConfig})은 "로그인했는가" 까지만 가른다.
 *
 * <p>nginx 가 {@code /api/*} 를 전부 Spring 으로 보내므로 FE 라우트({@code /ai/**})와 겹치지 않는다.
 */
@RestController
@RequestMapping("/api/workspace")
public class WorkspaceSettingsController {

    private final WorkspaceSettingsService service;
    private final ConnectorService connectors;

    public WorkspaceSettingsController(WorkspaceSettingsService service, ConnectorService connectors) {
        this.service = service;
        this.connectors = connectors;
    }

    /** 이 회사에서 나는 누구인가 — 직급 · 자격 · 쓸 수 있는 모듈 · 회사가 켠 기능. */
    @GetMapping("/me")
    public WorkspaceMeResponse me(@AuthenticationPrincipal Jwt jwt) {
        return service.me(JwtPrincipal.of(jwt));
    }

    /** 회사가 켠 기능 탭 전부. 행이 없는 탭은 기본값으로 채워져 온다. */
    @GetMapping("/features")
    public List<FeatureModuleResponse> features(@AuthenticationPrincipal Jwt jwt) {
        return service.listFeatures(JwtPrincipal.of(jwt));
    }

    /** 한 모듈의 탭 상태 저장. 관리자만. 보낸 탭만 바뀐다. */
    @PutMapping("/features/{module}")
    public FeatureModuleResponse updateFeatures(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String module,
            @Valid @RequestBody FeatureUpdateRequest request) {
        return service.updateFeatures(JwtPrincipal.of(jwt), module, request);
    }

    /** 연동 한 화면 — 외부 시스템 목록과 연결한 외부 서비스. 구성원 누구나 본다. */
    @GetMapping("/connectors")
    public ConnectorsResponse connectors(@AuthenticationPrincipal Jwt jwt) {
        return connectors.list(JwtPrincipal.of(jwt));
    }

    /** 외부 서비스 하나를 연결·해제. 연동 관리 권한이 있어야 한다. */
    @PutMapping("/connectors/services/{slug}")
    public ConnectorsResponse updateConnector(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String slug,
            @Valid @RequestBody ConnectorUpdateRequest request) {
        return connectors.update(JwtPrincipal.of(jwt), slug, request);
    }
}
