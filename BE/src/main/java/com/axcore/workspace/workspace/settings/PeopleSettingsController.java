package com.axcore.workspace.workspace.settings;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.settings.dto.InviteLinkRequest;
import com.axcore.workspace.workspace.settings.dto.InviteLinkResponse;
import com.axcore.workspace.workspace.settings.dto.MemberInviteRequest;
import com.axcore.workspace.workspace.settings.dto.MemberInviteResult;
import com.axcore.workspace.workspace.settings.dto.MemberResponse;
import com.axcore.workspace.workspace.settings.dto.MemberUpdateRequest;
import com.axcore.workspace.workspace.settings.dto.PendingInvitationResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * 회사 사람들 — 설정 › 회사 › 초대 관리 화면의 API. 구성원 · 이메일 초대 · 초대 링크.
 *
 * <p>구성원 목록은 회사 구성원 누구나 본다. 그 외 쓰기는 전부 소유자만이다({@link TenantContext#requireOwner}).
 * 줄 수 있는 직급·부서는 {@link PeopleGuard} 규칙이다.
 */
@RestController
@RequestMapping("/api/workspace")
public class PeopleSettingsController {

    private final MemberService members;
    private final MemberInvitationService invitations;
    private final InviteLinkService links;

    public PeopleSettingsController(
            MemberService members, MemberInvitationService invitations, InviteLinkService links) {
        this.members = members;
        this.invitations = invitations;
        this.links = links;
    }

    // ---------------------------------------------------------------- 구성원

    @GetMapping("/members")
    public List<MemberResponse> members(@AuthenticationPrincipal Jwt jwt) {
        return members.list(JwtPrincipal.of(jwt));
    }

    /** 부서·직급 변경. 소유자의 소속과 자기 소속은 바꿀 수 없다. */
    @PatchMapping("/members/{id}")
    public MemberResponse updateMember(
            @AuthenticationPrincipal Jwt jwt, @PathVariable long id, @Valid @RequestBody MemberUpdateRequest request) {
        return members.update(JwtPrincipal.of(jwt), id, request);
    }

    // ---------------------------------------------------------------- 이메일 초대

    @GetMapping("/invitations")
    public List<PendingInvitationResponse> invitations(@AuthenticationPrincipal Jwt jwt) {
        return invitations.list(JwtPrincipal.of(jwt));
    }

    /** 여러 명을 같은 직급·부서로. 건너뛴 주소는 이유와 함께 돌려준다. 메일은 시스템이 보낸다. */
    @PostMapping("/invitations")
    public MemberInviteResult invite(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody MemberInviteRequest request) {
        return invitations.invite(JwtPrincipal.of(jwt), request);
    }

    @PostMapping("/invitations/{id}/resend")
    public PendingInvitationResponse resend(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return invitations.resend(JwtPrincipal.of(jwt), id);
    }

    @DeleteMapping("/invitations/{id}")
    public ResponseEntity<Void> revokeInvitation(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        invitations.revoke(JwtPrincipal.of(jwt), id);
        return ResponseEntity.noContent().build();
    }

    // ---------------------------------------------------------------- 초대 링크

    @GetMapping("/invite-links")
    public List<InviteLinkResponse> inviteLinks(@AuthenticationPrincipal Jwt jwt) {
        return links.list(JwtPrincipal.of(jwt));
    }

    /** 링크 원문은 이 응답에만 있다. 화면이 바로 복사하게 안내한다. */
    @PostMapping("/invite-links")
    public ResponseEntity<InviteLinkResponse> createInviteLink(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody InviteLinkRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(links.create(JwtPrincipal.of(jwt), request));
    }

    @DeleteMapping("/invite-links/{id}")
    public ResponseEntity<Void> revokeInviteLink(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        links.revoke(JwtPrincipal.of(jwt), id);
        return ResponseEntity.noContent().build();
    }
}
