package com.axcore.workspace.workspace.admin.dto;

import com.axcore.workspace.workspace.entity.WorkspaceInvitation;

import java.time.Instant;
import java.util.UUID;

/**
 * 초대 한 건. 운영자 콘솔용이다.
 *
 * <p>토큰은 담지 않는다. 원문은 메일에만 존재해야 하고, 콘솔 응답에 실리면 운영자가 임의로
 * 남의 회사에 들어갈 수 있는 링크를 손에 넣게 된다.
 */
public record InvitationResponse(
        UUID id,
        String email,
        String status,
        Instant expiresAt,
        Instant openedAt,
        Instant acceptedAt,
        Instant revokedAt,
        Instant createdAt) {

    public static InvitationResponse from(WorkspaceInvitation invitation, Instant now) {
        return new InvitationResponse(
                invitation.getId(),
                invitation.getEmail(),
                invitation.statusAt(now).name(),
                invitation.getExpiresAt(),
                invitation.getOpenedAt(),
                invitation.getAcceptedAt(),
                invitation.getRevokedAt(),
                invitation.getCreatedAt());
    }
}
