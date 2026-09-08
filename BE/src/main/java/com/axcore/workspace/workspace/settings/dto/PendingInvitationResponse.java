package com.axcore.workspace.workspace.settings.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * 초대 중인 구성원 한 줄. 토큰은 담지 않는다 — 원문은 메일에만 존재한다.
 *
 * @param roleName 초대에 실린 직급 이름. 그 사이 지워졌으면 null(수락하면 member 직급으로 들어간다)
 */
public record PendingInvitationResponse(
        UUID id,
        String email,
        Long roleId,
        String roleName,
        Long departmentId,
        String departmentName,
        Instant createdAt,
        Instant expiresAt) {}
