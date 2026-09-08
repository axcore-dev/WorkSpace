package com.axcore.workspace.workspace.controller;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.service.AuthService;
import com.axcore.workspace.workspace.dto.InvitationTokenRequest;
import com.axcore.workspace.workspace.dto.WorkspaceMembershipResponse;
import com.axcore.workspace.workspace.settings.InviteLinkService;
import com.axcore.workspace.workspace.settings.dto.InviteLinkPreviewResponse;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 회사 관리자가 만든 초대 링크를 연 사람이 쓰는 경로. {@code /api/auth/invitations}(운영자·이메일 초대)와 같은 모양이다 —
 * 토큰은 본문으로 받고, 미리보기는 로그인 전에도 되며, 수락은 로그인이 필요하다.
 *
 * <p>다른 점 하나: 이 링크는 주소에 묶이지 않는다. 로그인한 계정이 누구든 이메일이 확인돼 있으면 들어간다.
 */
@RestController
@RequestMapping("/api/auth/invite-links")
public class InviteLinkController {

    private final InviteLinkService links;
    private final AuthService authService;

    public InviteLinkController(InviteLinkService links, AuthService authService) {
        this.links = links;
        this.authService = authService;
    }

    @PostMapping("/preview")
    public InviteLinkPreviewResponse preview(@Valid @RequestBody InvitationTokenRequest request) {
        return links.preview(request.token());
    }

    @PostMapping("/accept")
    public WorkspaceMembershipResponse accept(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody InvitationTokenRequest request) {
        User user = authService.requireUser(JwtPrincipal.of(jwt).userId());
        return WorkspaceMembershipResponse.from(links.accept(user, request.token()));
    }
}
