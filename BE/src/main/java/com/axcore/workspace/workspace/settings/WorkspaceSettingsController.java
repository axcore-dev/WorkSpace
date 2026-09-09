package com.axcore.workspace.workspace.settings;

import com.axcore.workspace.connector.ConnectorOAuthService;
import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.settings.dto.ConnectorsResponse;
import com.axcore.workspace.workspace.settings.dto.FeatureModuleResponse;
import com.axcore.workspace.workspace.settings.dto.FeatureUpdateRequest;
import com.axcore.workspace.workspace.settings.dto.WorkspaceMeResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;

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
    private final ConnectorOAuthService oauth;

    public WorkspaceSettingsController(
            WorkspaceSettingsService service, ConnectorService connectors, ConnectorOAuthService oauth) {
        this.service = service;
        this.connectors = connectors;
        this.oauth = oauth;
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

    /**
     * 외부 서비스 연결 1단계 — 제공자 동의 화면 주소. 화면은 이 주소로 브라우저를 보낸다.
     * 연동 관리 권한이 있어야 한다. state 는 서버가 서명한다(ConnectorStateCodec).
     */
    @PostMapping("/connectors/services/{slug}/authorize")
    public Map<String, String> authorizeConnector(@AuthenticationPrincipal Jwt jwt, @PathVariable String slug) {
        return Map.of("url", oauth.authorizeUrl(JwtPrincipal.of(jwt), slug, Instant.now()));
    }

    /** 연결 2단계 — 제공자가 돌려준 code 와 state. 토큰을 저장하고 바뀐 전체를 돌려준다. */
    @PostMapping("/connectors/services/{slug}/callback")
    public ConnectorsResponse completeConnector(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String slug,
            @Valid @RequestBody ConnectorCallbackRequest request) {
        JwtPrincipal principal = JwtPrincipal.of(jwt);
        oauth.complete(principal, slug, request.code(), request.state(), Instant.now());
        return connectors.snapshotFor(principal);
    }

    /** 켜기/끄기 — 등록은 그대로, 깃발만. 화면의 토글이다. 켤 수 없으면(계정 없음 · 스코프 부족) 409 라 화면이 OAuth 로 넘어간다. */
    @PutMapping("/connectors/services/{slug}")
    public ConnectorsResponse setConnectorEnabled(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String slug,
            @Valid @RequestBody ConnectorEnabledRequest request) {
        JwtPrincipal principal = JwtPrincipal.of(jwt);
        oauth.setEnabled(principal, slug, request.enabled());
        return connectors.snapshotFor(principal);
    }

    /** 연결 해제 — 목록에서 지운다. 같은 제공자를 쓰는 앱이 하나도 남지 않으면 제공자 쪽 토큰도 회수한다. */
    @DeleteMapping("/connectors/services/{slug}")
    public ConnectorsResponse disconnectConnector(@AuthenticationPrincipal Jwt jwt, @PathVariable String slug) {
        JwtPrincipal principal = JwtPrincipal.of(jwt);
        oauth.disconnect(principal, slug);
        return connectors.snapshotFor(principal);
    }

    public record ConnectorEnabledRequest(@jakarta.validation.constraints.NotNull Boolean enabled) {}

    /** 콜백 본문. 둘 다 제공자가 화면에 돌려준 값 그대로다 */
    public record ConnectorCallbackRequest(@NotBlank String code, @NotBlank String state) {}
}
