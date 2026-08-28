package com.axcore.workspace.workspace.controller;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.user.dto.LoginResponse;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.service.AuthService;
import com.axcore.workspace.workspace.dto.WorkspaceMembershipResponse;
import com.axcore.workspace.workspace.service.WorkspaceService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

/**
 * 회사(워크스페이스) 선택.
 *
 * <p>{@code /api/auth} 아래에 두는 이유는 이것이 로그인 흐름의 마지막 단계이기 때문이다.
 * 회사가 정해져야 {@code next} 가 {@code READY} 가 되고 업무 화면이 열린다.
 */
@RestController
@RequestMapping("/api/auth/workspaces")
public class WorkspaceController {

    private final WorkspaceService workspaceService;
    private final AuthService authService;

    public WorkspaceController(WorkspaceService workspaceService, AuthService authService) {
        this.workspaceService = workspaceService;
        this.authService = authService;
    }

    /** 내 소속 목록. 들어갈 수 없는 것도 이유와 함께 돌려준다. */
    @GetMapping
    public List<WorkspaceMembershipResponse> list(@AuthenticationPrincipal Jwt jwt) {
        return workspaceService.listMemberships(JwtPrincipal.of(jwt).userId()).stream()
                .map(WorkspaceMembershipResponse::from)
                .toList();
    }

    /**
     * 회사를 고른다. 지금 이 기기의 세션에만 적용된다.
     *
     * <p>새 access 토큰을 돌려준다. {@code wsid} 클레임이 바뀌기 때문이다. refresh 는 회전하지
     * 않는다 — 회전은 재사용 탐지의 장치이지 상태 변경의 장치가 아니다. 그래서 응답에
     * Set-Cookie 가 없다.
     */
    @PostMapping("/{workspaceId}/select")
    public LoginResponse select(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long workspaceId) {
        JwtPrincipal principal = JwtPrincipal.of(jwt);
        User user = authService.requireUser(principal.userId());
        return workspaceService.select(user, principal.sessionId(), workspaceId, Instant.now());
    }
}
