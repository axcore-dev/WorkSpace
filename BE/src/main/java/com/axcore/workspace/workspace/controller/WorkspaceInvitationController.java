package com.axcore.workspace.workspace.controller;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.service.AuthService;
import com.axcore.workspace.workspace.dto.InvitationPreviewResponse;
import com.axcore.workspace.workspace.dto.InvitationTokenRequest;
import com.axcore.workspace.workspace.dto.WorkspaceMembershipResponse;
import com.axcore.workspace.workspace.service.WorkspaceInvitationService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

/**
 * 초대받은 사람이 쓰는 경로.
 *
 * <p>토큰을 경로 변수가 아니라 본문으로 받는다. URL 에 실으면 브라우저 히스토리 · 프록시 로그 ·
 * Referer 헤더에 남는다. 메일 링크는 화면(`/join-workspace?token=...`)이 받고, 화면이 토큰을
 * 꺼내 여기로 POST 한다. 이메일 확인과 같은 구조다.
 */
@RestController
@RequestMapping("/api/auth/invitations")
public class WorkspaceInvitationController {

    private final WorkspaceInvitationService invitationService;
    private final AuthService authService;

    public WorkspaceInvitationController(
            WorkspaceInvitationService invitationService, AuthService authService) {
        this.invitationService = invitationService;
        this.authService = authService;
    }

    /**
     * 어느 회사의 초대인지 확인한다. 로그인 전에도 부를 수 있다.
     *
     * <p>링크를 받은 사람은 아직 가입하지 않았을 수 있다. 무엇에 대한 초대인지 모르는 채로
     * 가입을 요구할 수는 없어서 인증을 걸지 않는다. 대신 회사 이름과 대상 주소까지만 준다.
     */
    @PostMapping("/preview")
    public InvitationPreviewResponse preview(@Valid @RequestBody InvitationTokenRequest request) {
        return invitationService.preview(request.token(), Instant.now());
    }

    /**
     * 초대를 수락한다. 여기서 회사 목록에 회사가 나타난다.
     *
     * <p>로그인이 필요하다. 초대 주소와 같은 계정인지 확인해야 하기 때문이다.
     */
    @PostMapping("/accept")
    public WorkspaceMembershipResponse accept(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody InvitationTokenRequest request) {
        User user = authService.requireUser(JwtPrincipal.of(jwt).userId());
        return WorkspaceMembershipResponse.from(
                invitationService.accept(user, request.token(), Instant.now()));
    }
}
